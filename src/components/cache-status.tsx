"use client";

import { useState, useEffect } from "react";
import { klineCacheService } from "@/lib/kline-cache";
import { Button } from "@/components/ui/button";
import { Database, Trash2, RefreshCw } from "lucide-react";

interface CacheStats {
  totalEntries: number;
  totalDataPoints: number;
  memoryUsageEstimate: string;
}

export function CacheStatus() {
  const [stats, setStats] = useState<CacheStats>({
    totalEntries: 0,
    totalDataPoints: 0,
    memoryUsageEstimate: "0 MB",
  });
  const [isVisible, setIsVisible] = useState(false);

  const updateStats = () => {
    setStats(klineCacheService.getCacheStats());
  };

  useEffect(() => {
    updateStats();
    // 每30秒更新一次统计信息
    const interval = setInterval(updateStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    klineCacheService.clearCache();
    updateStats();
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-white/90 backdrop-blur-sm border-gray-200 hover:bg-gray-50"
      >
        <Database className="w-4 h-4 mr-1" />
        缓存
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-4 shadow-lg min-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm flex items-center">
          <Database className="w-4 h-4 mr-1" />
          K线缓存状态
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

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">缓存条目:</span>
          <span className="font-mono">{stats.totalEntries}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">数据点数:</span>
          <span className="font-mono">
            {stats.totalDataPoints.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">内存估算:</span>
          <span className="font-mono">{stats.memoryUsageEstimate}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={updateStats}
          className="flex-1 h-7 text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          刷新
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearCache}
          className="flex-1 h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          清空
        </Button>
      </div>

      {/* 内存使用提示 */}
      {parseFloat(stats.memoryUsageEstimate.replace(" MB", "")) > 50 && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          ⚠️ 缓存使用量较高，建议定期清理
        </div>
      )}

      {/* 缓存效果说明 */}
      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        💡 缓存可显著提升止盈止损分析性能，避免重复请求K线数据
      </div>
    </div>
  );
}
