"use client";

import { useEffect, useMemo, useState } from "react";
import { cryptoApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PositionSide = "LONG" | "SHORT" | "ALL";

interface MatrixCell {
  stopLossPercentage: number;
  takeProfitPercentage: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalCount: number;
  unfinishedCount: number;
}

interface RiskDetailRecord {
  symbol: string;
  exchange: string;
  market: string;
  roundId: string;
  positionSide: "LONG" | "SHORT";
  stopLossPercentage: number;
  takeProfitPercentage: number;
  entryPrice: number;
  exitPrice: number;
  finalPrice: number;
  quantity: number;
  pnlAmount: number;
  pnlRate: number;
  wouldHitStopLoss: boolean;
  wouldHitTakeProfit: boolean;
  isUnfinished: boolean;
  maxDrawdownRate?: number;
  maxProfitRate?: number;
  floatingRate?: number;
  floatingAmount?: number;
  openTime: string;
  closeTime: string;
}

function formatNumber(n: number): string {
  const a = Math.abs(n);
  if (a >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (a >= 1000) return (n / 1000).toFixed(2) + "K";
  return n.toFixed(2);
}

export default function RiskAnalysisPage() {
  const [symbol, setSymbol] = useState<string>("ETHUSDC");
  const [exchange, setExchange] = useState<string>("binance");
  const [market, setMarket] = useState<string>("futures");
  const [positionSide, setPositionSide] = useState<PositionSide>("ALL");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [matrix, setMatrix] = useState<MatrixCell[]>([]);

  const stopLossLevels = useMemo(
    () =>
      Array.from(new Set(matrix.map((m) => m.stopLossPercentage))).sort(
        (a, b) => a - b
      ),
    [matrix]
  );
  const takeProfitLevels = useMemo(
    () =>
      Array.from(new Set(matrix.map((m) => m.takeProfitPercentage))).sort(
        (a, b) => a - b
      ),
    [matrix]
  );
  const cellMap = useMemo(() => {
    const map = new Map<string, MatrixCell>();
    for (const m of matrix) {
      map.set(`${m.stopLossPercentage}|${m.takeProfitPercentage}`, m);
    }
    return map;
  }, [matrix]);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailRecords, setDetailRecords] = useState<RiskDetailRecord[]>([]);
  const [detailTitle, setDetailTitle] = useState<string>("");

  async function fetchMatrix(): Promise<void> {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        symbol,
        exchange,
        market,
      };
      if (positionSide !== "ALL") params.positionSide = positionSide;
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const resp = await cryptoApi.getRiskMatrix<{ data: MatrixCell[] }>(
        params
      );
      setMatrix(resp.data || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("加载风险矩阵失败:", e);
      setMatrix([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(sl: number, tp: number): Promise<void> {
    setDetailLoading(true);
    setDetailTitle(`止损 ${sl}% / 止盈 ${tp}% 明细`);
    try {
      const params: Record<string, string | number | boolean> = {
        symbol,
        exchange,
        market,
        stopLossPercentage: sl,
        takeProfitPercentage: tp,
        limit: 200,
      };
      if (positionSide !== "ALL") params.positionSide = positionSide;
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;
      const resp = await cryptoApi.listRiskDetails<{ data: RiskDetailRecord[] }>(
        params
      );
      setDetailRecords(resp.data || []);
      setDetailOpen(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("加载明细失败:", e);
      setDetailRecords([]);
      setDetailOpen(true);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    fetchMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">风险分析矩阵</h1>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="border rounded px-2 py-1"
          placeholder="Symbol (如: ETHUSDC)"
        />
        <input
          value={exchange}
          onChange={(e) => setExchange(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="Exchange"
        />
        <input
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="Market"
        />
        <select
          value={positionSide}
          onChange={(e) => setPositionSide(e.target.value as PositionSide)}
          className="border rounded px-2 py-1"
        >
          <option value="ALL">ALL</option>
          <option value="LONG">LONG</option>
          <option value="SHORT">SHORT</option>
        </select>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="开始时间"
        />
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="结束时间"
        />
        <div className="md:col-span-6">
          <Button onClick={fetchMatrix} disabled={loading}>
            {loading ? "加载中..." : "加载矩阵"}
          </Button>
        </div>
      </div>

      {/* Matrix */}
      {takeProfitLevels.length > 0 && stopLossLevels.length > 0 ? (
        <div className="overflow-auto border rounded">
          <table className="min-w-[800px] w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left sticky left-0 bg-white z-10">止损% \ 止盈%</th>
                {takeProfitLevels.map((tp) => (
                  <th key={tp} className="p-2 text-right">
                    {tp}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stopLossLevels.map((sl) => (
                <tr key={sl} className="hover:bg-muted/40">
                  <td className="p-2 font-medium sticky left-0 bg-white z-10">{sl}%</td>
                  {takeProfitLevels.map((tp) => {
                    const cell = cellMap.get(`${sl}|${tp}`);
                    const rp = cell?.realizedPnl ?? 0;
                    const up = cell?.unrealizedPnl ?? 0;
                    const total = (rp + up) || 0;
                    const color = total >= 0 ? "text-green-600" : "text-red-600";
                    return (
                      <td key={tp} className="p-2">
                        <button
                          onClick={() => openDetail(sl, tp)}
                          className={`w-full text-right ${color} hover:underline`}
                          title={`点击查看明细 (总:${formatNumber(total)} 实现:${formatNumber(rp)} 浮动:${formatNumber(up)})`}
                        >
                          <div>{formatNumber(total)}</div>
                          <div className="text-xs text-muted-foreground">
                            实现 {formatNumber(rp)} / 浮动 {formatNumber(up)}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-muted-foreground text-sm">暂无数据，请调整筛选并重新加载。</div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="p-6">加载中...</div>
          ) : detailRecords.length === 0 ? (
            <div className="p-6 text-muted-foreground">暂无明细</div>
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">回合</th>
                    <th className="p-2">方向</th>
                    <th className="p-2">开/平</th>
                    <th className="p-2">数量</th>
                    <th className="p-2">实现盈亏</th>
                    <th className="p-2">浮动盈亏</th>
                    <th className="p-2">命中</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRecords.map((r) => (
                    <tr key={`${r.roundId}-${r.stopLossPercentage}-${r.takeProfitPercentage}`} className="border-t">
                      <td className="p-2 whitespace-nowrap">{r.roundId}</td>
                      <td className="p-2">{r.positionSide}</td>
                      <td className="p-2 whitespace-nowrap">
                        {new Date(r.openTime).toLocaleString()} → {new Date(r.closeTime).toLocaleString()}
                      </td>
                      <td className="p-2">{r.quantity.toFixed(4)}</td>
                      <td className={`p-2 ${r.pnlAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {r.pnlAmount.toFixed(2)} ({(r.pnlRate * 100).toFixed(2)}%)
                      </td>
                      <td className="p-2">
                        {r.isUnfinished ? (r.floatingAmount ?? 0).toFixed(2) : "-"}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        止损:{r.wouldHitStopLoss ? "✓" : "✗"} / 止盈:{r.wouldHitTakeProfit ? "✓" : "✗"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


