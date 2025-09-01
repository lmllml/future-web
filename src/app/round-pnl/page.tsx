"use client";

import { useEffect } from "react";
import { FilterBar } from "./filter-bar";
import { RoundList } from "./round-list";
import { AnalysisSidebar } from "./analysis-sidebar";
import { CacheStatus } from "@/components/cache-status";
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
    positionSide?: string;
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
  const positionSide =
    searchParams.positionSide === "LONG" ||
    searchParams.positionSide === "SHORT"
      ? searchParams.positionSide
      : "ALL";

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
        // 预加载从筛选开始时间到当前时间的K线数据
        const extendedEndTime = new Date().toISOString();

        await klineCacheService.preloadKlines({
          symbols: [symbol],
          exchange: "binance",
          market: "futures",
          intervals: ["1m", "5m", "15m", "1h"], // 预加载多个时间周期
          startTime,
          endTime: extendedEndTime,
        });

        console.log(
          `已预加载 ${symbol} 的K线数据 (${startTime} - ${extendedEndTime})`
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
    </div>
  );
}
