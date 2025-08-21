"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KlineChart, TimeFrame } from "./kline-chart";
import { KlineData, RoundPnlData } from "@/lib/types";
import { cryptoApi } from "@/lib/api";

interface KlineDialogProps {
  round: RoundPnlData;
  trigger?: React.ReactNode;
  onTimeFrameChange?: (timeFrame: TimeFrame) => void;
}

export function KlineDialog({
  round,
  trigger,
  onTimeFrameChange,
}: KlineDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentTimeFrame, setCurrentTimeFrame] = useState<TimeFrame>("1h");
  const [dialogReady, setDialogReady] = useState(false);
  const [displayKlines, setDisplayKlines] = useState<KlineData[]>([]);
  const [tfLoading, setTfLoading] = useState(false);

  // 时间段选择状态
  const currentYear = new Date().getFullYear();
  const [startTime, setStartTime] = useState(
    `${currentYear}-01-01T00:00:00.000Z`
  );
  const [endTime, setEndTime] = useState(`${currentYear}-12-31T23:59:59.999Z`);

  const handleTimeFrameChange = useCallback(
    (newTimeFrame: TimeFrame) => {
      setCurrentTimeFrame(newTimeFrame);
      if (onTimeFrameChange) {
        onTimeFrameChange(newTimeFrame);
      }
    },
    [onTimeFrameChange]
  );

  // 在对话框打开时重置时间周期并等待DOM准备
  useEffect(() => {
    if (open) {
      setCurrentTimeFrame("1h");
      setDisplayKlines([]);
      setDialogReady(false);
      // 等待对话框完全打开后再渲染图表
      const timer = setTimeout(() => {
        setDialogReady(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDialogReady(false);
    }
  }, [open]);

  // 时间周期或时间段变化时拉取数据（不使用limit）
  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      try {
        setTfLoading(true);
        const { data } = await cryptoApi.listKlines<{ data: KlineData[] }>({
          symbol: round.symbol,
          exchange: round.exchange || "binance",
          market: round.market || "futures",
          interval: currentTimeFrame,
          startTime,
          endTime,
          order: "asc",
          // 不传递 limit，让后端返回所有数据
        });
        setDisplayKlines(data);
      } catch (e) {
        console.error("加载K线失败:", e);
      } finally {
        setTfLoading(false);
      }
    };
    fetch();
  }, [
    currentTimeFrame,
    startTime,
    endTime,
    open,
    round.symbol,
    round.exchange,
    round.market,
  ]);

  // 处理时间段选择
  const handleRangeApply = useCallback(
    (startTimeISO: string, endTimeISO: string) => {
      setStartTime(startTimeISO);
      setEndTime(endTimeISO);
    },
    []
  );

  // 已移除增量加载逻辑，统一拉取全量数据

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
      📈 查看K线
    </Button>
  );

  const dialogTitle = `${round.symbol} 回合K线图`;
  const timeRange = `${new Date(round.openTime).toLocaleString()} → ${new Date(
    round.closeTime
  ).toLocaleString()}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>

      <DialogContent className="max-w-6xl w-[90vw] h-[80vh] max-h-[900px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {dialogTitle}
          </DialogTitle>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>回合时间范围: {timeRange}</div>
            <div className="flex gap-4">
              <span>数量: {round.totalQuantity.toFixed(4)}</span>
              <span>开仓: {round.avgEntryPrice.toFixed(4)}</span>
              <span>平仓: {round.avgExitPrice.toFixed(4)}</span>
              <span
                className={`font-medium ${
                  round.realizedPnl >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                盈亏: {round.realizedPnl.toFixed(4)}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 -mx-6 px-6">
          {tfLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-muted-foreground">
                正在加载K线数据...
              </div>
            </div>
          ) : displayKlines.length > 0 && dialogReady ? (
            <div className="h-full w-full">
              <KlineChart
                key={`${round.roundId}-${open}-${dialogReady}`}
                data={displayKlines}
                height={450}
                entryPrice={round.avgEntryPrice}
                exitPrice={round.avgExitPrice}
                className="w-full h-full"
                timeFrame={currentTimeFrame}
                onTimeFrameChange={handleTimeFrameChange}
                showTimeFrameSelector={true}
                startTime={startTime}
                endTime={endTime}
                onRangeApply={handleRangeApply}
                showRangeSelector={true}
              />
            </div>
          ) : displayKlines.length > 0 && !dialogReady ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-muted-foreground">
                正在准备图表...
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <div className="text-lg mb-2">📈</div>
                <div>暂无K线数据</div>
                <div className="text-sm mt-1">该时间段内可能没有交易记录</div>
              </div>
            </div>
          )}
        </div>

        {/* 底部统计信息 */}
        {displayKlines.length > 0 && (
          <div className="border-t pt-3 text-xs text-muted-foreground">
            <div className="flex justify-between items-center">
              <div className="flex gap-6">
                <span>K线数量: {displayKlines.length} 根</span>
                <span>时间间隔: {currentTimeFrame}</span>
                {displayKlines.length > 0 && (
                  <>
                    <span>
                      最高价:{" "}
                      {Math.max(...displayKlines.map((k) => k.high)).toFixed(4)}
                    </span>
                    <span>
                      最低价:{" "}
                      {Math.min(...displayKlines.map((k) => k.low)).toFixed(4)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-4">
                <span>开仓交易: {round.openTradeIds?.length || 0}</span>
                <span>平仓交易: {round.closeTradeIds?.length || 0}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
