"use client";

import { FilterBar } from "./filter-bar";
import { BacktestList } from "./backtest-list";

export default function BacktestPage({
  searchParams,
}: {
  searchParams: {
    name?: string;
    symbol?: string;
    status?: string;
    strategyType?: string;
    startTime?: string;
    endTime?: string;
    sort?: string;
  };
}) {
  const name = searchParams.name || "";
  const symbol = searchParams.symbol || "";
  const status = searchParams.status || "";
  const strategyType = searchParams.strategyType || "";  
  const startTime = searchParams.startTime || "";
  const endTime = searchParams.endTime || "";
  const sort = searchParams.sort || "createdAt-desc";

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">回测记录</h2>
      </div>
      
      <FilterBar />
      
      <BacktestList
        name={name}
        symbol={symbol}
        status={status}
        strategyType={strategyType}
        startTime={startTime}
        endTime={endTime}
        sort={sort}
      />
    </div>
  );
}
