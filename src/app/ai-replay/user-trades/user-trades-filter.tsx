"use client";

import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { useEffect, useState } from "react";

export type UserTradeParams = {
  symbol: string;
  exchange: string;
  market: string;
  accountId: string;
  startTime: string;
  endTime: string;
  limit: number;
  order: string;
};

export function UserTradesFilter({
  onSubmit,
}: {
  onSubmit: (params: UserTradeParams) => void;
}) {
  const [symbol, setSymbol] = useQueryState(
    "symbol",
    parseAsString.withDefault("ETHUSDC")
  );
  const [exchange, setExchange] = useQueryState(
    "exchange",
    parseAsString.withDefault("binance")
  );
  const [market, setMarket] = useQueryState(
    "market",
    parseAsString.withDefault("futures")
  );
  const [accountId, setAccountId] = useQueryState(
    "accountId",
    parseAsString.withDefault("binance_lyd")
  );
  const [startTime, setStartTime] = useQueryState(
    "startTime",
    parseAsString.withDefault("")
  );
  const [endTime, setEndTime] = useQueryState(
    "endTime",
    parseAsString.withDefault("")
  );
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(500)
  );
  const [order, setOrder] = useQueryState(
    "order",
    parseAsString.withDefault("asc")
  );

  const [symbolOptions] = useState<string[]>(["ETHUSDC"]);

  function submit() {
    onSubmit({
      symbol,
      exchange,
      market,
      accountId,
      startTime,
      endTime,
      limit,
      order,
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid grid-cols-1 gap-3 md:grid-cols-4"
    >
      <Select.Root
        value={symbol || ""}
        onValueChange={(v) => setSymbol(v || null)}
      >
        <Select.Trigger className="flex h-9 items-center justify-between rounded-md border px-3">
          <Select.Value placeholder="交易对(如 BTCUSDT)" />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Content className="z-50 rounded-md border bg-background p-1 shadow-md">
          <Select.Viewport className="max-h-64 min-w-[200px] overflow-auto">
            {symbolOptions.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">加载中…</div>
            ) : (
              symbolOptions.map((s) => (
                <Select.Item
                  key={s}
                  value={s}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                >
                  <Select.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{s}</Select.ItemText>
                </Select.Item>
              ))
            )}
          </Select.Viewport>
        </Select.Content>
      </Select.Root>
      <Select.Root
        value={exchange || "binance"}
        onValueChange={(v) => setExchange(v || null)}
      >
        <Select.Trigger className="flex h-9 items-center justify-between rounded-md border px-3">
          <Select.Value placeholder="交易所" />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Content className="z-50 rounded-md border bg-background p-1 shadow-md">
          <Select.Viewport className="min-w-[200px] overflow-auto">
            <Select.Item
              value="binance"
              className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            >
              <Select.ItemIndicator>
                <Check className="h-4 w-4" />
              </Select.ItemIndicator>
              <Select.ItemText>binance</Select.ItemText>
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Root>
      <Select.Root
        value={market || "futures"}
        onValueChange={(v) => setMarket(v || null)}
      >
        <Select.Trigger className="flex h-9 items-center justify-between rounded-md border px-3">
          <Select.Value placeholder="市场" />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Content className="z-50 rounded-md border bg-background p-1 shadow-md">
          <Select.Viewport className="min-w-[200px] overflow-auto">
            <Select.Item
              value="spot"
              className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            >
              <Select.ItemIndicator>
                <Check className="h-4 w-4" />
              </Select.ItemIndicator>
              <Select.ItemText>spot</Select.ItemText>
            </Select.Item>
            <Select.Item
              value="futures"
              className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            >
              <Select.ItemIndicator>
                <Check className="h-4 w-4" />
              </Select.ItemIndicator>
              <Select.ItemText>futures</Select.ItemText>
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Root>
      <input
        className="h-9 rounded-md border px-3 text-muted-foreground"
        value={"binance_lyd"}
        readOnly
        aria-readonly
      />
      <input
        type="datetime-local"
        className="h-9 rounded-md border px-3"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
      />
      <input
        type="datetime-local"
        className="h-9 rounded-md border px-3"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
      />
      <input
        type="number"
        className="h-9 rounded-md border px-3"
        placeholder="limit(默认500)"
        value={limit ?? ""}
        onChange={(e) =>
          setLimit(e.target.value ? Number(e.target.value) : null)
        }
      />
      <select
        className="h-9 rounded-md border px-3"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
      >
        <option value="asc">升序</option>
        <option value="desc">降序</option>
      </select>

      <div className="md:col-span-4">
        <Button type="button" onClick={submit}>
          查询
        </Button>
      </div>
    </form>
  );
}
