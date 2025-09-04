"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CumulativePnlDialog } from "@/components/charts/cumulative-pnl-dialog";
import { RiskAnalysisDialog } from "@/components/risk-analysis/risk-analysis-dialog";
import { TrendingUp, Shield } from "lucide-react";

interface Props {
  exchange: string;
  market: string;
  symbol: string;
  loading?: boolean;
  // 筛选参数，用于API调用
  minPnl?: number;
  maxPnl?: number;
  minQuantity?: number;
  maxQuantity?: number;
  positionSide?: "LONG" | "SHORT";
  startTime?: string;
  endTime?: string;
}

export function AnalysisSidebar({
  exchange,
  market,
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
  const [showRiskAnalysis, setShowRiskAnalysis] = useState(false);

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

          {/* 最佳止盈止损分析 */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowRiskAnalysis(true)}
            disabled={loading}
          >
            <Shield className="w-4 h-4 mr-2" />
            最佳止盈止损分析
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

      {/* 最佳止盈止损分析弹窗 */}
      <RiskAnalysisDialog
        open={showRiskAnalysis}
        onOpenChange={setShowRiskAnalysis}
        exchange={exchange}
        market={market}
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
