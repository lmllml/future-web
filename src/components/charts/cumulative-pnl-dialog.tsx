"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CumulativePnlChart } from "./cumulative-pnl-chart";
import { cryptoApi } from "@/lib/api";

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
}

interface CumulativePnlData {
  date: string;
  cumulativePnl: number;
  dailyPnl: number;
  tradeCount: number;
}

// 前端聚合函数已移除，改为使用后端API

export function CumulativePnlDialog({
  open,
  onOpenChange,
  symbol,
  minPnl,
  maxPnl,
  minQuantity,
  maxQuantity,
  positionSide,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartData, setChartData] = useState<CumulativePnlData[]>([]);
  const [loading, setLoading] = useState(false);

  // 当对话框打开时，获取累计盈亏数据
  useEffect(() => {
    if (!open) return;

    const fetchCumulativePnl = async () => {
      setLoading(true);
      try {
        const response = await cryptoApi.getCumulativePnl<{
          data: CumulativePnlData[];
        }>({
          symbol,
          exchange: "binance",
          market: "futures",
          positionSide: positionSide === "ALL" ? undefined : positionSide,
          minPnl,
          maxPnl,
          minQuantity,
          maxQuantity,
        });
        setChartData(response.data);
      } catch (error) {
        console.error("获取累计盈亏数据失败:", error);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCumulativePnl();
  }, [open, symbol, minPnl, maxPnl, minQuantity, maxQuantity, positionSide]);

  // 统计信息：基于API返回的图表数据计算
  const stats = useMemo(() => {
    if (!chartData.length) return null;

    const totalPnl = chartData[chartData.length - 1].cumulativePnl;
    const totalTrades = chartData.reduce(
      (sum, item) => sum + item.tradeCount,
      0
    );
    const profitableDays = chartData.filter((item) => item.dailyPnl > 0).length;
    const totalDays = chartData.length;
    const maxDrawdown = Math.min(
      ...chartData.map((item) => item.cumulativePnl)
    );
    const maxProfit = Math.max(...chartData.map((item) => item.cumulativePnl));

    return {
      totalPnl,
      totalTrades,
      profitableDays,
      totalDays,
      winRate: ((profitableDays / totalDays) * 100).toFixed(1),
      maxDrawdown,
      maxProfit,
      avgDailyPnl: totalPnl / totalDays,
    };
  }, [chartData]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-4xl ${
          isFullscreen ? "w-[95vw] h-[95vh] max-w-none" : "w-full h-[80vh]"
        }`}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>累计盈亏分析 - {symbol}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? "退出全屏" : "全屏"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                关闭
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* 统计信息 */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-muted/50 rounded p-3">
                <div className="text-muted-foreground">总盈亏</div>
                <div
                  className={`font-semibold text-lg ${
                    stats.totalPnl > 0
                      ? "text-green-600"
                      : stats.totalPnl < 0
                      ? "text-red-600"
                      : "text-foreground"
                  }`}
                >
                  {stats.totalPnl.toFixed(4)}
                </div>
              </div>
              <div className="bg-muted/50 rounded p-3">
                <div className="text-muted-foreground">交易次数</div>
                <div className="font-semibold text-lg">{stats.totalTrades}</div>
              </div>
              <div className="bg-muted/50 rounded p-3">
                <div className="text-muted-foreground">盈利天数</div>
                <div className="font-semibold text-lg">
                  {stats.profitableDays}/{stats.totalDays} ({stats.winRate}%)
                </div>
              </div>
              <div className="bg-muted/50 rounded p-3">
                <div className="text-muted-foreground">平均日收益</div>
                <div
                  className={`font-semibold text-lg ${
                    stats.avgDailyPnl > 0
                      ? "text-green-600"
                      : stats.avgDailyPnl < 0
                      ? "text-red-600"
                      : "text-foreground"
                  }`}
                >
                  {stats.avgDailyPnl.toFixed(4)}
                </div>
              </div>
              <div className="bg-muted/50 rounded p-3">
                <div className="text-muted-foreground">最大回撤</div>
                <div className="font-semibold text-lg text-red-600">
                  {stats.maxDrawdown.toFixed(4)}
                </div>
              </div>
              <div className="bg-muted/50 rounded p-3">
                <div className="text-muted-foreground">最大盈利</div>
                <div className="font-semibold text-lg text-green-600">
                  {stats.maxProfit.toFixed(4)}
                </div>
              </div>
            </div>
          )}

          {/* 图表区域 */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div
                className="flex items-center justify-center bg-muted/20 rounded"
                style={{ height: isFullscreen ? 500 : 350 }}
              >
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-muted-foreground">
                    加载累计盈亏数据中...
                  </span>
                </div>
              </div>
            ) : (
              <CumulativePnlChart
                data={chartData}
                height={isFullscreen ? 500 : 350}
                className="w-full h-full"
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
