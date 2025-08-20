"use client";

import { useState, useTransition } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  defaultSymbol: string;
}

export function FilterBar({ defaultSymbol }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [q, setQ] = useQueryStates({
    symbol: parseAsString.withDefault(defaultSymbol),
    minPnl: parseAsString.withDefault(""),
    maxPnl: parseAsString.withDefault(""),
    sort: parseAsString.withDefault("time-desc"),
  });

  const [symbol, setSymbol] = useState(q.symbol || defaultSymbol);
  const [minPnl, setMinPnl] = useState<string>(q.minPnl ?? "");
  const [maxPnl, setMaxPnl] = useState<string>(q.maxPnl ?? "");
  const [sort, setSort] = useState(q.sort || "time-desc");

  async function apply() {
    startTransition(async () => {
      await setQ({ symbol, minPnl, maxPnl, sort });
      // 强制刷新服务端组件
      router.refresh();
    });
  }

  async function reset() {
    setSymbol(defaultSymbol);
    setMinPnl("");
    setMaxPnl("");
    setSort("time-desc");
    startTransition(async () => {
      await setQ({
        symbol: defaultSymbol,
        minPnl: "",
        maxPnl: "",
        sort: "time-desc",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">Symbol</label>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="h-9 w-32 rounded border px-2 text-sm"
          placeholder="ETHUSDC"
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">Min PnL</label>
        <input
          inputMode="decimal"
          value={minPnl}
          onChange={(e) => setMinPnl(e.target.value)}
          className="h-9 w-28 rounded border px-2 text-sm"
          placeholder="e.g. -50"
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">Max PnL</label>
        <input
          inputMode="decimal"
          value={maxPnl}
          onChange={(e) => setMaxPnl(e.target.value)}
          className="h-9 w-28 rounded border px-2 text-sm"
          placeholder="e.g. 500"
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">Sort</label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-9 w-36 rounded border px-2 text-sm"
          disabled={isPending}
        >
          <option value="time-desc">Time ↓</option>
          <option value="time-asc">Time ↑</option>
          <option value="pnl-desc">PnL ↓</option>
          <option value="pnl-asc">PnL ↑</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button onClick={apply} disabled={isPending}>
          {isPending ? "应用中..." : "应用"}
        </Button>
        <Button variant="outline" onClick={reset} disabled={isPending}>
          重置
        </Button>
      </div>
    </div>
  );
}
