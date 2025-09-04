"use client";

import { useState, useTransition } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BacktestStatus } from "@/lib/types";

export function FilterBar() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [q, setQ] = useQueryStates({
    name: parseAsString.withDefault(""),
    symbol: parseAsString.withDefault(""),
    status: parseAsString.withDefault(""),
    strategyType: parseAsString.withDefault(""),
    startTime: parseAsString.withDefault(""),
    endTime: parseAsString.withDefault(""),
    sort: parseAsString.withDefault("createdAt-desc"),
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

  const [name, setName] = useState(q.name || "");
  const [symbol, setSymbol] = useState(q.symbol || "");
  const [status, setStatus] = useState(q.status || "");
  const [strategyType, setStrategyType] = useState(q.strategyType || "");
  const [sort, setSort] = useState(q.sort || "createdAt-desc");
  const [startTime, setStartTime] = useState<string>(isoToLocalInput(q.startTime));
  const [endTime, setEndTime] = useState<string>(isoToLocalInput(q.endTime));

  async function apply() {
    startTransition(async () => {
      await setQ({
        name,
        symbol,
        status,
        strategyType,
        sort,
        startTime: localInputToIso(startTime),
        endTime: localInputToIso(endTime),
      });
      router.refresh();
    });
  }

  async function reset() {
    setName("");
    setSymbol("");
    setStatus("");
    setStrategyType("");
    setSort("createdAt-desc");
    setStartTime("");
    setEndTime("");
    startTransition(async () => {
      await setQ({
        name: "",
        symbol: "",
        status: "",
        strategyType: "",
        sort: "createdAt-desc",
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
  
  function set7Days() {
    const [start] = getTimeRangeWith8Hour(-7);
    const [_, end] = getTimeRangeWith8Hour(0);
    setStartTime(start);
    setEndTime(end);
  }
  
  function set14Days() {
    const [start] = getTimeRangeWith8Hour(-14);
    const [_, end] = getTimeRangeWith8Hour(0);
    setStartTime(start);
    setEndTime(end);
  }
  
  function set30Days() {
    const [start] = getTimeRangeWith8Hour(-30);
    const [_, end] = getTimeRangeWith8Hour(0);
    setStartTime(start);
    setEndTime(end);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 w-40 rounded border px-2 text-sm"
          placeholder="回测名称"
          disabled={isPending}
        />
      </div>
      
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
        <label className="text-xs text-muted-foreground">状态</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 w-28 rounded border px-2 text-sm"
          disabled={isPending}
        >
          <option value="">全部</option>
          <option value={BacktestStatus.PENDING}>待执行</option>
          <option value={BacktestStatus.RUNNING}>执行中</option>
          <option value={BacktestStatus.COMPLETED}>已完成</option>
          <option value={BacktestStatus.FAILED}>失败</option>
          <option value={BacktestStatus.CANCELLED}>已取消</option>
        </select>
      </div>
      
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">策略类型</label>
        <select
          value={strategyType}
          onChange={(e) => setStrategyType(e.target.value)}
          className="h-9 w-32 rounded border px-2 text-sm"
          disabled={isPending}
        >
          <option value="">全部</option>
          <option value="FOLLOW_TRADES">跟随交易</option>
        </select>
      </div>
      
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">排序</label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-9 w-36 rounded border px-2 text-sm"
          disabled={isPending}
        >
          <option value="createdAt-desc">创建时间 ↓</option>
          <option value="createdAt-asc">创建时间 ↑</option>
          <option value="netPnl-desc">净收益 ↓</option>
          <option value="netPnl-asc">净收益 ↑</option>
          <option value="totalReturn-desc">收益率 ↓</option>
          <option value="totalReturn-asc">收益率 ↑</option>
          <option value="sharpeRatio-desc">夏普比率 ↓</option>
          <option value="sharpeRatio-asc">夏普比率 ↑</option>
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
          <Button
            variant="outline"
            size="sm"
            onClick={set7Days}
            disabled={isPending}
            className="h-9 px-3 text-xs"
          >
            近7天
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={set14Days}
            disabled={isPending}
            className="h-9 px-3 text-xs"
          >
            近14天
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={set30Days}
            disabled={isPending}
            className="h-9 px-3 text-xs"
          >
            近30天
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
