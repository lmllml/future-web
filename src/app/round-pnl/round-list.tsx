"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cryptoApi } from "@/lib/api";
import { RoundPnlData, KlineData } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface Props {
  symbol: string;
  minPnl?: number;
  maxPnl?: number;
  sort?: string;
}

function PnlBadge({ v }: { v: number }) {
  const positive = v > 0;
  return (
    <span
      className={`px-2 py-0.5 rounded text-sm ${
        positive
          ? "bg-green-600/15 text-green-600"
          : v < 0
          ? "bg-red-600/15 text-red-600"
          : "bg-muted text-foreground"
      }`}
    >
      {v.toFixed(4)}
    </span>
  );
}

async function fetchKlines(symbol: string, start: string, end: string) {
  const { data } = await cryptoApi.listKlines<{ data: KlineData[] }>({
    symbol,
    exchange: "binance",
    market: "futures",
    interval: "1h",
    startTime: start,
    endTime: end,
    order: "asc",
    limit: 1000,
  });
  return data;
}

interface RoundCardProps {
  r: RoundPnlData;
  index: number;
  symbol: string;
}

function RoundCard({ r, index, symbol }: RoundCardProps) {
  const [klines, setKlines] = useState<KlineData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKlines(symbol, r.openTime, r.closeTime)
      .then(setKlines)
      .finally(() => setLoading(false));
  }, [symbol, r.openTime, r.closeTime]);

  if (loading) {
    return (
      <div className="rounded border p-3 bg-card/40">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  let min = Math.min(...klines.map((k) => k.low));
  let max = Math.max(...klines.map((k) => k.high));
  const priceCandidates = [r.avgEntryPrice, r.avgExitPrice].filter(
    (v) => Number.isFinite(v)
  ) as number[];
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    if (priceCandidates.length) {
      min = Math.min(...priceCandidates) * 0.995;
      max = Math.max(...priceCandidates) * 1.005;
    } else {
      min = 0.9999;
      max = 1.0001;
    }
    if (min === max) max = min + 1e-8;
  }

  function x(ts: string) {
    return new Date(ts).getTime() - new Date(r.openTime).getTime();
  }
  const rawSpan =
    new Date(r.closeTime).getTime() - new Date(r.openTime).getTime();
  const span = rawSpan > 0 ? rawSpan : 1;
  function y(p: number) {
    const denom = max - min;
    if (!Number.isFinite(p) || !Number.isFinite(denom) || denom <= 0)
      return 50;
    return (1 - (p - min) / denom) * 80;
  }

  return (
    <div className="rounded border p-3 bg-card/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs bg-muted px-2 py-1 rounded font-mono">
            #{index + 1}
          </span>
          <span className="text-sm text-muted-foreground">
            {new Date(r.openTime).toLocaleString()} →{" "}
            {new Date(r.closeTime).toLocaleString()}
          </span>
          <PnlBadge v={r.realizedPnl} />
        </div>
        <div className="text-sm text-muted-foreground">
          Qty {r.totalQuantity.toFixed(4)} | Entry{" "}
          {r.avgEntryPrice.toFixed(4)} → Exit {r.avgExitPrice.toFixed(4)}
        </div>
      </div>

      <div className="mt-3">
        <svg viewBox={`0 0 600 100`} className="w-full h-[120px]">
          {/* K线简化渲染 */}
          {klines.length > 0 &&
            klines.map((k, i) => {
              const px = (x(k.openTime) / span) * 580 + 10;
              const lineY1 = y(k.low);
              const lineY2 = y(k.high);
              return (
                <line
                  key={i}
                  x1={px}
                  x2={px}
                  y1={lineY1}
                  y2={lineY2}
                  stroke="#94a3b8"
                  strokeWidth={1}
                />
              );
            })}
          {/* 若有 open/close 时间点，标注开关单价格位置 */}
          {Number.isFinite(r.avgEntryPrice) && (
            <circle cx={10} cy={y(r.avgEntryPrice)} r={3} fill="#16a34a" />
          )}
          {Number.isFinite(r.avgExitPrice) && (
            <circle cx={590} cy={y(r.avgExitPrice)} r={3} fill="#ef4444" />
          )}
        </svg>
      </div>

      <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-2">
        <span>openOrders:</span>
        <span className="truncate max-w-[65%]">
          {(r.openOrderIds || []).join(", ")}
        </span>
        <span>| closeOrders:</span>
        <span className="truncate max-w-[65%]">
          {(r.closeOrderIds || []).join(", ")}
        </span>
      </div>
    </div>
  );
}

export function RoundList({ symbol, minPnl, maxPnl, sort = "time-desc" }: Props) {
  const [rounds, setRounds] = useState<RoundPnlData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const observerRef = useRef<IntersectionObserver>();
  const lastElementRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await cryptoApi.listRoundPnl<{
        data: RoundPnlData[];
        total: number;
      }>({
        symbol,
        exchange: "binance",
        market: "futures",
        minPnl,
        maxPnl,
        sort,
        limit: 20,
        offset,
      });

      if (offset === 0) {
        // 首次加载或重新筛选
        setRounds(response.data);
      } else {
        // 追加加载
        setRounds(prev => [...prev, ...response.data]);
      }
      
      setTotal(response.total);
      setOffset(prev => prev + response.data.length);
      setHasMore(response.data.length === 20); // 如果返回数据少于limit，说明没有更多了
    } catch (error) {
      console.error("Failed to load rounds:", error);
    } finally {
      setLoading(false);
    }
  }, [symbol, minPnl, maxPnl, sort, offset, loading, hasMore]);

  // 重置状态并重新加载（筛选条件变化时）
  const resetAndLoad = useCallback(() => {
    setRounds([]);
    setOffset(0);
    setHasMore(true);
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    resetAndLoad();
  }, [symbol, minPnl, maxPnl, sort]);

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
      <div className="text-sm text-muted-foreground">
        {total}条数据 | 已显示 {rounds.length}条
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
