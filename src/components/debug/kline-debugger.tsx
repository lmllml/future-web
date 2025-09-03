"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { klineCacheService } from "@/lib/kline-cache";
import { cryptoApi } from "@/lib/api";
import { Bug, RefreshCw, Trash2, Database, Wifi, WifiOff, CheckCircle, XCircle } from "lucide-react";

interface DiagnosticResult {
  name: string;
  status: "success" | "error" | "warning";
  message: string;
  details?: string;
}

export function KlineDebugger() {
  const [isVisible, setIsVisible] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runDiagnostic = async () => {
    setDiagnosing(true);
    const diagnosticResults: DiagnosticResult[] = [];

    try {
      // 1. 检查缓存状态
      const cacheStats = klineCacheService.getCacheStats();
      diagnosticResults.push({
        name: "缓存状态",
        status: cacheStats.totalEntries > 0 ? "success" : "warning",
        message: `${cacheStats.totalEntries} 个缓存条目，${cacheStats.memoryUsageEstimate}`,
        details: `数据点数: ${cacheStats.totalDataPoints.toLocaleString()}，正在进行的请求: ${cacheStats.inflightRequests}`
      });

      // 2. 检查离线模式
      const isOffline = cacheStats.offlineMode;
      diagnosticResults.push({
        name: "连接模式",
        status: isOffline ? "warning" : "success",
        message: isOffline ? "离线模式（仅使用缓存数据）" : "在线模式",
        details: isOffline ? "如果需要最新数据，请切换到在线模式" : "可以请求网络数据"
      });

      // 3. 测试API连接
      try {
        const testParams = {
          symbol: "ETHUSDC",
          exchange: "binance",
          market: "futures",
          interval: "1h",
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          endTime: new Date().toISOString(),
        };

        // 先切换到在线模式进行测试
        const wasOffline = klineCacheService.isOfflineMode();
        klineCacheService.setOfflineMode(false);
        
        const testData = await cryptoApi.listKlines<{ data: any[] }>(testParams);
        
        // 恢复原来的模式
        if (wasOffline) {
          klineCacheService.setOfflineMode(true);
        }

        diagnosticResults.push({
          name: "API连接",
          status: "success",
          message: `API正常，获取到 ${testData.data?.length || 0} 条数据`,
          details: "后端服务响应正常"
        });
      } catch (error) {
        diagnosticResults.push({
          name: "API连接",
          status: "error",
          message: "API请求失败",
          details: error instanceof Error ? error.message : "未知错误"
        });
      }

      // 4. 检查缓存数据完整性
      try {
        const testSymbol = "ETHUSDC";
        const cachedData = klineCacheService.getKlinesFromCache({
          symbol: testSymbol,
          exchange: "binance",
          market: "futures",
          interval: "1m",
          startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date().toISOString(),
        });

        diagnosticResults.push({
          name: "缓存数据",
          status: cachedData.length > 0 ? "success" : "warning",
          message: `${testSymbol} 缓存中有 ${cachedData.length} 条数据`,
          details: cachedData.length > 0 ? `最新数据时间: ${cachedData[cachedData.length - 1]?.openTime || "N/A"}` : "缓存中无数据"
        });
      } catch (error) {
        diagnosticResults.push({
          name: "缓存数据",
          status: "error",
          message: "缓存数据读取失败",
          details: error instanceof Error ? error.message : "未知错误"
        });
      }

      // 5. 检查缓存服务状态
      const endTime = klineCacheService.getCachedEndTime({
        symbol: "ETHUSDC",
        exchange: "binance", 
        market: "futures",
        interval: "1m"
      });

      diagnosticResults.push({
        name: "缓存时间范围",
        status: endTime ? "success" : "warning",
        message: endTime ? `数据覆盖到: ${endTime}` : "无缓存时间信息",
        details: endTime ? "缓存有明确的时间范围" : "可能需要重新加载数据"
      });

    } catch (error) {
      diagnosticResults.push({
        name: "诊断过程",
        status: "error",
        message: "诊断过程出现错误",
        details: error instanceof Error ? error.message : "未知错误"
      });
    }

    setResults(diagnosticResults);
    setDiagnosing(false);
  };

  const fixCommonIssues = async () => {
    try {
      // 1. 强制重置缓存服务
      klineCacheService.forceReset();
      
      // 2. 重新预加载一些基础数据
      await klineCacheService.preloadKlines({
        symbols: ["ETHUSDC", "BTCUSDC"],
        exchange: "binance",
        market: "futures", 
        intervals: ["1m", "1h"],
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      });

      // 3. 重新运行诊断
      await runDiagnostic();

      alert("修复完成！缓存服务已重置并重新加载基础数据。");
    } catch (error) {
      alert(`修复失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  const StatusIcon = ({ status }: { status: "success" | "error" | "warning" }) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "warning":
        return <Bug className="w-4 h-4 text-yellow-600" />;
    }
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-16 right-4 z-50 bg-white/90 backdrop-blur-sm border-gray-200 hover:bg-gray-50"
      >
        <Bug className="w-4 h-4 mr-1" />
        K线诊断
      </Button>
    );
  }

  return (
    <div className="fixed bottom-16 right-4 z-50 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-4 shadow-lg min-w-[400px] max-h-[600px] overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm flex items-center">
          <Bug className="w-4 h-4 mr-1" />
          K线数据诊断
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(false)}
          className="h-6 w-6 p-0"
        >
          ×
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runDiagnostic}
            disabled={diagnosing}
            className="flex-1 text-xs"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${diagnosing ? 'animate-spin' : ''}`} />
            运行诊断
          </Button>
          <Button
            variant="outline" 
            size="sm"
            onClick={fixCommonIssues}
            className="flex-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <Database className="w-3 h-3 mr-1" />
            自动修复
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              klineCacheService.setOfflineMode(false);
              runDiagnostic();
            }}
            className="flex-1 text-xs"
          >
            <Wifi className="w-3 h-3 mr-1" />
            在线模式
          </Button>
          <Button
            variant="outline"
            size="sm" 
            onClick={() => {
              klineCacheService.setOfflineMode(true);
              runDiagnostic();
            }}
            className="flex-1 text-xs"
          >
            <WifiOff className="w-3 h-3 mr-1" />
            离线模式
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              klineCacheService.clearCache();
              runDiagnostic();
            }}
            className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            清空缓存
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              klineCacheService.forceReset();
              runDiagnostic();
            }}
            className="flex-1 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            完全重置
          </Button>
        </div>

        {results.length > 0 && (
          <div className="border-t pt-3">
            <h4 className="text-xs font-medium mb-2">诊断结果:</h4>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="p-2 border rounded-md text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusIcon status={result.status} />
                    <span className="font-medium">{result.name}</span>
                  </div>
                  <div className="text-gray-700 mb-1">{result.message}</div>
                  {result.details && (
                    <div className="text-gray-500 text-[10px]">{result.details}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {diagnosing && (
          <div className="text-center py-4">
            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
            <div className="text-xs text-gray-600">正在诊断...</div>
          </div>
        )}
      </div>
    </div>
  );
}
