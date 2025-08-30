"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  TrendingDown,
  TrendingUp,
  Calculator,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from "lucide-react";
import { cryptoApi } from "@/lib/api";
import { KlineDialog } from "@/components/charts/kline-dialog";
// Worker 用于并行计算不同止损等级
// @ts-ignore - bundled by Next/webpack
import StopLossWorker from "@/workers/stop-loss-worker.ts?worker";

interface KlineData {
  symbol: string;
  interval: string;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
  exchange: string;
  market: string;
  timestamp: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  // API调用所需参数
  minPnl?: number;
  maxPnl?: number;
  minQuantity?: number;
  maxQuantity?: number;
  positionSide?: "LONG" | "SHORT" | "ALL";
  startTime?: string;
  endTime?: string;
}

interface TradeDetail {
  roundId: string;
  symbol: string;
  positionSide: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  finalPrice: number;
  pnlAmount: number;
  pnlRate: number;
  originalPnlAmount: number;
  wouldHitStopLoss: boolean;
  maxDrawdownRate: number;
  openTime: string;
  closeTime: string;
}

interface StopLossAnalysis {
  optimalStopLoss: {
    percentage: number;
    totalProfit: number;
    totalProfitAmount: number; // 毛盈利总额（不含亏损）
    totalLossAmount: number; // 毛亏损总额（绝对值）
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    profitFactor: number;
  };
  riskLevels: Array<{
    percentage: number;
    totalProfit: number;
    totalProfitAmount: number; // 毛盈利
    totalLossAmount: number; // 毛亏损（绝对值）
    winRate: number;
    totalTrades: number;
    profitTrades: number;
    lossTrades: number;
    avgProfit: number;
    avgLoss: number;
    profitFactor: number;
    profitTradeDetails: TradeDetail[];
    lossTradeDetails: TradeDetail[];
  }>;
}

export function StopLossDialog({
  open,
  onOpenChange,
  symbol,
  minPnl,
  maxPnl,
  minQuantity,
  maxQuantity,
  positionSide,
  startTime,
  endTime,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [analysis, setAnalysis] = useState<StopLossAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTradeList, setShowTradeList] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<TradeDetail[]>([]);
  const [tradeListTitle, setTradeListTitle] = useState("");
  const [sortKey, setSortKey] = useState<"pnl" | "original">("pnl");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // 根据实际交易数据计算最佳止损点
  const calculateStopLoss = async () => {
    setLoading(true);
    setError(null);

    try {
      // 获取所有符合筛选条件的交易数据
      const response = await cryptoApi.listRoundPnl<{
        data: Array<{
          roundId: string;
          symbol: string;
          exchange: string;
          market: string;
          positionSide: "LONG" | "SHORT";
          totalQuantity: number;
          avgEntryPrice: number;
          avgExitPrice: number;
          realizedPnl: number;
          openTime: string;
          closeTime: string;
          openTradeIds: string[];
        }>;
        total: number;
        totalPnl: number;
      }>({
        symbol,
        exchange: "binance",
        market: "futures",
        minPnl,
        maxPnl,
        minQuantity,
        maxQuantity,
        positionSide: positionSide === "ALL" ? undefined : positionSide,
        startTime,
        endTime,
        limit: 10000, // 获取所有数据进行分析
        offset: 0,
      });

      const allTrades = response.data;

      if (allTrades.length === 0) {
        throw new Error("没有找到符合条件的交易数据");
      }

      // 简单缓存：为每个回合仅获取一次K线与开仓成交，后续止损等级复用，避免重复请求
      const klineCache = new Map<string, KlineData[] | null>();
      const openTradesCache = new Map<
        string,
        Array<{
          price: number;
          quantity: number;
          timestamp: string;
          tradeId: string;
          orderId?: string;
        }> | null
      >();

      async function getKlinesOnce(trade: {
        roundId: string;
        symbol: string;
        exchange: string;
        market: string;
        openTime: string;
        closeTime: string;
      }): Promise<KlineData[]> {
        if (klineCache.has(trade.roundId)) {
          return klineCache.get(trade.roundId) || [];
        }
        try {
          const { data } = await cryptoApi.listKlines<{ data: KlineData[] }>({
            symbol: trade.symbol,
            exchange: (trade as any).exchange || "binance",
            market: "futures",
            interval: "1m", // 恢复 1m 粒度确保极值与早停判定准确
            startTime: trade.openTime,
            endTime: trade.closeTime,
            order: "asc",
          });
          klineCache.set(trade.roundId, data || null);
          return data || [];
        } catch {
          klineCache.set(trade.roundId, null);
          return [];
        }
      }

      async function getFirstTwoOpensOnce(trade: {
        roundId: string;
        symbol: string;
        exchange: string;
        market: string;
        openTradeIds?: string[];
      }): Promise<
        Array<{
          price: number;
          quantity: number;
          timestamp: string;
          tradeId: string;
          orderId?: string;
        }>
      > {
        if (!trade.openTradeIds || trade.openTradeIds.length < 2) return [];
        if (openTradesCache.has(trade.roundId)) {
          return openTradesCache.get(trade.roundId) || [];
        }
        try {
          const { data } = await cryptoApi.getTradesByIds<{
            data: Array<{
              price: number;
              quantity: number;
              timestamp: string;
              tradeId: string;
              orderId?: string;
            }>;
          }>({
            symbol: trade.symbol,
            exchange: (trade as any).exchange,
            market: (trade as any).market,
            tradeIds: trade.openTradeIds.join(","),
          });
          const opens = (data || []).sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          openTradesCache.set(trade.roundId, opens);
          return opens;
        } catch {
          openTradesCache.set(trade.roundId, null);
          return [];
        }
      }

      // 预热所有回合的缓存，避免在第一个止损等级时串行请求
      async function warmCaches() {
        const concurrency = 10;
        for (let i = 0; i < allTrades.length; i += concurrency) {
          const batch = allTrades.slice(i, i + concurrency);
          await Promise.all([
            // 并发拉取每个回合的K线
            ...batch.map((t) => getKlinesOnce(t as any)),
            // 并发拉取每个回合的首两笔开仓成交
            ...batch.map((t) => getFirstTwoOpensOnce(t as any)),
          ]);
        }
      }

      await warmCaches();

      // 定义要测试的止损水平（从0.5%到50%的全范围测试，加上无止损对比）
      const stopLossLevels = [
        -999, // 无止损（用-999表示永不触发）
        -0.5,
        -1.0,
        -1.5,
        -2.0,
        -2.5,
        -3.0,
        -3.5,
        -4.0,
        -5.0,
        -6.0,
        -8.0,
        -10.0,
        -12.0,
        -15.0,
        -20.0,
        -25.0,
        -30.0,
        -35.0,
        -40.0,
        -45.0,
        -50.0,
      ];

      // 为了提高性能，我们将并发处理止损计算（并使用缓存避免重复请求）
      const riskLevels = await Promise.all(
        stopLossLevels.map(async (stopLossPercentage) => {
          let totalTrades = 0;
          let profitTrades = 0;
          let lossTrades = 0;
          let totalProfitAmount = 0;
          let totalLossAmount = 0;
          let totalNetProfit = 0;
          const profitTradeDetails: TradeDetail[] = [];
          const lossTradeDetails: TradeDetail[] = [];

          // 处理全部筛选到的交易；如需提速可按需限制数量
          const tradesToProcess = allTrades;

          for (const trade of tradesToProcess) {
            const entryPrice = trade.avgEntryPrice;
            const exitPrice = trade.avgExitPrice;
            const quantity = trade.totalQuantity;
            const isLong = trade.positionSide === "LONG";

            // 跳过无效数据
            if (!entryPrice || !exitPrice || !quantity) {
              continue;
            }

            try {
              // 获取交易期间的K线数据（使用缓存 + 5m 粒度）
              const klines = await getKlinesOnce(trade as any);

              if (!klines || klines.length === 0) {
                // 如果没有K线数据，使用原始交易结果作为回退，并同时补充详情，避免计数与列表不一致
                const entryPrice = trade.avgEntryPrice;
                const exitPrice = trade.avgExitPrice;
                const quantity = trade.totalQuantity;
                const pnlAmount = trade.realizedPnl;
                totalTrades++;
                totalNetProfit += pnlAmount;
                const detail: TradeDetail = {
                  roundId: trade.roundId,
                  symbol: trade.symbol,
                  positionSide: trade.positionSide,
                  entryPrice,
                  exitPrice,
                  quantity,
                  finalPrice: exitPrice,
                  pnlAmount,
                  pnlRate:
                    ((isLong
                      ? exitPrice - entryPrice
                      : entryPrice - exitPrice) /
                      entryPrice) *
                    100,
                  originalPnlAmount: trade.realizedPnl,
                  wouldHitStopLoss: false,
                  maxDrawdownRate: 0,
                  openTime: trade.openTime,
                  closeTime: trade.closeTime,
                };
                if (pnlAmount > 0) {
                  profitTrades++;
                  totalProfitAmount += pnlAmount;
                  profitTradeDetails.push(detail);
                } else if (pnlAmount < 0) {
                  lossTrades++;
                  totalLossAmount += Math.abs(pnlAmount);
                  lossTradeDetails.push(detail);
                }
                continue;
              }

              // 若有多次开仓：如果第一笔开仓在第二笔开仓前已触发止损，则直接止损退出
              if (trade.openTradeIds && trade.openTradeIds.length >= 2) {
                try {
                  const openTrades = await getFirstTwoOpensOnce(trade as any);

                  if (openTrades.length >= 2) {
                    const first = openTrades[0];
                    const second = openTrades[1];
                    const firstOpenTime = new Date(
                      first.timestamp
                    ).toISOString();
                    const secondOpenTime = new Date(
                      second.timestamp
                    ).toISOString();

                    // 在第一笔到第二笔之间检查是否达到止损价
                    const firstStopPrice = isLong
                      ? first.price * (1 + stopLossPercentage / 100)
                      : first.price * (1 - stopLossPercentage / 100);

                    const betweenK = klines.filter(
                      (k) =>
                        k.openTime >= firstOpenTime &&
                        k.closeTime <= secondOpenTime
                    );

                    let earlyHit = false;
                    if (betweenK.length > 0) {
                      if (isLong) {
                        const minLow = Math.min(...betweenK.map((k) => k.low));
                        earlyHit = minLow <= firstStopPrice;
                      } else {
                        const maxHigh = Math.max(
                          ...betweenK.map((k) => k.high)
                        );
                        earlyHit = maxHigh >= firstStopPrice;
                      }
                    }

                    if (earlyHit) {
                      // 以第一笔开仓的数量与价格，在止损价退出，不再有后续开单
                      const posValue = first.price * first.quantity;
                      const pnlRateEarly = isLong
                        ? ((firstStopPrice - first.price) / first.price) * 100
                        : ((first.price - firstStopPrice) / first.price) * 100;
                      const pnlAmountEarly = (pnlRateEarly / 100) * posValue;

                      totalTrades++;
                      totalNetProfit += pnlAmountEarly;

                      // 估算最大浮亏用于展示；若无法计算则用阈值替代
                      let maxDd: number;
                      if (betweenK.length > 0) {
                        if (isLong) {
                          const minLow = Math.min(
                            ...betweenK.map((k) => k.low)
                          );
                          maxDd = ((minLow - first.price) / first.price) * 100;
                        } else {
                          const maxHigh = Math.max(
                            ...betweenK.map((k) => k.high)
                          );
                          maxDd = ((first.price - maxHigh) / first.price) * 100;
                        }
                      } else {
                        maxDd = stopLossPercentage; // 至少达到止损阈值
                      }

                      const detail: TradeDetail = {
                        roundId: trade.roundId,
                        symbol: trade.symbol,
                        positionSide: trade.positionSide,
                        entryPrice: first.price,
                        exitPrice: trade.avgExitPrice,
                        quantity: first.quantity,
                        finalPrice: firstStopPrice,
                        pnlAmount: pnlAmountEarly,
                        pnlRate: pnlRateEarly,
                        originalPnlAmount: trade.realizedPnl,
                        wouldHitStopLoss: true,
                        maxDrawdownRate: maxDd,
                        openTime: first.timestamp,
                        closeTime: trade.closeTime,
                      } as any;

                      if (pnlAmountEarly > 0) {
                        profitTrades++;
                        totalProfitAmount += pnlAmountEarly;
                        profitTradeDetails.push(detail);
                      } else if (pnlAmountEarly < 0) {
                        lossTrades++;
                        totalLossAmount += Math.abs(pnlAmountEarly);
                        lossTradeDetails.push(detail);
                      }

                      // 跳过后续逻辑，处理下一笔回合
                      continue;
                    }
                  }
                } catch (e) {
                  // 获取原始开仓交易失败则忽略早停检查，继续正常流程
                  console.warn("获取开仓交易失败，跳过早停检查", e);
                }
              }

              // 计算最大浮亏率
              let maxDrawdownRate = 0;
              if (isLong) {
                // 多头：找交易期间的最低价
                const lowestPrice = Math.min(...klines.map((k) => k.low));
                maxDrawdownRate =
                  ((lowestPrice - entryPrice) / entryPrice) * 100;
              } else {
                // 空头：找交易期间的最高价
                const highestPrice = Math.max(...klines.map((k) => k.high));
                maxDrawdownRate =
                  ((entryPrice - highestPrice) / entryPrice) * 100;
              }

              // 判断是否会触发止损
              let finalPrice = exitPrice;
              let wouldHitStopLoss = false;

              // 关键逻辑：如果最大浮亏超过止损设置，则在止损价出场
              if (maxDrawdownRate <= stopLossPercentage) {
                wouldHitStopLoss = true;
                // 计算止损价
                finalPrice = isLong
                  ? entryPrice * (1 + stopLossPercentage / 100)
                  : entryPrice * (1 - stopLossPercentage / 100);
              }

              // 计算在该止损条件下的盈亏率
              const pnlRate = isLong
                ? ((finalPrice - entryPrice) / entryPrice) * 100
                : ((entryPrice - finalPrice) / entryPrice) * 100;

              // 计算实际盈亏金额
              const positionValue = entryPrice * quantity;
              const pnlAmount = (pnlRate / 100) * positionValue;

              totalTrades++;
              totalNetProfit += pnlAmount;

              const tradeDetail: TradeDetail = {
                roundId: trade.roundId,
                symbol: trade.symbol,
                positionSide: trade.positionSide,
                entryPrice,
                exitPrice,
                quantity,
                finalPrice,
                pnlAmount,
                pnlRate,
                originalPnlAmount: trade.realizedPnl,
                wouldHitStopLoss,
                maxDrawdownRate,
                openTime: trade.openTime,
                closeTime: trade.closeTime,
              };

              if (pnlAmount > 0) {
                profitTrades++;
                totalProfitAmount += pnlAmount;
                profitTradeDetails.push(tradeDetail);
              } else if (pnlAmount < 0) {
                lossTrades++;
                totalLossAmount += Math.abs(pnlAmount);
                lossTradeDetails.push(tradeDetail);
              }

              // 调试信息（前3笔交易）
              if (stopLossPercentage === -2.0 && totalTrades <= 3) {
                console.log(
                  `${stopLossPercentage}% 止损 - Trade ${totalTrades}:`,
                  {
                    roundId: trade.roundId,
                    positionSide: isLong ? "LONG" : "SHORT",
                    entryPrice: Number(entryPrice.toFixed(4)),
                    exitPrice: Number(exitPrice.toFixed(4)),
                    maxDrawdownRate: Number(maxDrawdownRate.toFixed(2)),
                    stopLossThreshold: stopLossPercentage,
                    wouldHitStopLoss,
                    finalPrice: Number(finalPrice.toFixed(4)),
                    pnlRate: Number(pnlRate.toFixed(2)),
                    pnlAmount: Number(pnlAmount.toFixed(2)),
                    actualPnl: Number(trade.realizedPnl.toFixed(2)),
                  }
                );
              }
            } catch (error) {
              console.error(`获取交易 ${trade.roundId} 的K线数据失败:`, error);
              // 如果K线数据获取失败，使用原始交易结果，并补充详情，避免计数与列表不一致
              const entryPrice = trade.avgEntryPrice;
              const exitPrice = trade.avgExitPrice;
              const quantity = trade.totalQuantity;
              const pnlAmount = trade.realizedPnl;
              totalTrades++;
              totalNetProfit += pnlAmount;

              const detail: TradeDetail = {
                roundId: trade.roundId,
                symbol: trade.symbol,
                positionSide: trade.positionSide,
                entryPrice,
                exitPrice,
                quantity,
                finalPrice: exitPrice,
                pnlAmount,
                pnlRate:
                  ((isLong ? exitPrice - entryPrice : entryPrice - exitPrice) /
                    entryPrice) *
                  100,
                originalPnlAmount: trade.realizedPnl,
                wouldHitStopLoss: false,
                maxDrawdownRate: 0,
                openTime: trade.openTime,
                closeTime: trade.closeTime,
              };

              if (pnlAmount > 0) {
                profitTrades++;
                totalProfitAmount += pnlAmount;
                profitTradeDetails.push(detail);
              } else if (pnlAmount < 0) {
                lossTrades++;
                totalLossAmount += Math.abs(pnlAmount);
                lossTradeDetails.push(detail);
              }
            }
          }

          const winRate =
            totalTrades > 0 ? (profitTrades / totalTrades) * 100 : 0;
          const avgProfit =
            profitTrades > 0 ? totalProfitAmount / profitTrades : 0;
          const avgLoss = lossTrades > 0 ? totalLossAmount / lossTrades : 0;
          const profitFactor = avgLoss > 0 ? avgProfit / avgLoss : 0;

          return {
            percentage: stopLossPercentage === -999 ? 0 : stopLossPercentage, // 显示为"无止损"
            totalProfit: Number(totalNetProfit.toFixed(2)),
            totalProfitAmount: Number(totalProfitAmount.toFixed(2)),
            totalLossAmount: Number(totalLossAmount.toFixed(2)),
            winRate: Number(winRate.toFixed(1)),
            totalTrades,
            profitTrades,
            lossTrades,
            avgProfit: Number(avgProfit.toFixed(2)),
            avgLoss: Number(avgLoss.toFixed(2)),
            profitFactor: Number(profitFactor.toFixed(2)),
            profitTradeDetails,
            lossTradeDetails,
          };
        })
      );

      // 找到总盈利最大的止损点
      const bestLevel = riskLevels.reduce((best, current) => {
        return current.totalProfit > best.totalProfit ? current : best;
      });

      const analysisResult: StopLossAnalysis = {
        optimalStopLoss: {
          percentage: bestLevel.percentage,
          totalProfit: bestLevel.totalProfit,
          totalProfitAmount: bestLevel.totalProfitAmount,
          totalLossAmount: bestLevel.totalLossAmount,
          winRate: bestLevel.winRate,
          avgProfit: bestLevel.avgProfit,
          avgLoss: bestLevel.avgLoss,
          profitFactor: bestLevel.profitFactor,
        },
        riskLevels,
      };

      setAnalysis(analysisResult);
    } catch (err) {
      console.error("计算止损分析失败:", err);
      setError(err instanceof Error ? err.message : "计算止损点时发生错误");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !analysis && !loading) {
      calculateStopLoss();
    }
  }, [open]);

  const handleRecalculate = () => {
    setAnalysis(null);
    calculateStopLoss();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${
          isFullscreen
            ? "max-w-none w-[95vw] h-[95vh]"
            : "max-w-4xl w-[90vw] max-h-[80vh]"
        } overflow-hidden`}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              最佳止损点分析 - {symbol}
            </DialogTitle>
            <div className="flex gap-2 mr-8">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                重新计算
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  正在获取K线数据并计算最佳止损点...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  基于交易期间的价格波动分析止损触发情况
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-500">
                <p className="font-medium">计算失败</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-6">
              {/* 最佳止损点推荐 */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  最佳止损点（基于最大总盈利）
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {analysis.optimalStopLoss.percentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">止损百分比</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      ${analysis.optimalStopLoss.totalProfit.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">盈利</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      $
                      {analysis.optimalStopLoss.totalProfitAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">盈利总额</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      -$
                      {analysis.optimalStopLoss.totalLossAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">亏损总额</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {analysis.optimalStopLoss.winRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">胜率</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">
                      ${analysis.optimalStopLoss.avgProfit.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">平均盈利</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">
                      ${analysis.optimalStopLoss.avgLoss.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">平均亏损</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {analysis.optimalStopLoss.profitFactor}
                    </p>
                    <p className="text-xs text-muted-foreground">盈亏比</p>
                  </div>
                </div>
              </div>

              {/* 不同风险水平分析 */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-orange-500" />
                  不同止损水平分析
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">止损%</th>
                        <th className="text-left p-2">盈利($)</th>
                        <th className="text-left p-2">胜率</th>
                        <th className="text-left p-2">总交易</th>
                        <th className="text-left p-2">盈利次数</th>
                        <th className="text-left p-2">亏损次数</th>
                        <th className="text-left p-2">平均盈利($)</th>
                        <th className="text-left p-2">平均亏损($)</th>
                        <th className="text-left p-2">盈亏比</th>
                        <th className="text-left p-2">盈利总额($)</th>
                        <th className="text-left p-2">亏损总额($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.riskLevels.map((level, index) => (
                        <tr
                          key={level.percentage}
                          className={`border-b hover:bg-muted/20 ${
                            level.percentage ===
                            analysis.optimalStopLoss.percentage
                              ? "bg-blue-50 dark:bg-blue-950/20 font-semibold"
                              : level.percentage === 0
                              ? "bg-green-50 dark:bg-green-950/20"
                              : ""
                          }`}
                        >
                          <td className="p-2 font-medium">
                            {level.percentage === 0
                              ? "无止损"
                              : `${level.percentage}%`}
                          </td>
                          <td className="p-2">
                            <span
                              className={`font-semibold ${
                                level.totalProfit > 0
                                  ? "text-green-600"
                                  : level.totalProfit < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }`}
                            >
                              ${level.totalProfit.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-2">
                            <span
                              className={`${
                                level.winRate >= 60
                                  ? "text-green-600"
                                  : level.winRate >= 50
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {level.winRate}%
                            </span>
                          </td>
                          <td className="p-2">{level.totalTrades}</td>
                          <td className="p-2">
                            <button
                              className="text-green-600 hover:text-green-800 underline decoration-dotted hover:decoration-solid cursor-pointer font-medium px-1 py-0.5 rounded hover:bg-green-50 transition-all"
                              onClick={() => {
                                setSelectedTrades(level.profitTradeDetails);
                                setTradeListTitle(
                                  `${
                                    level.percentage === 0
                                      ? "无止损"
                                      : `${level.percentage}%止损`
                                  } - 盈利交易 (${level.profitTrades}笔)`
                                );
                                setShowTradeList(true);
                              }}
                            >
                              {level.profitTrades}
                            </button>
                          </td>
                          <td className="p-2">
                            <button
                              className="text-red-600 hover:text-red-800 underline decoration-dotted hover:decoration-solid cursor-pointer font-medium px-1 py-0.5 rounded hover:bg-red-50 transition-all"
                              onClick={() => {
                                setSelectedTrades(level.lossTradeDetails);
                                setTradeListTitle(
                                  `${
                                    level.percentage === 0
                                      ? "无止损"
                                      : `${level.percentage}%止损`
                                  } - 亏损交易 (${level.lossTrades}笔)`
                                );
                                setShowTradeList(true);
                              }}
                            >
                              {level.lossTrades}
                            </button>
                          </td>
                          <td className="p-2 text-green-600">
                            ${level.avgProfit.toLocaleString()}
                          </td>
                          <td className="p-2 text-red-600">
                            ${level.avgLoss.toLocaleString()}
                          </td>
                          <td className="p-2">
                            <span
                              className={`${
                                level.profitFactor >= 1.5
                                  ? "text-green-600"
                                  : level.profitFactor >= 1.2
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {level.profitFactor}
                            </span>
                          </td>
                          <td className="p-2 text-green-600">
                            ${level.totalProfitAmount.toLocaleString()}
                          </td>
                          <td className="p-2 text-red-600">
                            -${level.totalLossAmount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 分析结果说明 */}
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">
                  分析结果说明
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>
                    • <strong>总盈利</strong>：在该止损条件下，
                    {analysis.riskLevels[0]?.totalTrades || 0}笔交易的总净盈利
                  </li>
                  <li>
                    • <strong>最佳止损</strong>
                    ：以总盈利最大化为目标选择的止损水平
                  </li>
                  <li>
                    • <strong>计算方法</strong>
                    ：基于5分钟K线数据计算最大浮亏，精确判断止损触发
                  </li>
                  <li>
                    • <strong>止损逻辑</strong>
                    ：当浮亏超过设定值时在止损价出场，否则按原计划出场
                  </li>
                  <li>• 蓝色高亮行为推荐的最佳止损点</li>
                  <li>• 现已分析全部筛选交易；如性能受限可改为采样分析</li>
                </ul>
              </div>

              {/* 使用建议 */}
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4">
                <h4 className="font-medium mb-2 text-yellow-800 dark:text-yellow-200">
                  使用建议
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>
                    • 推荐的止损点基于历史数据计算，实际使用时应结合市场环境调整
                  </li>
                  <li>• 止损过紧可能导致过早离场，止损过宽可能增加单笔亏损</li>
                  <li>• 建议结合技术分析和支撑阻力位设置止损点</li>
                  <li>• 定期回测和调整止损策略以适应市场变化</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* 交易列表对话框 */}
      <Dialog open={showTradeList} onOpenChange={setShowTradeList}>
        <DialogContent className="max-w-none w-[98vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{tradeListTitle}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[82vh] overflow-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 w-12">序号</th>
                    <th className="text-left p-2">回合ID</th>
                    <th className="text-left p-2">方向</th>
                    <th className="text-left p-2">入场价</th>
                    <th className="text-left p-2">原出场价</th>
                    <th className="text-left p-2">出场价</th>
                    <th className="text-left p-2">数量</th>
                    <th className="text-left p-2">最大浮亏%</th>
                    <th className="text-left p-2">是否止损</th>
                    <th className="text-left p-2">盈亏率%</th>
                    <th className="text-left p-2">
                      <button
                        className="inline-flex items-center gap-1 hover:text-blue-600"
                        onClick={() => {
                          const nextAsc = sortKey === "pnl" ? !sortAsc : false;
                          setSortKey("pnl");
                          setSortAsc(nextAsc);
                          setSelectedTrades((arr) =>
                            [...arr].sort((a, b) =>
                              nextAsc
                                ? a.pnlAmount - b.pnlAmount
                                : b.pnlAmount - a.pnlAmount
                            )
                          );
                        }}
                        title="按盈亏金额排序"
                      >
                        盈亏金额($)
                        {sortKey !== "pnl" ? (
                          <ChevronsUpDown className="w-3 h-3" />
                        ) : sortAsc ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-2">
                      <button
                        className="inline-flex items-center gap-1 hover:text-blue-600"
                        onClick={() => {
                          const nextAsc =
                            sortKey === "original" ? !sortAsc : false;
                          setSortKey("original");
                          setSortAsc(nextAsc);
                          setSelectedTrades((arr) =>
                            [...arr].sort((a, b) =>
                              nextAsc
                                ? a.originalPnlAmount - b.originalPnlAmount
                                : b.originalPnlAmount - a.originalPnlAmount
                            )
                          );
                        }}
                        title="按原盈亏金额排序"
                      >
                        原盈亏金额($)
                        {sortKey !== "original" ? (
                          <ChevronsUpDown className="w-3 h-3" />
                        ) : sortAsc ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-2">开仓时间</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTrades.map((trade, index) => (
                    <tr
                      key={`${trade.roundId}-${index}`}
                      className="border-b hover:bg-muted/20"
                    >
                      <td className="p-2 text-center">{index + 1}</td>
                      <td className="p-2 font-mono text-xs">
                        <KlineDialog
                          round={{
                            roundId: trade.roundId,
                            symbol,
                            exchange: "binance",
                            market: "futures",
                            positionSide: trade.positionSide,
                            totalQuantity: trade.quantity,
                            avgEntryPrice: trade.entryPrice,
                            avgExitPrice: trade.exitPrice,
                            realizedPnl: trade.originalPnlAmount ?? trade.pnlAmount,
                            totalFees: 0,
                            openTime: trade.openTime,
                            closeTime: trade.closeTime,
                            openTradeIds: [],
                            closeTradeIds: [],
                          } as any}
                          trigger={
                            <button className="underline decoration-dotted hover:decoration-solid text-blue-600 hover:text-blue-800">
                              {trade.roundId.slice(-8)}
                            </button>
                          }
                        />
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            trade.positionSide === "LONG"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {trade.positionSide === "LONG" ? "多单" : "空单"}
                        </span>
                      </td>
                      <td className="p-2">${trade.entryPrice.toFixed(4)}</td>
                      <td className="p-2">${trade.exitPrice.toFixed(4)}</td>
                      <td className="p-2">
                        <span
                          className={
                            trade.wouldHitStopLoss
                              ? "text-orange-600 font-semibold"
                              : ""
                          }
                        >
                          ${trade.finalPrice.toFixed(4)}
                        </span>
                      </td>
                      <td className="p-2">{trade.quantity.toFixed(4)}</td>
                      <td className="p-2">
                        <span
                          className={`${
                            trade.maxDrawdownRate < -5
                              ? "text-red-600"
                              : trade.maxDrawdownRate < -2
                              ? "text-orange-600"
                              : "text-gray-600"
                          }`}
                        >
                          {trade.maxDrawdownRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            trade.wouldHitStopLoss
                              ? "bg-orange-100 text-orange-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {trade.wouldHitStopLoss ? "是" : "否"}
                        </span>
                      </td>
                      <td className="p-2">
                        <span
                          className={`font-semibold ${
                            trade.pnlRate > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {trade.pnlRate > 0 ? "+" : ""}
                          {trade.pnlRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-2">
                        <span
                          className={`font-semibold ${
                            trade.pnlAmount > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {trade.pnlAmount > 0 ? "+" : ""}$
                          {trade.pnlAmount.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-2">
                        <span
                          className={`font-semibold ${
                            trade.originalPnlAmount > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {trade.originalPnlAmount > 0 ? "+" : ""}$
                          {trade.originalPnlAmount.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {new Date(trade.openTime).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
