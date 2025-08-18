"use client";
import { Suspense } from "react";
import { UserTradeParams, UserTradesFilter } from "./user-trades-filter";
import { getCryptoJson } from "@/lib/api";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface UserTrade {
  id?: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  commission?: number;
  time: string;
}

async function fetchUserTrades(
  searchParams: UserTradeParams
): Promise<UserTrade[]> {
  console.log("fetchUserTrades", searchParams);
  const json = await getCryptoJson<{ data: UserTrade[] }>(
    "/user-trades",
    searchParams
  );
  return json.data;
}

function UserTradesContent() {
  const [trades, setTrades] = useState<UserTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="space-y-6">
      <h3 className="text-lg font-medium">用户交易记录</h3>
      <UserTradesFilter
        onSubmit={(params) => {
          fetchUserTrades(params);
        }}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          错误: {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">时间</th>
                <th className="p-2">交易对</th>
                <th className="p-2">方向</th>
                <th className="p-2">价格</th>
                <th className="p-2">数量</th>
                <th className="p-2">手续费</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, idx) => (
                <tr key={t.id ?? idx} className="border-b">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(t.time).toLocaleString("zh-CN")}
                  </td>
                  <td className="p-2">{t.symbol}</td>
                  <td className="p-2">
                    <span
                      className={
                        t.side === "BUY" ? "text-green-600" : "text-red-600"
                      }
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="p-2">{t.price}</td>
                  <td className="p-2">{t.qty}</td>
                  <td className="p-2">{t.commission ?? "-"}</td>
                </tr>
              ))}
              {trades.length === 0 ? (
                <tr>
                  <td
                    className="p-4 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    请输入查询条件（至少选择 symbol）
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default function UserTradesPage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <UserTradesContent />
    </Suspense>
  );
}
