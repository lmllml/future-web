"use client";

import { useEffect } from "react";
import { FilterBar } from "./filter-bar";
import { RoundList } from "./round-list";
import { AnalysisSidebar } from "./analysis-sidebar";
import { CacheStatus } from "@/components/cache-status";
import { KlineDebugger } from "@/components/debug/kline-debugger";
import { klineCacheService } from "@/lib/kline-cache";

export default function RoundPnlPage({
  searchParams,
}: {
  searchParams: {
    symbol?: string;
    minPnl?: string;
    maxPnl?: string;
    minQuantity?: string;
    maxQuantity?: string;
    sort?: string;
    positionSide?: "LONG" | "SHORT";
    startTime?: string;
    endTime?: string;
  };
}) {
  const symbol = searchParams.symbol || "ETHUSDC";
  const toNum = (v?: string) =>
    v === undefined || v === "" ? undefined : Number(v);
  const minPnl = toNum(searchParams.minPnl);
  const maxPnl = toNum(searchParams.maxPnl);
  const minQuantity = toNum(searchParams.minQuantity);
  const maxQuantity = toNum(searchParams.maxQuantity);
  const sort =
    typeof searchParams.sort === "string" && searchParams.sort
      ? searchParams.sort
      : "time-desc";
  const positionSide = searchParams.positionSide;

  const startTime =
    searchParams.startTime && searchParams.startTime !== ""
      ? searchParams.startTime
      : undefined;
  const endTime =
    searchParams.endTime && searchParams.endTime !== ""
      ? searchParams.endTime
      : undefined;

  // 预加载K线数据，当筛选条件变化时
  useEffect(() => {
    const preloadKlines = async () => {
      if (!symbol || !startTime || !endTime) return;

      try {
        // 切换到在线模式以允许预加载一次
        klineCacheService.setOfflineMode(false);
        // 清空旧缓存，避免混入其他 symbol/interval 的数据
        klineCacheService.clearCache();

        // 先请求数据库最新一根 1m k 线的结束时间，并缓存
        const dbLast = await klineCacheService.fetchAndCacheLatestEndTime({
          symbol,
          exchange: "binance",
          market: "futures",
          interval: "1m",
          fallbackHours: 48,
        });
        const endAt = dbLast || new Date().toISOString();

        await klineCacheService.preloadKlines({
          symbols: [symbol],
          exchange: "binance",
          market: "futures",
          intervals: ["1m"],
          startTime,
          endTime: endAt,
        });

        // 预加载完成后，进入离线模式：后续前端计算仅使用这份数据，不再发起网络请求
        klineCacheService.setOfflineMode(true);

        console.log(
          `已预加载 ${symbol} 的 1m K线数据 (${startTime} - ${endAt})，进入离线模式`
        );
      } catch (error) {
        console.warn("预加载K线数据失败:", error);
      }
    };

    // 延迟执行，避免阻塞页面渲染
    const timer = setTimeout(preloadKlines, 100);
    return () => clearTimeout(timer);
  }, [symbol, startTime, endTime]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">回合级盈亏（{symbol}）</h2>
      </div>
      <FilterBar defaultSymbol={symbol} />
      <div className="flex gap-6">
        {/* 主内容区域 */}
        <div className="flex-1">
          <RoundList
            symbol={symbol}
            minPnl={minPnl}
            maxPnl={maxPnl}
            minQuantity={minQuantity}
            maxQuantity={maxQuantity}
            sort={sort}
            positionSide={positionSide}
            startTime={startTime}
            endTime={endTime}
          />
        </div>

        {/* 分析侧边栏 */}
        <AnalysisSidebar
          exchange="binance"
          market="futures"
          symbol={symbol}
          minPnl={minPnl}
          maxPnl={maxPnl}
          minQuantity={minQuantity}
          maxQuantity={maxQuantity}
          positionSide={positionSide}
          startTime={startTime}
          endTime={endTime}
        />
      </div>

      {/* 缓存状态组件 */}
      <CacheStatus />
      <KlineDebugger />
    </div>
  );
}
