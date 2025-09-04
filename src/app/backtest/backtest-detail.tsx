"use client";

import { useEffect, useState } from "react";
import { cryptoApi } from "@/lib/api";
import { BacktestSummary, BacktestResult, BacktestConfig } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  backtest: BacktestSummary;
}

export function BacktestDetail({ backtest }: Props) {
  const [config, setConfig] = useState<BacktestConfig | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBacktestDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backtest.id]);

  async function loadBacktestDetails() {
    setLoading(true);
    try {
      const response = await cryptoApi.getBacktestResult<{ 
        success: boolean;
        data: BacktestResult;
      }>(backtest.id);
      
      if (response.success && response.data) {
        setResult(response.data);
        // 暂时不设置config，因为新API不提供配置信息
        setConfig(null);
      }
    } catch (error) {
      console.error("加载回测详情失败:", error);
    } finally {
      setLoading(false);
    }
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

    if (days > 0) return `${days}天 ${hours % 24}小时`;
    if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`;
    if (minutes > 0) return `${minutes}分钟 ${seconds % 60}秒`;
    return `${seconds}秒`;
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="trades">交易记录</TabsTrigger>
          <TabsTrigger value="performance">性能分析</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {result ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">净盈亏</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${result.netPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatNumber(result.netPnl)} USDC
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">收益率</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${result.totalReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatPercent(result.totalReturn)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">胜率</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercent(result.winRate)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">夏普比率</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {result.sharpeRatio.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">总交易</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {result.totalTrades}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    盈利 {result.winningTrades} | 亏损 {result.losingTrades}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">最大回撤</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatPercent(result.maxDrawdown)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">盈利因子</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {result.profitFactor.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">执行时间</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatDuration(result.duration)}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {backtest.status === 'PENDING' ? '等待执行...' : '暂无结果数据'}
            </div>
          )}
        </TabsContent>


        <TabsContent value="trades">
          {result?.trades && result.trades.length > 0 ? (
            <div className="overflow-auto border rounded max-h-96">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">时间</th>
                    <th className="p-2 text-left">方向</th>
                    <th className="p-2 text-left">类型</th>
                    <th className="p-2 text-right">价格</th>
                    <th className="p-2 text-right">数量</th>
                    <th className="p-2 text-right">金额</th>
                    <th className="p-2 text-right">盈亏</th>
                    <th className="p-2 text-right">手续费</th>
                    <th className="p-2 text-left">触发原因</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((trade) => (
                    <tr key={trade.id} className="border-b hover:bg-muted/20">
                      <td className="p-2">{new Date(trade.timestamp).toLocaleString()}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          trade.side === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="p-2">{trade.type}</td>
                      <td className="p-2 text-right">{trade.price.toFixed(4)}</td>
                      <td className="p-2 text-right">{trade.quantity.toFixed(4)}</td>
                      <td className="p-2 text-right">{formatNumber(trade.notional)}</td>
                      <td className={`p-2 text-right ${
                        (trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {trade.pnl ? formatNumber(trade.pnl) : "-"}
                      </td>
                      <td className="p-2 text-right">{formatNumber(trade.fee)}</td>
                      <td className="p-2 text-xs">{trade.trigger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无交易记录
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance">
          {result ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">交易统计</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均盈利:</span>
                    <span className="text-green-600">{formatNumber(result.avgWin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均亏损:</span>
                    <span className="text-red-600">{formatNumber(result.avgLoss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均持仓时间:</span>
                    <span>{formatDuration(result.averageTradeDuration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最大连胜:</span>
                    <span>{result.maxConsecutiveWins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最大连亏:</span>
                    <span>{result.maxConsecutiveLosses}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">风险指标</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">年化收益率:</span>
                    <span className={result.annualizedReturn >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatPercent(result.annualizedReturn)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">波动率:</span>
                    <span>{formatPercent(result.volatility)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">索提诺比率:</span>
                    <span>{result.sortinoRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">卡尔马比率:</span>
                    <span>{result.calmarRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最大回撤日期:</span>
                    <span className="text-xs">
                      {result.maxDrawdownDate ? new Date(result.maxDrawdownDate).toLocaleDateString() : "-"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无性能数据
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
