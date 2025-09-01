"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cryptoApi } from "@/lib/api";
import { klineCacheService } from "@/lib/kline-cache";
import { RoundPnlData, KlineData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { KlineDialog } from "@/components/charts/kline-dialog";

interface Props {
  symbol: string;
  minPnl?: number;
  maxPnl?: number;
  minQuantity?: number;
  maxQuantity?: number;
  sort?: string;
  positionSide?: "LONG" | "SHORT" | "ALL";
  startTime?: string;
  endTime?: string;
}

function PnlBadge({ v }: { v: number }) {
  const positive = v > 0;
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium h-6 ${
        positive
          ? "bg-green-600/20 text-green-700"
          : v < 0
          ? "bg-red-600/20 text-red-700"
          : "bg-muted text-foreground"
      }`}
    >
      盈利: {v.toFixed(4)}
    </span>
  );
}

function RatioBadge({
  realizedPnl,
  quantity,
  avgEntryPrice,
  leverage = 1,
}: {
  realizedPnl: number;
  quantity: number;
  avgEntryPrice: number;
  leverage?: number;
}) {
  const openAmount = quantity * avgEntryPrice; // 开单金额
  const margin = openAmount / leverage; // 实际保证金 = 开单金额 / 杠杆倍数
  const ratioPercent = margin > 0 ? (realizedPnl / margin) * 100 : 0;
  const positive = ratioPercent > 0;
  const formatted = Number.isFinite(ratioPercent)
    ? ratioPercent.toFixed(2)
    : "0.00";

  return (
    <span
      title={`盈亏比例 (盈亏/保证金) | 杠杆: ${leverage}x | 保证金: ${margin.toFixed(
        2
      )}`}
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium h-6 ${
        positive
          ? "bg-green-600/15 text-green-700"
          : ratioPercent < 0
          ? "bg-red-600/15 text-red-700"
          : "bg-muted text-foreground"
      }`}
    >
      盈亏率: {formatted}%
    </span>
  );
}

function PositionSideBadge({ side }: { side: "LONG" | "SHORT" }) {
  const isLong = side === "LONG";
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium h-6 ${
        isLong
          ? "bg-blue-600/20 text-blue-700"
          : "bg-orange-600/20 text-orange-700"
      }`}
    >
      {isLong ? "多单" : "空单"}
    </span>
  );
}

// 最大浮亏组件
function MaxDrawdownBadge({ round }: { round: RoundPnlData }) {
  const [maxDrawdown, setMaxDrawdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const calculateMaxDrawdown = async () => {
      setLoading(true);
      try {
        // 使用缓存服务获取交易期间的K线数据（使用1分钟K线获得更精确的价格数据）
        const data = await klineCacheService.getKlinesForRound({
          roundId: round.roundId,
          symbol: round.symbol,
          exchange: round.exchange || "binance",
          market: "futures",
          interval: "1m",
          openTime: round.openTime,
          closeTime: round.closeTime,
        });

        if (!data || data.length === 0) {
          setMaxDrawdown(null);
          return;
        }

        let worstPrice: number;
        if (round.positionSide === "LONG") {
          // 多单：找最低价
          worstPrice = Math.min(...data.map((k) => k.low));
          // 最大损失 = (开仓价 - 最低价) * 数量
          const drawdown =
            (round.avgEntryPrice - worstPrice) * round.totalQuantity;
          setMaxDrawdown(Math.max(0, drawdown)); // 确保不为负数
        } else {
          // 空单：找最高价
          worstPrice = Math.max(...data.map((k) => k.high));
          // 最大损失 = (最高价 - 开仓价) * 数量
          const drawdown =
            (worstPrice - round.avgEntryPrice) * round.totalQuantity;
          setMaxDrawdown(Math.max(0, drawdown)); // 确保不为负数
        }
      } catch (error) {
        console.error("计算最大浮亏失败:", error);
        setMaxDrawdown(null);
      } finally {
        setLoading(false);
      }
    };

    calculateMaxDrawdown();
  }, [round]);

  if (loading) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 animate-pulse h-6">
        计算中...
      </span>
    );
  }

  if (maxDrawdown === null) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 h-6">
        无数据
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-600/15 text-red-700 h-6"
      title={`交易期间遭受的最大未实现亏损（最大浮亏）`}
    >
      最大浮亏: {maxDrawdown.toFixed(4)}
    </span>
  );
}

// fetchKlines 函数已移除，KlineDialog 会自己获取数据

interface RoundCardProps {
  r: RoundPnlData;
  index: number;
  symbol: string;
}

function RoundCard({ r, index, symbol }: RoundCardProps) {
  // 计算持仓时间
  const openTime = new Date(r.openTime);
  const closeTime = new Date(r.closeTime);
  const durationMs = closeTime.getTime() - openTime.getTime();

  // 格式化持仓时长
  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // 提取基础货币单位
  const getQuoteCurrency = (symbol: string): string => {
    if (symbol.endsWith("USDC")) return "USDC";
    if (symbol.endsWith("USDT")) return "USDT";
    if (symbol.endsWith("BUSD")) return "BUSD";
    if (symbol.endsWith("BTC")) return "BTC";
    if (symbol.endsWith("ETH")) return "ETH";
    return "USDC"; // 默认
  };

  const quoteCurrency = getQuoteCurrency(symbol);
  const leverage = r.leverage ?? 5;

  // 计算保证金（开单金额除以杠杆）
  const openAmount = (r.totalQuantity * r.avgEntryPrice) / leverage;

  return (
    <div className="rounded-lg border border-slate-200 p-4 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs bg-muted/80 px-2 py-1 rounded font-mono text-muted-foreground">
            #{index + 1}
          </span>
          <PositionSideBadge side={r.positionSide} />
          <span className="text-sm text-muted-foreground">
            {openTime.toLocaleString()} → {closeTime.toLocaleString()}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">数量:</span>{" "}
          <span className="font-mono font-semibold text-slate-700">
            {r.totalQuantity.toFixed(4)}
          </span>
          <span className="mx-2 text-muted-foreground">|</span>
          <span className="text-muted-foreground">开仓:</span>{" "}
          <span className="font-mono font-semibold text-slate-700">
            {r.avgEntryPrice.toFixed(4)}
          </span>
          <span className="mx-2 text-muted-foreground">→</span>
          <span className="text-muted-foreground">平仓:</span>{" "}
          <span className="font-mono font-semibold text-slate-700">
            {r.avgExitPrice.toFixed(4)}
          </span>
        </div>
      </div>

      {/* 保证金和杠杆信息行 */}
      <div className="mt-2.5 flex items-center gap-5 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium">保证金:</span>
          <span className="font-mono font-semibold text-slate-800">
            {openAmount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="text-xs text-muted-foreground font-medium bg-slate-100 px-1.5 py-0.5 rounded">
            {quoteCurrency}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-medium">杠杆:</span>
          <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
            {leverage}x
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex justify-between items-center">
        <div className="flex items-center gap-3 flex-wrap">
          <PnlBadge v={r.realizedPnl} />
          <MaxDrawdownBadge round={r} />
          <RatioBadge
            realizedPnl={r.realizedPnl}
            quantity={r.totalQuantity}
            avgEntryPrice={r.avgEntryPrice}
            leverage={r.leverage || 5} // 默认使用 5 倍杠杆，如果数据中没有杠杆信息
          />
          <span className="inline-flex items-center text-xs bg-blue-600/15 text-blue-700 px-2 py-1 rounded font-medium h-6">
            持仓: {formatDuration(durationMs)}
          </span>
        </div>
        <KlineDialog round={r} />
      </div>

      {/* 订单ID信息不再展示 */}
    </div>
  );
}

export function RoundList({
  symbol,
  minPnl,
  maxPnl,
  minQuantity,
  maxQuantity,
  sort = "time-desc",
  positionSide = "ALL",
  startTime,
  endTime,
}: Props) {
  const [rounds, setRounds] = useState<RoundPnlData[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPnl, setTotalPnl] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // 计算平均盈利率和平均亏损率
  const { avgProfitRatio, avgLossRatio } = useMemo(() => {
    if (rounds.length === 0) return { avgProfitRatio: 0, avgLossRatio: 0 };

    let profitRatioSum = 0; // 盈利率总和
    let lossRatioSum = 0; // 亏损率总和
    let profitCount = 0; // 盈利交易笔数
    let lossCount = 0; // 亏损交易笔数

    rounds.forEach((round) => {
      const leverage = round.leverage ?? 5; // 与 RatioBadge 保持一致
      const openAmount = round.totalQuantity * round.avgEntryPrice; // 开单金额
      const margin = leverage > 0 ? openAmount / leverage : 0; // 保证金
      if (margin > 0) {
        const singlePnlRatio = (round.realizedPnl / margin) * 100;
        if (singlePnlRatio > 0) {
          // 盈利交易
          profitRatioSum += singlePnlRatio;
          profitCount++;
        } else if (singlePnlRatio < 0) {
          // 亏损交易
          lossRatioSum += Math.abs(singlePnlRatio); // 取绝对值
          lossCount++;
        }
      }
    });

    return {
      avgProfitRatio: profitCount > 0 ? profitRatioSum / profitCount : 0,
      avgLossRatio: lossCount > 0 ? lossRatioSum / lossCount : 0,
    };
  }, [rounds]);

  const observerRef = useRef<IntersectionObserver>();
  const lastElementRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await cryptoApi.listRoundPnl<{
        data: RoundPnlData[];
        total: number;
        totalPnl: number;
      }>({
        symbol,
        exchange: "binance",
        market: "futures",
        minPnl,
        maxPnl,
        minQuantity,
        maxQuantity,
        sort,
        limit: 20,
        offset,
        positionSide: positionSide === "ALL" ? undefined : positionSide,
        startTime,
        endTime,
      });

      if (offset === 0) {
        // 首次加载或重新筛选
        setRounds(response.data);
        setTotalPnl(response.totalPnl); // 设置总盈亏
      } else {
        // 追加加载
        setRounds((prev) => [...prev, ...response.data]);
        // 追加加载时不更新总盈亏，因为总盈亏是全量数据的
      }

      setTotal(response.total);
      setOffset((prev) => prev + response.data.length);
      setHasMore(response.data.length === 20); // 如果返回数据少于limit，说明没有更多了
    } catch (error) {
      console.error("Failed to load rounds:", error);
    } finally {
      setLoading(false);
    }
  }, [
    symbol,
    minPnl,
    maxPnl,
    minQuantity,
    maxQuantity,
    sort,
    positionSide,
    startTime,
    endTime,
    offset,
    loading,
    hasMore,
  ]);

  // 重置状态并重新加载（筛选条件变化时）
  const resetAndLoad = useCallback(async () => {
    setRounds([]);
    setTotal(0);
    setTotalPnl(0);
    setOffset(0);
    setHasMore(true);

    // 使用 offset=0 直接加载，不依赖状态更新
    if (loading) return;

    setLoading(true);
    try {
      const response = await cryptoApi.listRoundPnl<{
        data: RoundPnlData[];
        total: number;
        totalPnl: number;
      }>({
        symbol,
        exchange: "binance",
        market: "futures",
        minPnl,
        maxPnl,
        minQuantity,
        maxQuantity,
        sort,
        limit: 20,
        offset: 0, // 强制从 0 开始
        positionSide: positionSide === "ALL" ? undefined : positionSide,
        startTime,
        endTime,
      });

      setRounds(response.data);
      setTotal(response.total);
      setTotalPnl(response.totalPnl); // 设置总盈亏
      setOffset(response.data.length);
      setHasMore(response.data.length === 20);
    } catch (error) {
      console.error("Failed to load rounds:", error);
    } finally {
      setLoading(false);
    }
  }, [
    symbol,
    minPnl,
    maxPnl,
    minQuantity,
    maxQuantity,
    sort,
    positionSide,
    startTime,
    endTime,
    loading,
  ]);

  useEffect(() => {
    resetAndLoad();
  }, [
    symbol,
    minPnl,
    maxPnl,
    minQuantity,
    maxQuantity,
    sort,
    positionSide,
    startTime,
    endTime,
  ]);

  // 设置intersection observer
  useEffect(() => {
    if (loading) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (lastElementRef.current) {
      observerRef.current.observe(lastElementRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loading, hasMore, loadMore]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total}条数据 | 已显示 {rounds.length}条
        </div>
        {rounds.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">总盈亏:</span>
              <span
                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium h-6 ${
                  totalPnl > 0
                    ? "bg-green-600/20 text-green-600"
                    : totalPnl < 0
                    ? "bg-red-600/20 text-red-600"
                    : "bg-muted text-foreground"
                }`}
              >
                {totalPnl.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">平均盈利率:</span>
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium h-6 bg-green-600/20 text-green-600">
                  {avgProfitRatio.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">平均亏损率:</span>
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium h-6 bg-red-600/20 text-red-600">
                  {avgLossRatio.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {rounds.map((r, index) => (
          <RoundCard key={r.roundId} r={r} index={index} symbol={symbol} />
        ))}
      </div>

      {hasMore && (
        <div ref={lastElementRef} className="py-4 text-center">
          {loading ? (
            <div className="animate-pulse text-muted-foreground">加载中...</div>
          ) : (
            <Button variant="outline" onClick={loadMore}>
              加载更多
            </Button>
          )}
        </div>
      )}

      {!hasMore && rounds.length > 0 && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          已显示全部数据
        </div>
      )}
    </div>
  );
}
