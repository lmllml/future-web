"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cryptoApi } from "@/lib/api";
import { RoundPnlData } from "@/lib/types";
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

function PositionSideBadge({ side }: { side: "LONG" | "SHORT" }) {
  const isLong = side === "LONG";
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        isLong
          ? "bg-blue-600/15 text-blue-600"
          : "bg-orange-600/15 text-orange-600"
      }`}
    >
      {isLong ? "多单" : "空单"}
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
  return (
    <div className="rounded border p-3 bg-card/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs bg-muted px-2 py-1 rounded font-mono">
            #{index + 1}
          </span>
          <PositionSideBadge side={r.positionSide} />
          <span className="text-sm text-muted-foreground">
            {new Date(r.openTime).toLocaleString()} →{" "}
            {new Date(r.closeTime).toLocaleString()}
          </span>
          <PnlBadge v={r.realizedPnl} />
        </div>
        <div className="text-sm text-muted-foreground">
          Qty {r.totalQuantity.toFixed(4)} | Entry {r.avgEntryPrice.toFixed(4)}{" "}
          → Exit {r.avgExitPrice.toFixed(4)}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
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
}: Props) {
  const [rounds, setRounds] = useState<RoundPnlData[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPnl, setTotalPnl] = useState(0);
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
    loading,
  ]);

  useEffect(() => {
    resetAndLoad();
  }, [symbol, minPnl, maxPnl, minQuantity, maxQuantity, sort, positionSide]);

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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">总盈亏:</span>
            <span
              className={`px-3 py-1 rounded text-base font-semibold ${
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
