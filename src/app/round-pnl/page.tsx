"use client";

import { FilterBar } from "./filter-bar";
import { RoundList } from "./round-list";
import { AnalysisSidebar } from "./analysis-sidebar";

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
        />
      </div>
    </div>
  );
}
