"use client";

import { Dialog, DialogContent, DialogTitle, DialogHeader } from "../ui/dialog";
import { useEffect, useState } from "react";
import { cryptoApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Clock } from "lucide-react";

// 交易详情数据结构
interface RiskTradeDetail {
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
  isFinished: boolean;
  maxDrawdownRate?: number;
  maxProfitRate?: number;
  openTime: string;
  closeTime: string;
}

interface TradesResponse {
  details: RiskTradeDetail[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  exchange?: string;
  market?: string;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  // 筛选参数
  minPnl?: number;
  maxPnl?: number;
  minQuantity?: number;
  maxQuantity?: number;
  positionSide?: "LONG" | "SHORT";
  startTime?: string;
  endTime?: string;
}

export default function RiskAnalysisTradesDialog({
  open,
  onOpenChange,
  symbol,
  exchange = "binance",
  market = "futures",
  stopLossPercentage,
  takeProfitPercentage,
  minPnl,
  maxPnl,
  minQuantity,
  maxQuantity,
  positionSide,
  startTime,
  endTime,
}: Props) {
  const [data, setData] = useState<RiskTradeDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取交易详情数据
  const fetchTradesData = async () => {
    if (!symbol) return;

    setLoading(true);
    setError(null);
    try {
      const params = {
        symbol,
        exchange,
        market,
        stopLossPercentage,
        takeProfitPercentage,
        startTime,
        endTime,
        minPnl,
        maxPnl,
        minQuantity,
        maxQuantity,
        positionSide,
      };

      const result = await cryptoApi.getRiskTrades<TradesResponse>(params);
      setData(result.details || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取交易数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 当弹框打开时获取数据
  useEffect(() => {
    if (open) {
      fetchTradesData();
    }
  }, [open, symbol, stopLossPercentage, takeProfitPercentage, startTime, endTime, minPnl, maxPnl, minQuantity, maxQuantity, positionSide]);

  // 格式化数字
  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleString();
  };

  // 获取策略标题
  const getStrategyTitle = () => {
    const slTitle = stopLossPercentage === 0 ? "真实订单" : `止损 ${stopLossPercentage}%`;
    const tpTitle = takeProfitPercentage === 0 ? "真实订单" : `止盈 ${takeProfitPercentage}%`;
    return `${slTitle} × ${tpTitle}`;
  };

  // 计算统计数据
  const getStatistics = () => {
    if (data.length === 0) return null;

    const totalPnl = data.reduce((sum, trade) => sum + trade.pnlAmount, 0);
    const profitTrades = data.filter(trade => trade.pnlAmount > 0);
    const lossTrades = data.filter(trade => trade.pnlAmount < 0);
    const unfinishedTrades = data.filter(trade => !trade.isFinished);
    const winRate = data.length > 0 ? (profitTrades.length / data.length) * 100 : 0;

    return {
      totalTrades: data.length,
      totalPnl,
      profitTrades: profitTrades.length,
      lossTrades: lossTrades.length,
      unfinishedTrades: unfinishedTrades.length,
      winRate,
      avgPnl: totalPnl / data.length,
    };
  };

  const stats = getStatistics();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            交易详情 - {symbol} - {getStrategyTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* 统计信息 */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalTrades}</div>
                <div className="text-sm text-gray-600">总交易数</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(stats.totalPnl)}
                </div>
                <div className="text-sm text-gray-600">总盈亏</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.profitTrades}</div>
                <div className="text-sm text-gray-600">盈利交易</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(stats.winRate, 1)}%
                </div>
                <div className="text-sm text-gray-600">胜率</div>
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">加载中...</span>
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <div className="text-red-600 bg-red-50 p-4 rounded-lg">
              错误：{error}
            </div>
          )}

          {/* 交易列表 */}
          {!loading && !error && data.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              此策略组合下暂无交易数据
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <div className="space-y-2">
              {data.map((trade, index) => (
                <div
                  key={`${trade.roundId}-${index}`}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={trade.positionSide === "LONG" ? "default" : "secondary"}>
                        {trade.positionSide}
                      </Badge>
                      <span className="font-mono text-sm">{trade.roundId}</span>
                      {!trade.isFinished && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          <Clock className="w-3 h-3 mr-1" />
                          未完成
                        </Badge>
                      )}
                    </div>
                    <div className={`text-lg font-bold ${trade.pnlAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnlAmount >= 0 ? '+' : ''}{formatNumber(trade.pnlAmount)}
                      <span className="text-sm ml-1">
                        ({trade.pnlRate >= 0 ? '+' : ''}{formatNumber(trade.pnlRate, 2)}%)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">开仓价:</span>
                      <span className="ml-1 font-mono">{formatNumber(trade.entryPrice, 4)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">平仓价:</span>
                      <span className="ml-1 font-mono">{formatNumber(trade.exitPrice, 4)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">数量:</span>
                      <span className="ml-1 font-mono">{formatNumber(trade.quantity, 4)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {trade.wouldHitStopLoss && (
                        <span className="text-red-600 flex items-center">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          止损
                        </span>
                      )}
                      {trade.wouldHitTakeProfit && (
                        <span className="text-green-600 flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          止盈
                        </span>
                      )}
                      {trade.maxDrawdownRate && trade.maxDrawdownRate < -0.05 && (
                        <span className="text-orange-600 flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          深度回撤
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-2 border-t">
                    <div>
                      <span className="text-gray-600">开仓时间:</span>
                      <span className="ml-1">{formatTime(trade.openTime)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">平仓时间:</span>
                      <span className="ml-1">{formatTime(trade.closeTime)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
