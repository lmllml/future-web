/**
 * 全局K线数据缓存服务
 * 避免重复请求相同时间段的K线数据，提高止盈止损计算性能
 */

import { cryptoApi } from "./api";

export interface KlineData {
  symbol: string;
  interval: string;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
  exchange: string;
  market: string;
  timestamp: string;
}

interface CacheEntry {
  data: KlineData[];
  cachedAt: number;
  startTime: string;
  endTime: string;
}

interface CacheKey {
  symbol: string;
  exchange: string;
  market: string;
  interval: string;
  startTime: string;
  endTime: string;
}

class KlineCacheService {
  private cache = new Map<string, CacheEntry>();
  private inflightRequests = new Map<string, Promise<KlineData[]>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  // 离线模式：仅使用已预加载的数据，禁止任何网络请求与自动刷新
  private offlineMode = false;
  // 数据集的“数据库最新一根K线时间”缓存（按 exchange/market/symbol/interval 维度）
  private datasetEndTime = new Map<string, string>();

  // 缓存TTL: 1分钟K线缓存5分钟，其他缓存30分钟
  private readonly CACHE_TTL_1M = 5 * 60 * 1000; // 5分钟
  private readonly CACHE_TTL_OTHER = 30 * 60 * 1000; // 30分钟

  // 最大缓存条目数，避免内存溢出
  private readonly MAX_CACHE_ENTRIES = 1000;

  constructor() {
    // 启动定期清理过期缓存
    this.startCleanupScheduler();
    // 启动定期刷新最新数据
    this.startRefreshScheduler();
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(params: CacheKey): string {
    return `${params.exchange}:${params.market}:${params.symbol}:${params.interval}:${params.startTime}:${params.endTime}`;
  }

  private generateSymbolKey(params: {
    exchange: string;
    market: string;
    symbol: string;
    interval: string;
  }): string {
    return `${params.exchange}:${params.market}:${params.symbol}:${params.interval}`;
  }

  /**
   * 启用/关闭离线模式
   * - 开启后：仅从缓存读取，拒绝网络请求，停止自动刷新与清理调度
   * - 关闭后：恢复正常行为
   */
  setOfflineMode(enabled: boolean): void {
    this.offlineMode = enabled;
    if (enabled) {
      this.stopSchedulers();
    } else {
      this.startCleanupScheduler();
      this.startRefreshScheduler();
    }
  }

  isOfflineMode(): boolean {
    return this.offlineMode;
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(entry: CacheEntry, interval: string): boolean {
    const now = Date.now();
    const ttl = interval === "1m" ? this.CACHE_TTL_1M : this.CACHE_TTL_OTHER;
    return now - entry.cachedAt < ttl;
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      // 根据interval判断TTL
      const interval = key.split(":")[3];
      const ttl = interval === "1m" ? this.CACHE_TTL_1M : this.CACHE_TTL_OTHER;

      if (now - entry.cachedAt > ttl) {
        toDelete.push(key);
      }
    }

    toDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * 限制缓存大小，删除最旧的条目
   * 优先删除过期的、数据量大的、访问频率低的条目
   */
  private limitCacheSize(): void {
    if (this.cache.size <= this.MAX_CACHE_ENTRIES) return;

    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => {
      const keyParts = key.split(":");
      const interval = keyParts[3];
      const ttl = interval === "1m" ? this.CACHE_TTL_1M : this.CACHE_TTL_OTHER;
      const isExpired = now - entry.cachedAt > ttl;

      return {
        key,
        entry,
        isExpired,
        dataSize: entry.data.length,
        age: now - entry.cachedAt,
        // 计算优先级分数，分数越高越应该被删除
        priority:
          (isExpired ? 1000 : 0) +
          entry.data.length / 1000 + // 数据量大的优先删除
          (now - entry.cachedAt) / (1000 * 60), // 时间越久优先级越高
      };
    });

    // 按优先级排序，优先删除分数高的
    entries.sort((a, b) => b.priority - a.priority);

    const toDelete = entries.slice(0, this.cache.size - this.MAX_CACHE_ENTRIES);
    toDelete.forEach(({ key }) => this.cache.delete(key));

    if (toDelete.length > 0) {
      console.log(`已清理 ${toDelete.length} 个缓存条目，释放内存`);
    }
  }

  /**
   * 检查内存使用情况并主动清理
   */
  private checkMemoryUsage(): void {
    const stats = this.getCacheStats();
    const memoryMB = parseFloat(stats.memoryUsageEstimate.replace(" MB", ""));

    // 如果内存使用超过100MB，主动清理
    if (memoryMB > 100) {
      console.warn(
        `K线缓存内存使用过高: ${stats.memoryUsageEstimate}，开始主动清理`
      );

      // 降低缓存条目限制
      const originalLimit = this.MAX_CACHE_ENTRIES;
      (this as any).MAX_CACHE_ENTRIES = Math.floor(originalLimit * 0.7);

      this.limitCacheSize();
      this.cleanExpiredCache();

      // 恢复原限制
      (this as any).MAX_CACHE_ENTRIES = originalLimit;

      const newStats = this.getCacheStats();
      console.log(`清理完成，当前内存使用: ${newStats.memoryUsageEstimate}`);
    }
  }

  /**
   * 检查是否能从现有缓存中获取数据
   * 支持时间范围包含关系的缓存复用
   */
  private findCachedData(params: CacheKey): KlineData[] | null {
    const requestStart = new Date(params.startTime).getTime();
    const requestEnd = new Date(params.endTime).getTime();

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isCacheValid(entry, params.interval)) continue;

      const keyParts = key.split(":");
      if (
        keyParts[0] !== params.exchange ||
        keyParts[1] !== params.market ||
        keyParts[2] !== params.symbol ||
        keyParts[3] !== params.interval
      ) {
        continue;
      }

      const cachedStart = new Date(entry.startTime).getTime();
      const cachedEnd = new Date(entry.endTime).getTime();

      // 检查缓存的时间范围是否包含请求的时间范围
      if (cachedStart <= requestStart && cachedEnd >= requestEnd) {
        // 过滤出请求时间范围内的数据
        return entry.data.filter((k) => {
          const kTime = new Date(k.openTime).getTime();
          return kTime >= requestStart && kTime <= requestEnd;
        });
      }
    }

    return null;
  }

  /**
   * 仅从缓存读取（允许部分覆盖）
   * - 当请求时间范围超出缓存范围，返回缓存与请求的交集部分
   * - 不触发任何网络请求
   */
  getKlinesFromCache(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval: string;
    startTime: string;
    endTime: string;
    order?: "asc" | "desc";
  }): KlineData[] {
    const exchange = params.exchange || "binance";
    const market = params.market || "futures";
    const requestStart = new Date(params.startTime).getTime();
    const requestEnd = new Date(params.endTime).getTime();

    let union: KlineData[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const [ex, mk, sym, interval] = key.split(":");
      if (
        ex !== exchange ||
        mk !== market ||
        sym !== params.symbol ||
        interval !== params.interval
      ) {
        continue;
      }
      // 取交集
      const cachedStart = new Date(entry.startTime).getTime();
      const cachedEnd = new Date(entry.endTime).getTime();
      const overlapStart = Math.max(requestStart, cachedStart);
      const overlapEnd = Math.min(requestEnd, cachedEnd);
      if (overlapStart <= overlapEnd) {
        const part = entry.data.filter((k) => {
          const t = new Date(k.openTime).getTime();
          return t >= overlapStart && t <= overlapEnd;
        });
        union = union.concat(part);
      }
    }

    union.sort(
      (a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime()
    );
    if (params.order === "desc") return [...union].reverse();
    return union;
  }

  /**
   * 获取K线数据，优先使用缓存
   */
  async getKlines(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval: string;
    startTime: string;
    endTime: string;
    order?: "asc" | "desc";
  }): Promise<KlineData[]> {
    const cacheParams: CacheKey = {
      symbol: params.symbol,
      exchange: params.exchange || "binance",
      market: params.market || "futures",
      interval: params.interval,
      startTime: params.startTime,
      endTime: params.endTime,
    };

    const cacheKey = this.generateCacheKey(cacheParams);

    // 1. 检查缓存
    const cachedData = this.findCachedData(cacheParams);
    if (cachedData) {
      return params.order === "desc" ? cachedData.reverse() : cachedData;
    }

    // 2. 检查是否有正在进行的请求
    const inflightRequest = this.inflightRequests.get(cacheKey);
    if (inflightRequest) {
      const result = await inflightRequest;
      return params.order === "desc" ? [...result].reverse() : result;
    }

    // 3. 发起新请求（离线模式下禁止网络请求，退化为仅从缓存读取的部分覆盖返回）
    if (this.offlineMode) {
      return this.getKlinesFromCache(params);
    }
    const requestPromise = this.fetchKlines(params);
    this.inflightRequests.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;

      // 4. 缓存结果
      this.cache.set(cacheKey, {
        data: [...data], // 浅拷贝避免外部修改
        cachedAt: Date.now(),
        startTime: params.startTime,
        endTime: params.endTime,
      });

      // 5. 清理缓存
      this.cleanExpiredCache();
      this.limitCacheSize();

      return params.order === "desc" ? [...data].reverse() : data;
    } finally {
      this.inflightRequests.delete(cacheKey);
    }
  }

  /**
   * 实际的K线数据请求
   */
  private async fetchKlines(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval: string;
    startTime: string;
    endTime: string;
  }): Promise<KlineData[]> {
    if (this.offlineMode) {
      // 离线模式下不应触发网络请求
      return [];
    }
    const { data } = await cryptoApi.listKlines<{ data: KlineData[] }>({
      symbol: params.symbol,
      exchange: params.exchange || "binance",
      market: params.market || "futures",
      interval: params.interval,
      startTime: params.startTime,
      endTime: params.endTime,
      order: "asc",
    });

    return data || [];
  }

  /**
   * 预加载K线数据
   * 在用户筛选条件确定后，提前加载完整时间范围的K线数据
   */
  async preloadKlines(params: {
    symbols: string[];
    exchange?: string;
    market?: string;
    intervals: string[];
    startTime: string;
    endTime: string;
  }): Promise<void> {
    const { symbols, intervals, startTime, endTime } = params;
    const exchange = params.exchange || "binance";
    const market = params.market || "futures";

    // 并发预加载所有symbol和interval的组合
    const tasks = symbols.flatMap((symbol) =>
      intervals.map((interval) =>
        this.getKlines({
          symbol,
          exchange,
          market,
          interval,
          startTime,
          endTime,
        })
      )
    );

    // 分批并发执行，避免过多并发请求
    const batchSize = 10;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      await Promise.all(batch);
    }
  }

  /**
   * 扩展时间范围缓存
   * 当需要更大时间范围的数据时，只请求缺失的部分
   */
  async extendTimeRange(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval: string;
    newStartTime: string;
    newEndTime: string;
  }): Promise<KlineData[]> {
    const { symbol, interval, newStartTime, newEndTime } = params;
    const exchange = params.exchange || "binance";
    const market = params.market || "futures";

    const newStart = new Date(newStartTime).getTime();
    const newEnd = new Date(newEndTime).getTime();

    // 查找现有缓存
    let existingData: KlineData[] = [];
    let existingStart = newStart;
    let existingEnd = newEnd;

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isCacheValid(entry, interval)) continue;

      const keyParts = key.split(":");
      if (
        keyParts[0] === exchange &&
        keyParts[1] === market &&
        keyParts[2] === symbol &&
        keyParts[3] === interval
      ) {
        const cachedStart = new Date(entry.startTime).getTime();
        const cachedEnd = new Date(entry.endTime).getTime();

        // 检查是否有重叠
        if (cachedEnd >= newStart && cachedStart <= newEnd) {
          existingData = entry.data;
          existingStart = cachedStart;
          existingEnd = cachedEnd;
          break;
        }
      }
    }

    const requests: Promise<KlineData[]>[] = [];

    // 离线模式：不再请求缺失部分，仅返回交集
    if (!this.offlineMode) {
      // 请求前面缺失的数据
      if (newStart < existingStart) {
        requests.push(
          this.getKlines({
            symbol,
            exchange,
            market,
            interval,
            startTime: newStartTime,
            endTime: new Date(existingStart - 1).toISOString(),
          })
        );
      }

      // 请求后面缺失的数据
      if (newEnd > existingEnd) {
        requests.push(
          this.getKlines({
            symbol,
            exchange,
            market,
            interval,
            startTime: new Date(existingEnd + 1).toISOString(),
            endTime: newEndTime,
          })
        );
      }
    }

    if (requests.length === 0 || this.offlineMode) {
      // 离线或无需请求：返回交集部分
      return existingData.filter((k) => {
        const kTime = new Date(k.openTime).getTime();
        return kTime >= newStart && kTime <= newEnd;
      });
    }

    // 合并新旧数据
    const newDataArrays = await Promise.all(requests);
    const allData = [...existingData, ...newDataArrays.flat()].sort(
      (a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime()
    );

    // 去重（基于openTime）
    const uniqueData = allData.filter(
      (item, index, arr) =>
        index === 0 || item.openTime !== arr[index - 1].openTime
    );

    // 更新缓存
    const cacheKey = this.generateCacheKey({
      symbol,
      exchange,
      market,
      interval,
      startTime: newStartTime,
      endTime: newEndTime,
    });

    this.cache.set(cacheKey, {
      data: uniqueData,
      cachedAt: Date.now(),
      startTime: newStartTime,
      endTime: newEndTime,
    });

    return uniqueData.filter((k) => {
      const kTime = new Date(k.openTime).getTime();
      return kTime >= newStart && kTime <= newEnd;
    });
  }

  /**
   * 获取最新K线价格（用于浮动盈亏计算）
   */
  async getLatestPrice(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval?: string;
  }): Promise<number | null> {
    const exchange = params.exchange || "binance";
    const market = params.market || "futures";
    const interval = params.interval || "1m";

    // 离线模式：从缓存中读取最新值；在线模式：回退到最近1小时请求
    if (this.offlineMode) {
      const latestEnd = this.getCachedEndTime({
        symbol: params.symbol,
        exchange,
        market,
        interval,
      });
      if (!latestEnd) return null;
      const klines = this.getKlinesFromCache({
        symbol: params.symbol,
        exchange,
        market,
        interval,
        startTime: new Date(
          new Date(latestEnd).getTime() - 60 * 60 * 1000
        ).toISOString(),
        endTime: latestEnd,
        order: "desc",
      });
      return klines.length > 0 ? klines[0].close : null;
    }

    // 在线模式保持原行为
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
    const klines = await this.getKlines({
      symbol: params.symbol,
      exchange,
      market,
      interval,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      order: "desc",
    });
    return klines.length > 0 ? klines[0].close : null;
  }

  /**
   * 启动定期清理调度器
   */
  private startCleanupScheduler(): void {
    if (this.cleanupInterval || this.offlineMode) return;
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
      this.limitCacheSize();
      this.checkMemoryUsage();
    }, 5 * 60 * 1000);
  }

  /**
   * 启动定期刷新调度器
   */
  private startRefreshScheduler(): void {
    if (this.refreshInterval || this.offlineMode) return;
    // 每2分钟刷新一次最新的1分钟K线数据
    this.refreshInterval = setInterval(() => {
      this.refreshLatestData();
    }, 2 * 60 * 1000);
  }

  /**
   * 刷新最新数据
   * 针对接近当前时间的1分钟K线缓存进行更新
   */
  private async refreshLatestData(): Promise<void> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000; // 1小时前

    const toRefresh: { key: string; params: CacheKey }[] = [];

    // 找出需要刷新的缓存条目（1分钟K线且结束时间在1小时内）
    for (const [key, entry] of this.cache.entries()) {
      const keyParts = key.split(":");
      const interval = keyParts[3];

      if (interval === "1m") {
        const endTime = new Date(entry.endTime).getTime();
        if (endTime > oneHourAgo) {
          const [exchange, market, symbol, , startTime, endTimeStr] = keyParts;
          toRefresh.push({
            key,
            params: {
              exchange,
              market,
              symbol,
              interval,
              startTime,
              endTime: endTimeStr,
            },
          });
        }
      }
    }

    // 限制并发刷新数量
    const maxConcurrent = 5;
    for (let i = 0; i < toRefresh.length; i += maxConcurrent) {
      const batch = toRefresh.slice(i, i + maxConcurrent);
      await Promise.all(
        batch.map(async ({ key, params }) => {
          try {
            // 扩展到当前时间
            const newEndTime = new Date().toISOString();
            await this.extendTimeRange({
              symbol: params.symbol,
              exchange: params.exchange,
              market: params.market,
              interval: params.interval,
              newStartTime: params.startTime,
              newEndTime,
            });
          } catch (error) {
            console.warn(`刷新缓存失败 ${key}:`, error);
          }
        })
      );
    }

    if (toRefresh.length > 0) {
      console.log(`已刷新 ${toRefresh.length} 个K线缓存条目`);
    }
  }

  /**
   * 停止所有调度器
   */
  private stopSchedulers(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.inflightRequests.clear();
  }

  /**
   * 强制重置缓存服务到初始状态
   */
  forceReset(): void {
    this.cache.clear();
    this.inflightRequests.clear();
    this.datasetEndTime.clear();
    this.setOfflineMode(false);
    this.stopSchedulers();
    this.startCleanupScheduler();
    this.startRefreshScheduler();
    console.log("K线缓存服务已强制重置");
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    this.stopSchedulers();
    this.clearCache();
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    totalEntries: number;
    totalDataPoints: number;
    memoryUsageEstimate: string;
    offlineMode: boolean;
    inflightRequests: number;
  } {
    let totalDataPoints = 0;
    for (const entry of this.cache.values()) {
      totalDataPoints += entry.data.length;
    }

    // 粗略估算内存使用（每个K线数据点约200字节）
    const memoryBytes = totalDataPoints * 200;
    const memoryMB = (memoryBytes / (1024 * 1024)).toFixed(2);

    return {
      totalEntries: this.cache.size,
      totalDataPoints,
      memoryUsageEstimate: `${memoryMB} MB`,
      offlineMode: this.offlineMode,
      inflightRequests: this.inflightRequests.size,
    };
  }

  /**
   * 批量预热缓存
   * 根据交易数据预先加载所需的K线数据
   */
  async warmupCache(
    trades: Array<{
      symbol: string;
      exchange?: string;
      market?: string;
      openTime: string;
      closeTime: string;
    }>,
    intervals: string[] = ["1m"]
  ): Promise<void> {
    // 按symbol分组，合并时间范围
    const symbolRanges = new Map<
      string,
      {
        minStartTime: number;
        maxEndTime: number;
        exchange: string;
        market: string;
      }
    >();

    for (const trade of trades) {
      const key = `${trade.exchange || "binance"}:${
        trade.market || "futures"
      }:${trade.symbol}`;
      const startTime = new Date(trade.openTime).getTime();
      const endTime = new Date(trade.closeTime).getTime();

      const existing = symbolRanges.get(key);
      if (existing) {
        existing.minStartTime = Math.min(existing.minStartTime, startTime);
        existing.maxEndTime = Math.max(existing.maxEndTime, endTime);
      } else {
        symbolRanges.set(key, {
          minStartTime: startTime,
          maxEndTime: endTime,
          exchange: trade.exchange || "binance",
          market: trade.market || "futures",
        });
      }
    }

    // 为每个symbol和interval组合预加载数据
    const tasks: Promise<KlineData[]>[] = [];

    for (const [symbolKey, range] of symbolRanges.entries()) {
      const [exchange, market, symbol] = symbolKey.split(":");

      for (const interval of intervals) {
        tasks.push(
          this.getKlines({
            symbol,
            exchange,
            market,
            interval,
            startTime: new Date(range.minStartTime).toISOString(),
            endTime: new Date(range.maxEndTime).toISOString(),
          })
        );
      }
    }

    // 分批执行，避免过多并发
    const batchSize = 15;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      await Promise.all(batch);
    }
  }

  /**
   * 获取特定回合的K线数据（最常用的方法）
   */
  async getKlinesForRound(params: {
    roundId: string;
    symbol: string;
    exchange?: string;
    market?: string;
    interval?: string;
    openTime: string;
    closeTime: string;
  }): Promise<KlineData[]> {
    return this.getKlines({
      symbol: params.symbol,
      exchange: params.exchange || "binance",
      market: params.market || "futures",
      interval: params.interval || "1m",
      startTime: params.openTime,
      endTime: params.closeTime,
    });
  }

  /**
   * 获取某个 symbol 在缓存中的最大片段结束时间（如果存在）
   */
  getCachedEndTime(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval: string;
  }): string | null {
    const exchange = params.exchange || "binance";
    const market = params.market || "futures";
    // 先返回已缓存的数据集结束时间（来自数据库最新一根K线的时间）
    const endKey = this.generateSymbolKey({
      exchange,
      market,
      symbol: params.symbol,
      interval: params.interval,
    });
    const preset = this.datasetEndTime.get(endKey);
    if (preset) return preset;
    let latest: number | null = null;
    for (const [key, entry] of this.cache.entries()) {
      const [ex, mk, sym, interval] = key.split(":");
      if (
        ex !== exchange ||
        mk !== market ||
        sym !== params.symbol ||
        interval !== params.interval
      )
        continue;
      const end = new Date(entry.endTime).getTime();
      if (latest === null || end > latest) latest = end;
    }
    return latest ? new Date(latest).toISOString() : null;
  }

  /**
   * 设置/获取来自数据库的最新K线结束时间（外部明确指定）
   */
  setDatasetEndTime(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval: string;
    endTime: string;
  }): void {
    const key = this.generateSymbolKey({
      exchange: params.exchange || "binance",
      market: params.market || "futures",
      symbol: params.symbol,
      interval: params.interval,
    });
    this.datasetEndTime.set(key, params.endTime);
  }

  getDatasetEndTime(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval: string;
  }): string | null {
    const key = this.generateSymbolKey({
      exchange: params.exchange || "binance",
      market: params.market || "futures",
      symbol: params.symbol,
      interval: params.interval,
    });
    return this.datasetEndTime.get(key) || null;
  }

  /**
   * 调用后端一次，获取数据库中该 symbol 的最新 1 根 K 线的结束时间，并缓存下来
   */
  async fetchAndCacheLatestEndTime(params: {
    symbol: string;
    exchange?: string;
    market?: string;
    interval?: string;
    fallbackHours?: number; // 若后端需要时间范围，则使用回溯窗口
  }): Promise<string | null> {
    if (this.offlineMode)
      return this.getDatasetEndTime({
        symbol: params.symbol,
        exchange: params.exchange,
        market: params.market,
        interval: params.interval || "1m",
      });

    const exchange = params.exchange || "binance";
    const market = params.market || "futures";
    const interval = params.interval || "1m";
    const now = new Date();
    const endTime = now.toISOString();
    const hours = params.fallbackHours ?? 24;
    const startTime = new Date(
      now.getTime() - hours * 60 * 60 * 1000
    ).toISOString();

    try {
      const { data } = await cryptoApi.listKlines<{ data: KlineData[] }>({
        symbol: params.symbol,
        exchange,
        market,
        interval,
        startTime,
        endTime,
        order: "desc",
        limit: 1,
      });
      const last = (data || [])[0];
      const lastEnd = last?.closeTime || last?.openTime || null;
      if (lastEnd) {
        this.setDatasetEndTime({
          symbol: params.symbol,
          exchange,
          market,
          interval,
          endTime: lastEnd,
        });
      }
      return lastEnd;
    } catch {
      return null;
    }
  }
}

// 导出单例实例
export const klineCacheService = new KlineCacheService();

// 导出类型
export type { CacheKey };
