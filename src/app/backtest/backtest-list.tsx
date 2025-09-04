"use client";

import { useEffect, useState } from "react";
import { cryptoApi } from "@/lib/api";
import { BacktestSummary, BacktestStatus, BacktestResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BacktestDetail } from "./backtest-detail";

interface Props {
  name: string;
  symbol: string;
  status: string;
  strategyType: string;
  startTime: string;
  endTime: string;
  sort: string;
}

export function BacktestList({
  name,
  symbol,
  status,
  strategyType,
  startTime,
  endTime,
  sort,
}: Props) {
  const [backtests, setBacktests] = useState<BacktestSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBacktest, setSelectedBacktest] = useState<BacktestSummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    loadBacktests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, symbol, status, strategyType, startTime, endTime, sort]);

  // 将 BacktestResult 转换为 BacktestSummary
  function convertToSummary(result: BacktestResult): BacktestSummary {
    return {
      id: result.id,
      name: `回测结果_${result.id.slice(-8)}`, // 从结果ID生成名称，因为结果没有name字段
      description: result.error ? `错误: ${result.error}` : undefined,
      symbol: "BTCUSDT", // 暂时硬编码，实际应该从配置中获取
      exchange: "binance",
      market: "futures",
      status: result.status,
      strategyName: "follow_trades", // 暂时硬编码
      startTime: result.startTime,
      endTime: result.endTime || result.startTime,
      duration: result.duration,
      totalTrades: result.totalTrades,
      netPnl: result.netPnl,
      totalReturn: result.totalReturn,
      maxDrawdown: result.maxDrawdown,
      sharpeRatio: result.sharpeRatio,
      winRate: result.winRate,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async function loadBacktests() {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {};
      // 注意：新的API可能不支持所有这些过滤参数，暂时保留但可能需要调整
      if (status) params.status = status;

      const response = await cryptoApi.listBacktests<{ 
        success: boolean;
        data: BacktestResult[];
        total: number;
      }>(params);
      
      if (response.success && response.data) {
        const summaries = response.data.map(convertToSummary);
        setBacktests(summaries);
      } else {
        setBacktests([]);
      }
    } catch (error) {
      console.error("加载回测记录失败:", error);
      setBacktests([]);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: BacktestStatus) {
    const statusConfig = {
      [BacktestStatus.PENDING]: { label: "待执行", className: "bg-yellow-100 text-yellow-800" },
      [BacktestStatus.RUNNING]: { label: "执行中", className: "bg-blue-100 text-blue-800" },
      [BacktestStatus.COMPLETED]: { label: "已完成", className: "bg-green-100 text-green-800" },
      [BacktestStatus.FAILED]: { label: "失败", className: "bg-red-100 text-red-800" },
      [BacktestStatus.CANCELLED]: { label: "已取消", className: "bg-gray-100 text-gray-800" },
    };

    const config = statusConfig[status] || statusConfig[BacktestStatus.PENDING];
    
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  }

  function formatNumber(num?: number): string {
    if (num === undefined || num === null) return "-";
    if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (Math.abs(num) >= 1000) return (num / 1000).toFixed(2) + "K";
    return num.toFixed(2);
  }

  function formatPercent(num?: number): string {
    if (num === undefined || num === null) return "-";
    return (num * 100).toFixed(2) + "%";
  }

  function formatDuration(ms?: number): string {
    if (!ms) return "-";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  function openDetail(backtest: BacktestSummary) {
    setSelectedBacktest(backtest);
    setDetailOpen(true);
  }

  function closeDetail() {
    setSelectedBacktest(null);
    setDetailOpen(false);
  }

  // 暂时禁用运行回测功能，因为当前API只提供查询功能
  async function runBacktest(id: string) {
    console.log("暂不支持运行回测，当前只能查看已有结果");
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  if (backtests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无回测记录
      </div>
    );
  }

  return (
    <>
      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">名称</th>
              <th className="p-3 text-left">Symbol</th>
              <th className="p-3 text-left">策略</th>
              <th className="p-3 text-left">状态</th>
              <th className="p-3 text-left">时间范围</th>
              <th className="p-3 text-right">交易次数</th>
              <th className="p-3 text-right">净收益</th>
              <th className="p-3 text-right">收益率</th>
              <th className="p-3 text-right">最大回撤</th>
              <th className="p-3 text-right">夏普比率</th>
              <th className="p-3 text-right">胜率</th>
              <th className="p-3 text-right">耗时</th>
              <th className="p-3 text-left">创建时间</th>
              <th className="p-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {backtests.map((backtest) => (
              <tr key={backtest.id} className="border-b hover:bg-muted/20">
                <td className="p-3 font-medium max-w-48">
                  <div className="truncate" title={backtest.name}>
                    {backtest.name}
                  </div>
                  {backtest.description && (
                    <div className="text-xs text-muted-foreground truncate mt-1" title={backtest.description}>
                      {backtest.description}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div>{backtest.symbol}</div>
                  <div className="text-xs text-muted-foreground">
                    {backtest.exchange}/{backtest.market}
                  </div>
                </td>
                <td className="p-3">{backtest.strategyName}</td>
                <td className="p-3">{getStatusBadge(backtest.status)}</td>
                <td className="p-3 text-xs">
                  <div>{new Date(backtest.startTime).toLocaleDateString()}</div>
                  <div className="text-muted-foreground">
                    {new Date(backtest.endTime).toLocaleDateString()}
                  </div>
                </td>
                <td className="p-3 text-right">{backtest.totalTrades || "-"}</td>
                <td className={`p-3 text-right font-medium ${
                  (backtest.netPnl || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {formatNumber(backtest.netPnl)}
                </td>
                <td className={`p-3 text-right font-medium ${
                  (backtest.totalReturn || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {formatPercent(backtest.totalReturn)}
                </td>
                <td className="p-3 text-right text-red-600">
                  {formatPercent(backtest.maxDrawdown)}
                </td>
                <td className="p-3 text-right">{backtest.sharpeRatio?.toFixed(2) || "-"}</td>
                <td className="p-3 text-right">{formatPercent(backtest.winRate)}</td>
                <td className="p-3 text-right text-muted-foreground">
                  {formatDuration(backtest.duration)}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(backtest.createdAt).toLocaleString()}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(backtest)}
                      className="text-xs"
                    >
                      详情
                    </Button>
                    {/* 暂时隐藏运行按钮，当前API只支持查看结果 */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={closeDetail}>
        <DialogContent className="max-w-6xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>
              {selectedBacktest?.name} - 回测详情
            </DialogTitle>
          </DialogHeader>
          {selectedBacktest && (
            <BacktestDetail backtest={selectedBacktest} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
