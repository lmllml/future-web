import { FilterBar } from "./filter-bar";
import { RoundList } from "./round-list";

export default function RoundPnlPage({
  searchParams,
}: {
  searchParams: {
    symbol?: string;
    minPnl?: string;
    maxPnl?: string;
    sort?: string;
  };
}) {
  const symbol = searchParams.symbol || "ETHUSDC";
  const toNum = (v?: string) =>
    v === undefined || v === "" ? undefined : Number(v);
  const minPnl = toNum(searchParams.minPnl);
  const maxPnl = toNum(searchParams.maxPnl);
  const sort =
    typeof searchParams.sort === "string" && searchParams.sort
      ? searchParams.sort
      : "time-desc";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">回合级盈亏（{symbol}）</h2>
      </div>
      <FilterBar defaultSymbol={symbol} />
      <RoundList symbol={symbol} minPnl={minPnl} maxPnl={maxPnl} sort={sort} />
    </div>
  );
}
