import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { cryptoApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  symbol: string;
  exchange?: string;
  market?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  minPnl?: number;
  maxPnl?: number;
  minQuantity?: number;
  maxQuantity?: number;
  positionSide?: "LONG" | "SHORT" | "ALL";
  startTime?: string;
  endTime?: string;
  // 止盈设置（默认启用）
  takeProfitPercentage?: number;
}

interface RiskLevelResult {
  percentage: number;
  totalTrades: number;
  profitTrades: number;
  lossTrades: number;
  breakEvenTrades: number;
  totalProfit: number;
  totalProfitAmount: number;
  totalLossAmount: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  stopLossTrades: number;
  takeProfitTrades: number;
  normalExitTrades: number;
}

interface StopLossAnalysis {
  optimalStopLoss: {
    percentage: number;
    totalProfit: number;
    totalProfitAmount: number;
    totalLossAmount: number;
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    profitFactor: number;
  };
  riskLevels: RiskLevelResult[];
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
  wouldHitTakeProfit: boolean;
  maxDrawdownRate: number;
  maxProfitRate: number;
  isUnfinished: boolean;
  openTime: string;
  closeTime: string;
  floatingRate?: number;
  floatingAmount?: number;
  openTradeIds?: string[];
  closeTradeIds?: string[];
}

interface TakeProfitComparison {
  percentage: number;
  totalProfit: number;
  totalProfitAmount: number;
  totalLossAmount: number;
  winRate: number;
  totalTrades: number;
  profitTrades: number;
  lossTrades: number;
  breakEvenTrades: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  takeProfitTrades: number;
  stopLossTrades: number;
  normalExitTrades: number;
}

export default function StopLossDialog({
  symbol,
  exchange = "binance",
  market = "futures",
  open,
  onOpenChange,
  minPnl,
  maxPnl,
  minQuantity,
  maxQuantity,
  positionSide,
  startTime,
  endTime,
  takeProfitPercentage = 1,
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
  const [currentTakeProfitPercentage, setCurrentTakeProfitPercentage] =
    useState(takeProfitPercentage);

  // 止盈对比：固定一个止损百分比，查看不同止盈下的盈亏
  const [tpBaseStopLoss, setTpBaseStopLoss] = useState<number>(-2.0);
  const [tpVariants, setTpVariants] = useState<TakeProfitComparison[]>([]);

  // 根据实际交易数据计算最佳止损点
  const calculateStopLoss = async (overrides?: {
    takeProfitPercentage?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      // 调用服务端 API 计算
      const resp = await cryptoApi.calculateRiskAnalysis({
        symbol,
        exchange,
        market,
        minPnl,
        maxPnl,
        minQuantity,
        maxQuantity,
        positionSide: positionSide === "ALL" ? undefined : positionSide,
        startTime,
        endTime,
        takeProfitPercentage:
          overrides?.takeProfitPercentage ?? currentTakeProfitPercentage,
        baseStopLoss: tpBaseStopLoss,
      });

      if (resp && resp.analysis) {
        setAnalysis(resp.analysis);
        setTpVariants(resp.takeProfitComparison ?? []);
        setLoading(false);
        return;
      } else {
        throw new Error("服务端返回了空的分析结果");
      }
    } catch (apiErr) {
      console.error("Risk analysis API failed:", apiErr);
      setError(
        apiErr instanceof Error
          ? apiErr.message
          : "服务端风险分析API调用失败，请检查服务端状态"
      );
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

  const handleTakeProfitRecalculate = () => {
    setAnalysis(null);
    calculateStopLoss({ takeProfitPercentage: currentTakeProfitPercentage });
  };

  const handleRowClick = (
    riskLevel: RiskLevelResult,
    type: "profit" | "loss"
  ) => {
    // 实现交易详情查看逻辑
  };

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    return num.toFixed(2);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-7xl",
          isFullscreen
            ? "w-[95vw] h-[95vh] max-h-[95vh]"
            : "w-[90vw] h-[80vh] max-h-[80vh]"
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <span>止损止盈分析 - {symbol}</span>
              <Badge variant="outline" className="text-xs">
                {positionSide || "ALL"}
              </Badge>
            </DialogTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>

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

          {/* 止盈设置 */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="takeProfit">止盈百分比:</Label>
              <Input
                id="takeProfit"
                type="number"
                value={currentTakeProfitPercentage}
                onChange={(e) =>
                  setCurrentTakeProfitPercentage(Number(e.target.value))
                }
                className="w-20"
                step="0.1"
                min="0.1"
                max="50"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTakeProfitRecalculate}
                disabled={loading}
              >
                应用
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
                  正在获取数据并计算最佳止盈止损...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-500">
                <p className="text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculate}
                  className="mt-2"
                >
                  重试
                </Button>
              </div>
            </div>
          )}

          {analysis && !loading && !error && (
            <div className="space-y-6">
              {/* 最佳止损点摘要 */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">最佳止损点</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">止损百分比</div>
                    <div className="font-semibold">
                      {analysis.optimalStopLoss.percentage === 0
                        ? "真实订单"
                        : `${analysis.optimalStopLoss.percentage}%`}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">总盈利</div>
                    <div className="font-semibold text-green-600">
                      ${formatNumber(analysis.optimalStopLoss.totalProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">胜率</div>
                    <div className="font-semibold">
                      {formatPercentage(analysis.optimalStopLoss.winRate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">盈亏比</div>
                    <div className="font-semibold">
                      {analysis.optimalStopLoss.profitFactor.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 风险水平对比表 */}
              <div>
                <h3 className="text-lg font-semibold mb-2">风险水平对比</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>止损水平</TableHead>
                        <TableHead className="text-right">总盈利</TableHead>
                        <TableHead className="text-right">总交易</TableHead>
                        <TableHead className="text-right">盈利交易</TableHead>
                        <TableHead className="text-right">亏损交易</TableHead>
                        <TableHead className="text-right">胜率</TableHead>
                        <TableHead className="text-right">盈亏比</TableHead>
                        <TableHead className="text-right">止损触发</TableHead>
                        <TableHead className="text-right">止盈触发</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.riskLevels.map((level) => {
                        const isOptimal =
                          level.percentage ===
                          analysis.optimalStopLoss.percentage;
                        return (
                          <TableRow
                            key={level.percentage}
                            className={cn(
                              isOptimal && "bg-green-50 hover:bg-green-100",
                              "cursor-pointer"
                            )}
                          >
                            <TableCell className="font-medium">
                              {level.percentage === 0
                                ? "真实订单"
                                : `${level.percentage}%`}
                              {isOptimal && (
                                <Badge
                                  variant="default"
                                  className="ml-2 text-xs"
                                >
                                  最佳
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-medium",
                                level.totalProfit > 0
                                  ? "text-green-600"
                                  : level.totalProfit < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                              )}
                            >
                              ${formatNumber(level.totalProfit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {level.totalTrades}
                            </TableCell>
                            <TableCell
                              className="text-right text-green-600 cursor-pointer hover:underline"
                              onClick={() => handleRowClick(level, "profit")}
                            >
                              {level.profitTrades}
                            </TableCell>
                            <TableCell
                              className="text-right text-red-600 cursor-pointer hover:underline"
                              onClick={() => handleRowClick(level, "loss")}
                            >
                              {level.lossTrades}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercentage(level.winRate)}
                            </TableCell>
                            <TableCell className="text-right">
                              {level.profitFactor.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {level.stopLossTrades}
                            </TableCell>
                            <TableCell className="text-right">
                              {level.takeProfitTrades}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* 止盈对比分析 */}
              {tpVariants.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    止盈对比分析 (固定止损: {tpBaseStopLoss}%)
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>止盈水平</TableHead>
                          <TableHead className="text-right">总盈利</TableHead>
                          <TableHead className="text-right">胜率</TableHead>
                          <TableHead className="text-right">止盈触发</TableHead>
                          <TableHead className="text-right">止损触发</TableHead>
                          <TableHead className="text-right">正常出场</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tpVariants.map((variant) => (
                          <TableRow key={variant.percentage}>
                            <TableCell className="font-medium">
                              {variant.percentage}%
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-medium",
                                variant.totalProfit > 0
                                  ? "text-green-600"
                                  : variant.totalProfit < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                              )}
                            >
                              ${formatNumber(variant.totalProfit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercentage(variant.winRate)}
                            </TableCell>
                            <TableCell className="text-right">
                              {variant.takeProfitTrades}
                            </TableCell>
                            <TableCell className="text-right">
                              {variant.stopLossTrades}
                            </TableCell>
                            <TableCell className="text-right">
                              {variant.normalExitTrades}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
