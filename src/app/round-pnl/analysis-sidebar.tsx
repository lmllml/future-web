"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CumulativePnlDialog } from "@/components/charts/cumulative-pnl-dialog";
import { StopLossDialog } from "@/components/charts/stop-loss-dialog";
import { TrendingUp, Shield } from "lucide-react";

interface Props {
  symbol: string;
  loading?: boolean;
  // 筛选参数，用于API调用
  minPnl?: number;
  maxPnl?: number;
  minQuantity?: number;
  maxQuantity?: number;
  positionSide?: "LONG" | "SHORT" | "ALL";
  startTime?: string;
  endTime?: string;
}

export function AnalysisSidebar({
  symbol,
  loading,
  minPnl,
  maxPnl,
  minQuantity,
  maxQuantity,
  positionSide,
  startTime,
  endTime,
}: Props) {
  const [showCumulativePnl, setShowCumulativePnl] = useState(false);
  const [showStopLoss, setShowStopLoss] = useState(false);

  return (
    <div className="w-64 flex-shrink-0">
      <div className="bg-card border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-4 text-muted-foreground">
          数据分析
        </h3>
        <div className="space-y-3">
          {/* 累计盈亏图表 */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowCumulativePnl(true)}
            disabled={loading}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            累计盈亏趋势
          </Button>

          {/* 计算最佳止损点 */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowStopLoss(true)}
            disabled={loading}
          >
            <Shield className="w-4 h-4 mr-2" />
            计算最佳止损点
          </Button>
        </div>
      </div>

      {/* 累计盈亏弹窗 */}
      <CumulativePnlDialog
        open={showCumulativePnl}
        onOpenChange={setShowCumulativePnl}
        symbol={symbol}
        minPnl={minPnl}
        maxPnl={maxPnl}
        minQuantity={minQuantity}
        maxQuantity={maxQuantity}
        positionSide={positionSide}
        startTime={startTime}
        endTime={endTime}
      />

      {/* 止损分析弹窗 */}
      <RiskAnalysisDialog
        open={showStopLoss}
        onOpenChange={setShowStopLoss}
        symbol={symbol}
        minPnl={minPnl}
        maxPnl={maxPnl}
        minQuantity={minQuantity}
        maxQuantity={maxQuantity}
        positionSide={positionSide}
        startTime={startTime}
        endTime={endTime}
      />
    </div>
  );
}
