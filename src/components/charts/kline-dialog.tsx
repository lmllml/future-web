"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KlineChart, TimeFrame, MarketType } from "./kline-chart";
import { KlineData, RoundPnlData, TradeData } from "@/lib/types";
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
  const [openTrades, setOpenTrades] = useState<TradeData[]>([]);
  const [closeTrades, setCloseTrades] = useState<TradeData[]>([]);
  const [currentSymbol, setCurrentSymbol] = useState<string>(round.symbol);
  const [currentMarket, setCurrentMarket] = useState<MarketType>(
    round.market as MarketType
  );

  // 使用useMemo来稳定trade IDs字符串，避免useEffect依赖数组大小变化
  const openTradeIdsStr = useMemo(
    () => round.openTradeIds.join(","),
    [round.openTradeIds]
  );
  const closeTradeIdsStr = useMemo(
    () => round.closeTradeIds.join(","),
    [round.closeTradeIds]
  );

  // 全屏状态管理
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);

  // 全屏切换功能
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // ESC键退出全屏
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        toggleFullscreen();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }
  }, [open, isFullscreen, toggleFullscreen]);

  // 时间段选择状态 - 以开仓时间和平仓时间为中心设置初始范围
  const getInitialTimeRange = useCallback(() => {
    const entryDate = new Date(round.openTime);
    const exitDate = new Date(round.closeTime);

    // 至少要拉取开仓时间之前一个月、平仓时间之后一个月的 K 线
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000; // 30天的毫秒数
    const startTime = new Date(entryDate.getTime() - oneMonthMs).toISOString();
    const endTime = new Date(exitDate.getTime() + oneMonthMs).toISOString();

    return { startTime, endTime };
  }, [round.openTime, round.closeTime]);

  const [startTime, setStartTime] = useState(
    () => getInitialTimeRange().startTime
  );
  const [endTime, setEndTime] = useState(() => getInitialTimeRange().endTime);

  const handleTimeFrameChange = useCallback(
    (newTimeFrame: TimeFrame) => {
      setCurrentTimeFrame(newTimeFrame);
      if (onTimeFrameChange) {
        onTimeFrameChange(newTimeFrame);
      }
    },
    [onTimeFrameChange]
  );

  const handleSymbolChange = useCallback((newSymbol: string) => {
    console.log("切换symbol:", newSymbol);
    setCurrentSymbol(newSymbol);
    // 重置状态，因为切换了symbol
    setOpenTrades([]);
    setCloseTrades([]);
    setDialogReady(false);
    setDisplayKlines([]); // 清除旧数据
  }, []);

  const handleMarketChange = useCallback((newMarket: MarketType) => {
    console.log("切换market:", newMarket);
    setCurrentMarket(newMarket);
    // 重置状态，因为切换了market
    setOpenTrades([]);
    setCloseTrades([]);
    setDialogReady(false);
    setDisplayKlines([]); // 清除旧数据
  }, []);

  // 在对话框打开时重置时间周期并等待DOM准备
  useEffect(() => {
    if (open) {
      setCurrentTimeFrame("1h");
      setDisplayKlines([]);
      setDialogReady(false);

      // 重新基于开仓和平仓时间设置时间范围
      const { startTime: newStartTime, endTime: newEndTime } =
        getInitialTimeRange();
      setStartTime(newStartTime);
      setEndTime(newEndTime);

      // 等待对话框完全打开后再渲染图表
      const timer = setTimeout(() => {
        setDialogReady(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDialogReady(false);
    }
  }, [open, round.openTime, round.closeTime]);

  // 时间周期或时间段变化时拉取数据（不使用limit）
  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      try {
        setTfLoading(true);
        console.log("获取K线数据:", {
          symbol: currentSymbol,
          market: currentMarket,
          timeFrame: currentTimeFrame,
        });
        const { data } = await cryptoApi.listKlines<{ data: KlineData[] }>({
          symbol: currentSymbol,
          exchange: round.exchange || "binance",
          market: currentMarket,
          interval: currentTimeFrame,
          startTime,
          endTime,
          order: "asc",
          // 不传递 limit，让后端返回所有数据
        });
        console.log("K线数据获取成功:", data?.length, "条");
        console.log("设置displayKlines:", data);
        setDisplayKlines(data || []);
        // 数据加载完成后，重新设置dialogReady为true
        setTimeout(() => {
          setDialogReady(true);
        }, 50);
      } catch (e) {
        console.error("加载K线失败:", e);
        // 即使出错也要设置dialogReady为true，显示错误信息而不是一直加载
        setDialogReady(true);
      } finally {
        setTfLoading(false);
      }
    };
    fetch();
  }, [
    currentTimeFrame,
    currentSymbol,
    currentMarket,
    startTime,
    endTime,
    open,
    round.exchange,
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

  // 获取原始交易数据（仅在原始symbol/market时获取）
  useEffect(() => {
    if (!open) return;

    // 只有当前选择的symbol和market与原始round数据一致时，才获取交易数据
    if (currentSymbol !== round.symbol || currentMarket !== round.market) {
      setOpenTrades([]);
      setCloseTrades([]);
      return;
    }

    const fetchOriginalTrades = async () => {
      try {
        if (round.openTradeIds.length > 0) {
          const openTradesData = await cryptoApi.getTradesByIds<{
            data: TradeData[];
          }>({
            symbol: round.symbol,
            exchange: round.exchange,
            market: round.market,
            tradeIds: round.openTradeIds.join(","),
          });
          setOpenTrades(openTradesData.data || []);
        }

        if (round.closeTradeIds.length > 0) {
          const closeTradesData = await cryptoApi.getTradesByIds<{
            data: TradeData[];
          }>({
            symbol: round.symbol,
            exchange: round.exchange,
            market: round.market,
            tradeIds: round.closeTradeIds.join(","),
          });
          setCloseTrades(closeTradesData.data || []);
        }
      } catch (error) {
        console.error("获取原始交易数据失败:", error);
        // 如果获取失败，重置为空数组，会使用平均价格
        setOpenTrades([]);
        setCloseTrades([]);
      }
    };

    fetchOriginalTrades();
  }, [
    open,
    currentSymbol,
    currentMarket,
    round.symbol,
    round.market,
    openTradeIdsStr,
    closeTradeIdsStr,
    round.exchange,
  ]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>

      <DialogContent
        className={`
          ${
            isFullscreen
              ? "max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] m-0 rounded-none"
              : "max-w-6xl w-[90vw] h-[80vh] max-h-[900px]"
          } 
          flex flex-col
        `}
      >
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
          ) : !dialogReady ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-muted-foreground">
                正在准备图表...
              </div>
            </div>
          ) : displayKlines.length > 0 ? (
            <div className="h-full w-full">
              <KlineChart
                key={`chart-${currentSymbol}-${currentMarket}-${isFullscreen}`}
                data={displayKlines}
                height={isFullscreen ? 700 : 500}
                entryPrice={round.avgEntryPrice}
                exitPrice={round.avgExitPrice}
                className="w-full h-full"
                timeFrame={currentTimeFrame}
                onTimeFrameChange={handleTimeFrameChange}
                showTimeFrameSelector={true}
                symbol={currentSymbol}
                market={currentMarket}
                onSymbolChange={handleSymbolChange}
                onMarketChange={handleMarketChange}
                showSymbolSelector={true}
                showMarketSelector={true}
                startTime={startTime}
                endTime={endTime}
                onRangeApply={handleRangeApply}
                showRangeSelector={true}
                entryTime={round.openTime}
                exitTime={round.closeTime}
                focusRangeSignal={focusSignal}
                totalQuantity={round.totalQuantity}
                totalFees={round.totalFees}
                realizedPnl={round.realizedPnl}
                positionSide={round.positionSide}
                openTrades={openTrades}
                closeTrades={closeTrades}
              />
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
          <div className="border-t pt-3 text-xs text-muted-foreground pr-10">
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

        {/* 右下角：全屏按钮 + 快速定位按钮 */}
        <button
          onClick={toggleFullscreen}
          className={`absolute ${
            displayKlines.length > 0 ? "bottom-[4.5rem]" : "bottom-4"
          } right-4 p-2 bg-white/95 hover:bg-white shadow-lg rounded-full transition-all duration-200 hover:scale-110 z-30 border border-gray-200`}
          title={isFullscreen ? "退出全屏 (Esc)" : "进入全屏 (Ctrl+Enter)"}
          aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
        >
          {isFullscreen ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>

        {/* 快速定位按钮：聚焦到开/平仓时间区间 */}
        <button
          onClick={() => setFocusSignal((v) => v + 1)}
          className={`absolute ${
            displayKlines.length > 0 ? "bottom-[4.5rem]" : "bottom-4"
          } right-16 p-2 bg-white/95 hover:bg-white shadow-lg rounded-full transition-all duration-200 hover:scale-110 z-30 border border-gray-200`}
          title="定位到开/平仓区间"
          aria-label="定位到开/平仓区间"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          </svg>
        </button>
      </DialogContent>
    </Dialog>
  );
}
