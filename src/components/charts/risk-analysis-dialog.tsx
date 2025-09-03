"use client";

import { Dialog, DialogContent, DialogTitle, DialogHeader } from "../ui/dialog";
import { useEffect, useState } from "react";
import { cryptoApi } from "@/lib/api";

// 矩阵数据项类型
interface MatrixItem {
  realizedPnl: number;
  unrealizedPnl: number;
  totalCount: number;
  unfinishedCount: number;
}

// 矩阵数据结构类型
interface RiskMatrix {
  matrix: Record<number, Record<number, MatrixItem>>;
}

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
  positionSide?: "LONG" | "SHORT";
  startTime?: string;
  endTime?: string;
}

export default function RiskAnalysisDialog({
  symbol, // 币种
  exchange, // 交易所
  market, // 市场
  open, // 是否打开
  onOpenChange, // 是否打开改变
  minPnl, // 最小盈亏
  maxPnl, // 最大盈亏
  minQuantity, // 最小数量
  maxQuantity, // 最大数量
  positionSide, // 持仓方向
  startTime, // 开始时间
  endTime, // 结束时间
}: Props) {
  const [data, setData] = useState<RiskMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取矩阵数据
  const fetchMatrixData = async () => {
    if (!symbol) return;

    setLoading(true);
    setError(null);
    try {
      const params = {
        symbol,
        exchange,
        market,
        startTime,
        endTime,
        minPnl,
        maxPnl,
        minQuantity,
        maxQuantity,
        positionSide,
      };

      const result = await cryptoApi.getRiskMatrix<RiskMatrix>(params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 当弹框打开且参数变化时获取数据
  useEffect(() => {
    if (open) {
      fetchMatrixData();
    }
  }, [open, symbol, exchange, market, startTime, endTime, minPnl, maxPnl, minQuantity, maxQuantity, positionSide]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>止盈止损分析矩阵 - {symbol}</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">加载中...</span>
            </div>
          )}

          {error && (
            <div className="text-red-600 bg-red-50 p-4 rounded-lg">
              错误：{error}
            </div>
          )}

          {data && !loading && !error && (
            <RiskMatrixTable matrix={data.matrix} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 矩阵表格组件
function RiskMatrixTable({ matrix }: { matrix: Record<number, Record<number, MatrixItem>> }) {
  // 获取所有止损百分比和止盈百分比，并排序
  const stopLossLevels = Object.keys(matrix).map(Number).sort((a, b) => a - b);
  const takeProfitLevels = Array.from(
    new Set(
      Object.values(matrix)
        .flatMap(takeProfitMap => Object.keys(takeProfitMap).map(Number))
    )
  ).sort((a, b) => a - b);

  if (stopLossLevels.length === 0 || takeProfitLevels.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无数据
      </div>
    );
  }

  // 格式化数字显示
  const formatNumber = (num: number) => {
    if (Math.abs(num) < 0.01) return num.toFixed(4);
    if (Math.abs(num) < 1) return num.toFixed(3);
    if (Math.abs(num) < 100) return num.toFixed(2);
    return num.toFixed(0);
  };

  // 获取颜色样式（基于总盈亏）
  const getCellStyle = (item: MatrixItem) => {
    const totalPnl = item.realizedPnl + item.unrealizedPnl;
    if (totalPnl > 0) {
      const intensity = Math.min(Math.abs(totalPnl) / 1000, 1); // 假设1000为最大值
      return {
        backgroundColor: `rgba(34, 197, 94, ${0.1 + intensity * 0.3})`, // 绿色
        color: totalPnl > 500 ? 'white' : 'inherit'
      };
    } else if (totalPnl < 0) {
      const intensity = Math.min(Math.abs(totalPnl) / 1000, 1);
      return {
        backgroundColor: `rgba(239, 68, 68, ${0.1 + intensity * 0.3})`, // 红色
        color: totalPnl < -500 ? 'white' : 'inherit'
      };
    }
    return {};
  };

  return (
    <div className="overflow-auto">
      <div className="mb-4 text-sm text-gray-600">
        <p>• 绿色表示盈利，红色表示亏损，颜色深浅表示盈亏程度</p>
        <p>• 数据格式：总盈亏 (已实现 + 未实现) | 总交易数 (未完成数)</p>
      </div>
      
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border border-gray-300 p-2 bg-gray-100 font-semibold">
              止损% \ 止盈%
            </th>
            {takeProfitLevels.map(takeProfit => (
              <th key={takeProfit} className="border border-gray-300 p-2 bg-gray-100 font-semibold min-w-[120px]">
                {takeProfit}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stopLossLevels.map(stopLoss => (
            <tr key={stopLoss}>
              <td className="border border-gray-300 p-2 bg-gray-50 font-semibold">
                {stopLoss}%
              </td>
              {takeProfitLevels.map(takeProfit => {
                const item = matrix[stopLoss]?.[takeProfit];
                if (!item) {
                  return (
                    <td key={takeProfit} className="border border-gray-300 p-2 text-center text-gray-400">
                      -
                    </td>
                  );
                }

                const totalPnl = item.realizedPnl + item.unrealizedPnl;
                const style = getCellStyle(item);

                return (
                  <td
                    key={takeProfit}
                    className="border border-gray-300 p-2 text-center text-xs"
                    style={style}
                  >
                    <div className="font-semibold">
                      {formatNumber(totalPnl)}
                    </div>
                    <div className="text-gray-600" style={{ color: style.color || 'inherit' }}>
                      ({formatNumber(item.realizedPnl)} + {formatNumber(item.unrealizedPnl)})
                    </div>
                    <div className="text-gray-500" style={{ color: style.color || 'inherit' }}>
                      {item.totalCount} ({item.unfinishedCount})
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
