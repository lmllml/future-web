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
    minQuantity: parseAsString.withDefault(""),
    maxQuantity: parseAsString.withDefault(""),
    sort: parseAsString.withDefault("time-desc"),
    positionSide: parseAsString.withDefault(""),
    startTime: parseAsString.withDefault(""),
    endTime: parseAsString.withDefault(""),
  });

  // 将 ISO 字符串转换成本地 datetime-local 需要的格式（YYYY-MM-DDTHH:mm）
  function isoToLocalInput(value?: string): string {
    if (!value) return "";
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
  }

  // 将本地 datetime-local 字符串转换为 ISO（带 Z）
  function localInputToIso(value?: string): string {
    if (!value) return "";
    const d = new Date(value);
    return d.toISOString();
  }

  const [symbol, setSymbol] = useState(q.symbol || defaultSymbol);
  const [minPnl, setMinPnl] = useState<string>(q.minPnl ?? "");
  const [maxPnl, setMaxPnl] = useState<string>(q.maxPnl ?? "");
  const [minQuantity, setMinQuantity] = useState<string>(q.minQuantity ?? "");
  const [maxQuantity, setMaxQuantity] = useState<string>(q.maxQuantity ?? "");
  const [sort, setSort] = useState(q.sort || "time-desc");
  const [positionSide, setPositionSide] = useState(q.positionSide);
  const [startTime, setStartTime] = useState<string>(
    isoToLocalInput(q.startTime)
  );
  const [endTime, setEndTime] = useState<string>(isoToLocalInput(q.endTime));

  async function apply() {
    startTransition(async () => {
      await setQ({
        symbol,
        minPnl,
        maxPnl,
        minQuantity,
        maxQuantity,
        sort,
        positionSide,
        // 将本地时间转换为 ISO，确保后端以绝对时间解析
        startTime: localInputToIso(startTime),
        endTime: localInputToIso(endTime),
      });
      // 强制刷新服务端组件
      router.refresh();
    });
  }

  async function reset() {
    setSymbol(defaultSymbol);
    setMinPnl("");
    setMaxPnl("");
    setMinQuantity("");
    setMaxQuantity("");
    setSort("time-desc");
    setPositionSide("");
    setStartTime("");
    setEndTime("");
    startTransition(async () => {
      await setQ({
        symbol: defaultSymbol,
        minPnl: "",
        maxPnl: "",
        minQuantity: "",
        maxQuantity: "",
        sort: "time-desc",
        positionSide: "",
        startTime: "",
        endTime: "",
      });
      router.refresh();
    });
  }

  // 获取以8点为界的时间范围（返回本地 datetime-local 字符串）
  function getTimeRangeWith8Hour(dayOffset: number): [string, string] {
    const now = new Date();

    // 判断当前是否已过8点，决定交易日基准
    // 如果当前时间 < 8点，说明仍在昨天的交易日内
    const tradingDayOffset = now.getHours() < 8 ? -1 : 0;
    const actualDayOffset = dayOffset + tradingDayOffset;

    const startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + actualDayOffset,
      8,
      0,
      0
    );
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + actualDayOffset + 1,
      8,
      0,
      0
    );

    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const MM = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mm = pad(d.getMinutes());
      return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
    };

    return [fmt(startDate), fmt(endDate)];
  }

  function setToday() {
    const [start, end] = getTimeRangeWith8Hour(0);
    setStartTime(start);
    setEndTime(end);
  }

  function setYesterday() {
    const [start, end] = getTimeRangeWith8Hour(-1);
    setStartTime(start);
    setEndTime(end);
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
        <label className="text-xs text-muted-foreground">Min 成交量</label>
        <input
          inputMode="decimal"
          value={minQuantity}
          onChange={(e) => setMinQuantity(e.target.value)}
          className="h-9 w-28 rounded border px-2 text-sm"
          placeholder="e.g. 0.1"
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">Max 成交量</label>
        <input
          inputMode="decimal"
          value={maxQuantity}
          onChange={(e) => setMaxQuantity(e.target.value)}
          className="h-9 w-28 rounded border px-2 text-sm"
          placeholder="e.g. 10"
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">方向</label>
        <select
          value={positionSide}
          onChange={(e) => setPositionSide(e.target.value)}
          className="h-9 w-24 rounded border px-2 text-sm"
          disabled={isPending}
        >
          <option value="">全部</option>
          <option value="LONG">多单</option>
          <option value="SHORT">空单</option>
        </select>
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
          <option value="ratio-desc">盈亏率 ↓</option>
          <option value="ratio-asc">盈亏率 ↑</option>
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">时间范围</label>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-9 w-44 rounded border px-2 text-sm"
            disabled={isPending}
            placeholder="开始时间"
          />
          <span className="flex items-center text-sm text-muted-foreground">
            至
          </span>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-9 w-44 rounded border px-2 text-sm"
            disabled={isPending}
            placeholder="结束时间"
          />
        </div>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">快捷选择</label>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={setYesterday}
            disabled={isPending}
            className="h-9 px-3 text-xs"
          >
            昨天
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={setToday}
            disabled={isPending}
            className="h-9 px-3 text-xs"
          >
            今天
          </Button>
        </div>
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
