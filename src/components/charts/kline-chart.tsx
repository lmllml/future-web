"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { KlineData } from "@/lib/types";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { createSeriesMarkers, HistogramSeries } from "lightweight-charts";

export type TimeFrame = "1m" | "15m" | "1h" | "1d";
export type MarketType = "futures" | "spot";

interface KlineChartProps {
  data: KlineData[];
  height?: number;
  entryPrice?: number;
  exitPrice?: number;
  className?: string;
  timeFrame?: TimeFrame;
  onTimeFrameChange?: (timeFrame: TimeFrame) => void;
  showTimeFrameSelector?: boolean;
  // 新增：symbol和market选择
  symbol?: string;
  market?: MarketType;
  onSymbolChange?: (symbol: string) => void;
  onMarketChange?: (market: MarketType) => void;
  showSymbolSelector?: boolean;
  showMarketSelector?: boolean;
  onLoadMore?: (direction: "left" | "right", boundaryTimeMs?: number) => void;
  isLoadingMore?: boolean;
  lastLoadDirection?: "left" | "right" | null;
  addedCount?: number;
  // 新增：时间段选择（仅负责发出事件，不直接请求）
  startTime?: string; // ISO
  endTime?: string; // ISO
  onRangeApply?: (startTimeISO: string, endTimeISO: string) => void;
  showRangeSelector?: boolean;
  // 新增：开仓平仓时间，用于初始聚焦
  entryTime?: string; // ISO
  exitTime?: string; // ISO
  // 外部触发聚焦信号：每次值变化会触发一次聚焦到开/平仓时间段
  focusRangeSignal?: number;
  // 新增：开仓平仓详细信息，用于标注
  // 控制标记类型：true为只显示时间，false为显示价格和时间
  useTimeMarkersOnly?: boolean;
  totalQuantity?: number;
  totalFees?: number;
  realizedPnl?: number;
  // 新增：仓位方向
  positionSide?: "LONG" | "SHORT";
  // 新增：原始交易订单数据
  openTrades?: Array<{
    tradeId: string;
    price: number;
    quantity: number;
    timestamp: string;
    commission: number;
    side?: "BUY" | "SELL";
    orderId?: string;
  }>;
  closeTrades?: Array<{
    tradeId: string;
    price: number;
    quantity: number;
    timestamp: string;
    commission: number;
    side?: "BUY" | "SELL";
    orderId?: string;
  }>;
}

const TIME_FRAME_OPTIONS: { label: string; value: TimeFrame }[] = [
  { label: "1分", value: "1m" },
  { label: "15分", value: "15m" },
  { label: "1小时", value: "1h" },
  { label: "1天", value: "1d" },
];

const SYMBOL_OPTIONS: { label: string; value: string }[] = [
  { label: "ETHUSDC", value: "ETHUSDC" },
  { label: "ETHUSDT", value: "ETHUSDT" },
];

const MARKET_OPTIONS: { label: string; value: MarketType }[] = [
  { label: "期货", value: "futures" },
  { label: "现货", value: "spot" },
];

export function KlineChart({
  data,
  height = 120,
  entryPrice,
  exitPrice,
  className = "",
  timeFrame = "1h",
  onTimeFrameChange,
  showTimeFrameSelector = true,
  symbol = "ETHUSDC",
  market = "futures",
  onSymbolChange,
  onMarketChange,
  showSymbolSelector = false,
  showMarketSelector = false,
  onLoadMore,
  isLoadingMore = false,
  lastLoadDirection = null,
  addedCount = 0,
  startTime,
  endTime,
  onRangeApply,
  showRangeSelector = false,
  entryTime,
  exitTime,
  focusRangeSignal = 0,
  useTimeMarkersOnly = false,
  totalQuantity,
  totalFees,
  realizedPnl,
  positionSide,
  openTrades,
  closeTrades,
}: KlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null); // ISeriesApi
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const entryLineRef = useRef<any>(null);
  const exitLineRef = useRef<any>(null);
  const markersRef = useRef<any>(null); // SeriesMarkers primitive
  const lastRangeCheckAtRef = useRef<number>(0);
  const loadCooldownMsRef = useRef<number>(500);
  const isLoadingMoreRef = useRef<boolean>(false);
  const prevLenRef = useRef<number>(0);
  const rangeDraftRef = useRef<{ start?: string; end?: string }>({});
  const lastCandlesRef = useRef<any[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // 跟踪外部加载状态，避免滑动时重复触发
  useEffect(() => {
    isLoadingMoreRef.current = !!isLoadingMore;
  }, [isLoadingMore]);

  // 初始化图表（仅一次）
  useEffect(() => {
    console.log("图表初始化useEffect触发");
    if (chartRef.current || !containerRef.current) {
      console.log("图表已存在或容器不存在，跳过初始化");
      return;
    }

    console.log("开始图表初始化");
    let isMounted = true;

    import("lightweight-charts").then((L) => {
      console.log("lightweight-charts模块导入成功");
      if (!isMounted || !containerRef.current) {
        console.log("组件已卸载或容器不存在");
        return;
      }

      const { createChart, ColorType, CandlestickSeries } = L;

      console.log(
        "创建图表实例，容器尺寸:",
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth || 800,
        height: height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#64748b",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#e2e8f0", style: 0 },
          horzLines: { color: "#e2e8f0", style: 0 },
        },
        rightPriceScale: {
          borderColor: "#e2e8f0",
          // 为成交量预留底部空间
          scaleMargins: { top: 0.08, bottom: 0.3 },
        },
        timeScale: {
          borderColor: "#e2e8f0",
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          mode: 1, // Magnet mode - 吸附到数据点
          vertLine: {
            labelVisible: true,
          },
          horzLine: {
            labelVisible: true,
          },
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });
      console.log("图表创建成功");

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#16a34a",
        downColor: "#ef4444",
        wickUpColor: "#16a34a",
        wickDownColor: "#ef4444",
        borderVisible: false,
      });
      console.log("K线系列创建成功");

      chartRef.current = chart;
      seriesRef.current = series;

      // 创建tooltip元素
      if (!tooltipRef.current && containerRef.current) {
        const tooltip = document.createElement("div");
        tooltip.style.cssText = `
          position: absolute;
          display: none;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
          z-index: 1000;
          max-width: 300px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          line-height: 1.4;
        `;
        containerRef.current.appendChild(tooltip);
        tooltipRef.current = tooltip;
      }

      // 在底部添加quoteVolume柱状图
      try {
        // 添加成交量柱状图系列作为覆盖层
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: {
            type: "volume",
          },
          priceScaleId: "", // 设置为空字符串作为覆盖层
          color: "#26a69a",
        });

        // 配置成交量系列的位置
        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.7, // 最高点距离顶部70%
            bottom: 0, // 最低点在底部
          },
          borderVisible: false,
          visible: true, // 确保价格轴可见
        });

        (chart as any).__volumeSeries = volumeSeries;
        console.log("成交量柱状图创建成功");
      } catch (error) {
        console.error("创建成交量柱状图失败:", error);
      }

      // 监听左右滑动以动态加载
      const timeScale = chart.timeScale();
      const handleRange = () => {
        if (!onLoadMore) return;
        if (isLoadingMoreRef.current) return;
        // 防抖：避免过于频繁
        const now = Date.now();
        if (now - lastRangeCheckAtRef.current < loadCooldownMsRef.current)
          return;
        lastRangeCheckAtRef.current = now;

        const logical = timeScale.getVisibleLogicalRange() as any;
        if (
          !logical ||
          typeof logical.from !== "number" ||
          typeof logical.to !== "number"
        )
          return;

        const total = data.length || 0;
        if (total === 0) return;

        // 可见时间范围（秒）
        const visible = timeScale.getVisibleRange() as any;
        const fromSec =
          visible && typeof visible.from === "number"
            ? visible.from
            : undefined;
        const toSec =
          visible && typeof visible.to === "number" ? visible.to : undefined;

        const threshold = 20; // 接近边缘时触发
        // 左侧接近起点
        if (logical.from < threshold) {
          onLoadMore("left", fromSec ? fromSec * 1000 : undefined);
          return;
        }
        // 右侧接近末尾
        if (logical.to > total - threshold) {
          onLoadMore("right", toSec ? toSec * 1000 : undefined);
        }
      };

      timeScale.subscribeVisibleLogicalRangeChange(handleRange);

      // 监听鼠标移动，显示包含成交量的tooltip
      chart.subscribeCrosshairMove((param) => {
        const tooltip = tooltipRef.current;
        if (!tooltip) return;

        if (
          param.point === undefined ||
          !param.time ||
          param.point.x < 0 ||
          param.point.y < 0
        ) {
          tooltip.style.display = "none";
          return;
        }

        try {
          // 获取K线数据
          const candleData = param.seriesData.get(series) as any;

          // 根据时间找到原始K线数据中的成交量
          const currentTime =
            typeof param.time === "number"
              ? param.time
              : typeof param.time === "string"
              ? new Date(param.time).getTime() / 1000
              : param.time && typeof param.time === "object" && param.time.year
              ? new Date(
                  param.time.year,
                  param.time.month - 1,
                  param.time.day
                ).getTime() / 1000
              : 0;

          const currentKline = data.find((k) => {
            const klineTime = Math.floor(new Date(k.openTime).getTime() / 1000);
            return Math.abs(klineTime - currentTime) <= 30; // 允许30秒的误差
          });

          if (candleData && currentKline) {
            const formatTime = (timestamp: any) => {
              let date: Date;
              if (typeof timestamp === "number") {
                date = new Date(timestamp * 1000);
              } else if (typeof timestamp === "string") {
                date = new Date(timestamp);
              } else if (
                timestamp &&
                typeof timestamp === "object" &&
                timestamp.year
              ) {
                // BusinessDay type
                date = new Date(
                  timestamp.year,
                  timestamp.month - 1,
                  timestamp.day
                );
              } else {
                date = new Date();
              }
              return date.toLocaleString("zh-CN", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
            };

            const formatNumber = (num: number) => {
              if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
              if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
              if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
              return num.toFixed(2);
            };

            tooltip.innerHTML = `
              <div><strong>${formatTime(currentTime)}</strong></div>
              <div>开: ${candleData.open.toFixed(4)}</div>
              <div>高: ${candleData.high.toFixed(4)}</div>
              <div>低: ${candleData.low.toFixed(4)}</div>
              <div>收: ${candleData.close.toFixed(4)}</div>
              <div><strong>成交量: ${formatNumber(
                currentKline.quoteVolume
              )}</strong></div>
              <div>交易笔数: ${currentKline.trades}</div>
            `;

            tooltip.style.display = "block";

            // 智能定位tooltip，避免超出边界
            const containerRect = containerRef.current?.getBoundingClientRect();
            let left = param.point.x + 10;
            let top = param.point.y - 10;

            if (containerRect) {
              // 如果tooltip会超出右边界，显示在鼠标左侧
              if (left + 300 > containerRect.width) {
                left = param.point.x - 310;
              }
              // 如果tooltip会超出上边界，显示在鼠标下方
              if (top < 0) {
                top = param.point.y + 20;
              }
            }

            tooltip.style.left = Math.max(0, left) + "px";
            tooltip.style.top = Math.max(0, top) + "px";
          } else {
            tooltip.style.display = "none";
          }
        } catch (error) {
          console.warn("显示tooltip失败:", error);
          tooltip.style.display = "none";
        }
      });

      // 监听容器尺寸变化
      const ro = new ResizeObserver(() => {
        if (!chartRef.current || !containerRef.current) return;
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || height,
        });
      });
      ro.observe(containerRef.current);
      resizeObserverRef.current = ro;

      // 首次设置数据
      if (data.length) {
        try {
          const sorted = transformKlinesToCandles(data).sort(
            (a, b) => a.time - b.time
          );
          (series as any).setData(sorted);
          lastCandlesRef.current = sorted;

          // 初始化时同步设置quoteVolume
          try {
            const volSeries = (chart as any).__volumeSeries;
            if (volSeries) {
              const volData = data.map((k) => {
                const t = Math.floor(new Date(k.openTime).getTime() / 1000);
                const isUp = Number(k.close) >= Number(k.open);
                const volume = Number(k.quoteVolume) || 0;
                return {
                  time: t as any,
                  value: volume,
                  color: isUp ? "#22c55e80" : "#ef444480",
                };
              });
              volSeries.setData(volData);
              console.log("初始化成交量数据:", volData.length, "条");
            }
          } catch (error) {
            console.error("设置初始成交量数据失败:", error);
          }

          // 如果有开仓时间和平仓时间，聚焦到该时间段
          if (entryTime && exitTime) {
            focusOnTimeRange(chart, entryTime, exitTime, sorted);
          } else {
            chart.timeScale().fitContent();
          }

          // 添加开仓和平仓点标记（延迟执行，确保数据已经设置）
          if (openTrades && closeTrades) {
            setTimeout(() => {
              addOriginalTradeMarkers(
                series,
                openTrades,
                closeTrades,
                markersRef,
                positionSide
              );
            }, 100);
          } else if (entryTime && exitTime) {
            // 根据useTimeMarkersOnly决定使用哪种标记
            setTimeout(() => {
              if (useTimeMarkersOnly) {
                addTimeMarkers(
                  series,
                  entryTime,
                  exitTime,
                  markersRef,
                  positionSide
                );
              } else if (entryPrice && exitPrice) {
                // 如果没有原始交易数据，使用平均价格（向后兼容）
                addAverageTradeMarkers(
                  series,
                  entryTime,
                  exitTime,
                  entryPrice,
                  exitPrice,
                  markersRef,
                  totalQuantity,
                  totalFees,
                  realizedPnl,
                  positionSide
                );
              } else {
                // 只有时间信息时，添加时间标记
                addTimeMarkers(
                  series,
                  entryTime,
                  exitTime,
                  markersRef,
                  positionSide
                );
              }
            }, 100);
          }
        } catch {}
      }
    });

    return () => {
      isMounted = false;
      try {
        if (resizeObserverRef.current && containerRef.current) {
          resizeObserverRef.current.unobserve(containerRef.current);
        }
        resizeObserverRef.current?.disconnect();
      } catch {}
      try {
        // 清理tooltip
        if (tooltipRef.current && containerRef.current) {
          containerRef.current.removeChild(tooltipRef.current);
          tooltipRef.current = null;
        }
      } catch {}
      try {
        chartRef.current?.remove?.();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      entryLineRef.current = null;
      exitLineRef.current = null;
      markersRef.current = null;
    };
  }, [height]); // 添加height依赖，确保高度变化时重新初始化

  // 数据与标线更新
  useEffect(() => {
    console.log("数据更新useEffect触发 - 数据长度:", data.length);
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) {
      console.log("图表或系列未初始化");
      return;
    }

    try {
      const timeScale = chart.timeScale();
      const prevRange = timeScale.getVisibleLogicalRange() as any;

      const transformed = transformKlinesToCandles(data);
      const sorted = transformed.sort((a, b) => a.time - b.time);
      (series as any).setData(sorted);
      lastCandlesRef.current = sorted;

      // 更新quoteVolume
      try {
        const volSeries = (chart as any).__volumeSeries;
        if (volSeries) {
          const volData = data.map((k) => {
            const t = Math.floor(new Date(k.openTime).getTime() / 1000);
            const isUp = Number(k.close) >= Number(k.open);
            const volume = Number(k.quoteVolume) || 0;
            return {
              time: t as any,
              value: volume,
              color: isUp ? "#22c55e80" : "#ef444480",
            };
          });
          volSeries.setData(volData);
          console.log(
            "更新成交量数据:",
            volData.length,
            "条, 样本:",
            volData.slice(0, 3)
          );
        }
      } catch (error) {
        console.error("更新成交量数据失败:", error);
      }

      // 首次设置或数据源从空到有，自动适配可视区域
      if (!prevLenRef.current || prevLenRef.current === 0) {
        try {
          timeScale.fitContent();
          timeScale.scrollToRealTime();
        } catch {}
      }

      // 维护视图：当左侧扩展时，将窗口向右平移新增的条数；右侧扩展则保持在右侧
      const newLen = data.length;
      const added =
        addedCount || Math.max(0, newLen - (prevLenRef.current || 0));

      if (added > 0) {
        if (
          lastLoadDirection === "left" &&
          prevRange &&
          typeof prevRange.from === "number" &&
          typeof prevRange.to === "number"
        ) {
          timeScale.setVisibleLogicalRange({
            from: prevRange.from + added,
            to: prevRange.to + added,
          });
        } else if (lastLoadDirection === "right") {
          timeScale.scrollToPosition(0, true);
        }
      } else if (prevLenRef.current === 0 && entryTime && exitTime) {
        // 首次加载数据时，如果有开仓时间和平仓时间，聚焦到该时间段
        focusOnTimeRange(chart, entryTime, exitTime, sorted);
      }

      // 更新开仓和平仓点标记（延迟执行，确保数据已经设置）
      if (openTrades && closeTrades) {
        setTimeout(() => {
          addOriginalTradeMarkers(
            series,
            openTrades,
            closeTrades,
            markersRef,
            positionSide
          );
        }, 100);
      } else if (entryTime && exitTime) {
        // 根据useTimeMarkersOnly决定使用哪种标记
        setTimeout(() => {
          if (useTimeMarkersOnly) {
            addTimeMarkers(
              series,
              entryTime,
              exitTime,
              markersRef,
              positionSide
            );
          } else if (entryPrice && exitPrice) {
            // 如果没有原始交易数据，使用平均价格（向后兼容）
            addAverageTradeMarkers(
              series,
              entryTime,
              exitTime,
              entryPrice,
              exitPrice,
              markersRef,
              totalQuantity,
              totalFees,
              realizedPnl,
              positionSide
            );
          } else {
            // 只有时间信息时，添加时间标记
            addTimeMarkers(
              series,
              entryTime,
              exitTime,
              markersRef,
              positionSide
            );
          }
        }, 100);
      }

      prevLenRef.current = newLen;
    } catch {}

    // 更新价格线
    try {
      if (entryLineRef.current) {
        series.removePriceLine(entryLineRef.current);
        entryLineRef.current = null;
      }
      if (typeof entryPrice === "number" && isFinite(entryPrice)) {
        entryLineRef.current = series.createPriceLine({
          price: entryPrice,
          color: "#16a34a",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "开仓",
        });
      }

      if (exitLineRef.current) {
        series.removePriceLine(exitLineRef.current);
        exitLineRef.current = null;
      }
      if (typeof exitPrice === "number" && isFinite(exitPrice)) {
        exitLineRef.current = series.createPriceLine({
          price: exitPrice,
          color: "#ef4444",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "平仓",
        });
      }
    } catch {}
  }, [
    data,
    entryPrice,
    exitPrice,
    entryTime,
    exitTime,
    totalQuantity,
    totalFees,
    realizedPnl,
    openTrades,
    closeTrades,
    positionSide,
  ]);

  // 高度变化
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({ height });
  }, [height]);

  // 外部触发：聚焦到开/平仓时间段
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (entryTime && exitTime) {
      focusOnTimeRange(
        chart,
        entryTime,
        exitTime,
        lastCandlesRef.current || []
      );
    }
  }, [focusRangeSignal, entryTime, exitTime]);

  console.log("KlineChart渲染检查:", {
    dataLength: data.length,
    height,
    className,
    hasData: !!data.length,
    firstData: data[0],
  });

  if (!data.length) {
    console.log("数据为空，显示暂无数据提示");
    return (
      <div
        className={`flex items-center justify-center bg-muted/20 rounded ${className}`}
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">暂无K线数据</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* 时间框架选择器 */}
      {showTimeFrameSelector && onTimeFrameChange && (
        <div className="absolute top-2 left-2 z-10 flex gap-1">
          {TIME_FRAME_OPTIONS.map((o) => (
            <Button
              key={o.value}
              variant={timeFrame === o.value ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onTimeFrameChange(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      )}

      {/* Symbol选择器 */}
      {showSymbolSelector && onSymbolChange && (
        <div className="absolute top-10 left-2 z-10 flex gap-1">
          <span className="bg-background/90 rounded px-2 py-1 text-xs text-muted-foreground">
            Symbol:
          </span>
          {SYMBOL_OPTIONS.map((o) => (
            <Button
              key={o.value}
              variant={symbol === o.value ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onSymbolChange(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      )}

      {/* Market选择器 */}
      {showMarketSelector && onMarketChange && (
        <div className="absolute top-[4.5rem] left-2 z-10 flex gap-1">
          <span className="bg-background/90 rounded px-2 py-1 text-xs text-muted-foreground">
            Market:
          </span>
          {MARKET_OPTIONS.map((o) => (
            <Button
              key={o.value}
              variant={market === o.value ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onMarketChange(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      )}

      {showRangeSelector && onRangeApply && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 bg-background/90 rounded px-2 py-1 flex items-center gap-2 text-xs border shadow-sm">
          <span className="text-muted-foreground">时间段:</span>
          <input
            type="datetime-local"
            className="border rounded px-1 py-0.5 text-xs w-36"
            defaultValue={startTime ? toLocalInputValue(startTime) : undefined}
            onChange={(e) => (rangeDraftRef.current.start = e.target.value)}
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="datetime-local"
            className="border rounded px-1 py-0.5 text-xs w-36"
            defaultValue={endTime ? toLocalInputValue(endTime) : undefined}
            onChange={(e) => (rangeDraftRef.current.end = e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              const s =
                rangeDraftRef.current.start ||
                toLocalInputValue(startTime || new Date().toISOString());
              const e =
                rangeDraftRef.current.end ||
                toLocalInputValue(endTime || new Date().toISOString());
              const sISO = fromLocalInputValue(s);
              const eISO = fromLocalInputValue(e);
              if (sISO && eISO) onRangeApply(sISO, eISO);
            }}
          >
            应用
          </Button>
        </div>
      )}

      <div ref={containerRef} style={{ height, width: "100%" }} />

      <div className="absolute top-2 right-16 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        <div className="text-center">
          <div>
            {symbol} - {market === "futures" ? "期货" : "现货"}
          </div>
          <div>
            {data.length} 根K线 ({timeFrame})
          </div>
          {positionSide && (
            <div
              className={`mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                positionSide === "LONG"
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-red-100 text-red-800 border border-red-200"
              }`}
            >
              {positionSide === "LONG" ? "📈 多单" : "📉 空单"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function transformKlinesToCandles(data: KlineData[]) {
  return data.map((k) => {
    const t = new Date(k.openTime).getTime() / 1000;
    return {
      time: Math.floor(t),
      open: Number(k.open),
      high: Number(k.high),
      low: Number(k.low),
      close: Number(k.close),
    };
  });
}

// 聚焦到开仓和平仓时间段
function focusOnTimeRange(
  chart: IChartApi,
  entryTime: string,
  exitTime: string,
  candleData: any[]
) {
  try {
    const entryTimeSeconds = Math.floor(new Date(entryTime).getTime() / 1000);
    const exitTimeSeconds = Math.floor(new Date(exitTime).getTime() / 1000);

    if (candleData.length === 0) {
      chart.timeScale().fitContent();
      return;
    }

    // 找到开仓时间和平仓时间对应的数据点索引
    const firstTime = Number(candleData[0].time);
    const lastTime = Number(candleData[candleData.length - 1].time);

    // 如果开仓和平仓时间都在数据范围内
    if (entryTimeSeconds >= firstTime && exitTimeSeconds <= lastTime) {
      // 计算开仓和平仓时间之间的时间跨度
      const timeSpan = Math.max(1, exitTimeSeconds - entryTimeSeconds);

      // 动态估算K线粒度（秒）
      const estimateBarSeconds = () => {
        if (!candleData || candleData.length < 2) return 60; // 默认1分钟
        const sample = candleData.slice(0, Math.min(200, candleData.length));
        const diffs: number[] = [];
        for (let i = 1; i < sample.length; i++) {
          const d = Number(sample[i].time) - Number(sample[i - 1].time);
          if (d > 0 && Number.isFinite(d)) diffs.push(d);
        }
        diffs.sort((a, b) => a - b);
        const mid = Math.floor(diffs.length / 2);
        return diffs.length ? diffs[mid] : 60;
      };

      const barSec = estimateBarSeconds();
      // 目标：给出大约120根K线的可视 padding（1m≈2小时，15m≈30小时，1h≈5天）
      const desiredBars = 120;
      const minPadding = barSec * desiredBars;
      const halfSpan = Math.floor(timeSpan * 0.5);
      const maxPadding = 60 * 60 * 24 * 14; // 最多14天
      const padding = Math.min(Math.max(minPadding, halfSpan), maxPadding);

      const startTime = Math.max(entryTimeSeconds - padding, firstTime);
      const endTime = Math.min(exitTimeSeconds + padding, lastTime);

      chart.timeScale().setVisibleRange({
        from: startTime as any,
        to: endTime as any,
      });
    } else {
      // 如果时间不在范围内，使用默认的 fitContent
      chart.timeScale().fitContent();
    }
  } catch (error) {
    console.warn("聚焦时间范围失败:", error);
    chart.timeScale().fitContent();
  }
}

// 按订单ID合并交易记录
function mergeTradesByOrderId(
  trades: Array<{
    tradeId: string;
    price: number;
    quantity: number;
    timestamp: string;
    commission: number;
    side?: "BUY" | "SELL";
    orderId?: string;
  }>
) {
  const orderGroups = new Map<string, typeof trades>();

  // 按orderId分组
  trades.forEach((trade) => {
    const orderId = trade.orderId || trade.tradeId; // 如果没有orderId，使用tradeId
    if (!orderGroups.has(orderId)) {
      orderGroups.set(orderId, []);
    }
    orderGroups.get(orderId)!.push(trade);
  });

  // 合并每个订单的trades
  return Array.from(orderGroups.entries()).map(([orderId, orderTrades]) => {
    // 按时间排序
    const sortedTrades = orderTrades.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const totalQuantity = orderTrades.reduce((sum, t) => sum + t.quantity, 0);
    const totalCommission = orderTrades.reduce(
      (sum, t) => sum + t.commission,
      0
    );

    // 计算加权平均价格
    const weightedPriceSum = orderTrades.reduce(
      (sum, t) => sum + t.price * t.quantity,
      0
    );
    const avgPrice =
      totalQuantity > 0
        ? weightedPriceSum / totalQuantity
        : orderTrades[0].price;

    return {
      orderId,
      price: avgPrice,
      quantity: totalQuantity,
      commission: totalCommission,
      timestamp: sortedTrades[0].timestamp, // 使用最早的时间戳
      side: sortedTrades[0].side,
      tradeCount: orderTrades.length,
      trades: sortedTrades,
    };
  });
}

// 添加原始交易订单标记（使用v5 API）
function addOriginalTradeMarkers(
  series: any, // ISeriesApi
  openTrades: Array<{
    tradeId: string;
    price: number;
    quantity: number;
    timestamp: string;
    commission: number;
    side?: "BUY" | "SELL";
    orderId?: string;
  }>,
  closeTrades: Array<{
    tradeId: string;
    price: number;
    quantity: number;
    timestamp: string;
    commission: number;
    side?: "BUY" | "SELL";
    orderId?: string;
  }>,
  markersRef: React.MutableRefObject<any>,
  positionSide?: "LONG" | "SHORT"
) {
  try {
    // 获取当前数据
    const currentData = (series as any).data();
    if (!currentData || currentData.length === 0) {
      console.warn("没有K线数据，无法添加标记");
      return;
    }

    const markers: any[] = [];

    // 合并开仓交易
    const mergedOpenOrders = mergeTradesByOrderId(openTrades);
    mergedOpenOrders.forEach((order, index) => {
      const orderTimeSeconds = Math.floor(
        new Date(order.timestamp).getTime() / 1000
      );
      const candle = findClosestCandle([...currentData], orderTimeSeconds);

      if (candle) {
        const tradeCountText =
          order.tradeCount > 1 ? ` (${order.tradeCount}笔)` : "";
        const directionText = positionSide
          ? `${positionSide === "LONG" ? "多单" : "空单"} `
          : "";
        markers.push({
          time: candle.time,
          position: "belowBar",
          color: "#16a34a",
          shape: "arrowUp",
          text: `${directionText}开仓${
            index + 1
          }${tradeCountText} ${order.price.toFixed(
            4
          )} | 数量: ${order.quantity.toFixed(
            4
          )} | 手续费: ${order.commission.toFixed(4)}`,
        });
      }
    });

    // 合并平仓交易
    const mergedCloseOrders = mergeTradesByOrderId(closeTrades);
    mergedCloseOrders.forEach((order, index) => {
      const orderTimeSeconds = Math.floor(
        new Date(order.timestamp).getTime() / 1000
      );
      const candle = findClosestCandle([...currentData], orderTimeSeconds);

      if (candle) {
        const tradeCountText =
          order.tradeCount > 1 ? ` (${order.tradeCount}笔)` : "";
        const directionText = positionSide
          ? `${positionSide === "LONG" ? "多单" : "空单"} `
          : "";
        markers.push({
          time: candle.time,
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: `${directionText}平仓${
            index + 1
          }${tradeCountText} ${order.price.toFixed(
            4
          )} | 数量: ${order.quantity.toFixed(
            4
          )} | 手续费: ${order.commission.toFixed(4)}`,
        });
      }
    });

    console.log("Setting merged order markers:", markers); // 调试日志
    console.log("Merged open orders:", mergedOpenOrders);
    console.log("Merged close orders:", mergedCloseOrders);

    // 使用v5的新API
    if (markersRef.current) {
      markersRef.current.setMarkers(markers);
    } else {
      markersRef.current = createSeriesMarkers(series, markers);
    }
  } catch (error) {
    console.error("添加原始交易标记失败:", error);
  }
}

// 添加平均价格标记（向后兼容，使用v5 API）
function addAverageTradeMarkers(
  series: any, // ISeriesApi
  entryTime: string,
  exitTime: string,
  entryPrice: number,
  exitPrice: number,
  markersRef: React.MutableRefObject<any>,
  totalQuantity?: number,
  totalFees?: number,
  realizedPnl?: number,
  positionSide?: "LONG" | "SHORT"
) {
  try {
    const entryTimeSeconds = Math.floor(new Date(entryTime).getTime() / 1000);
    const exitTimeSeconds = Math.floor(new Date(exitTime).getTime() / 1000);

    // 获取当前数据，找到最接近开仓和平仓时间的K线
    const currentData = (series as any).data();
    if (!currentData || currentData.length === 0) {
      console.warn("没有K线数据，无法添加标记");
      return;
    }

    const markers: any[] = [];

    // 找到最接近开仓时间的K线
    const entryCandle = findClosestCandle([...currentData], entryTimeSeconds);
    if (entryCandle) {
      const directionText = positionSide
        ? `${positionSide === "LONG" ? "多单" : "空单"} `
        : "";
      markers.push({
        time: entryCandle.time,
        position: "belowBar",
        color: "#16a34a",
        shape: "arrowUp",
        text: `${directionText}开仓 ${entryPrice.toFixed(4)}${
          totalQuantity ? ` | 数量: ${totalQuantity.toFixed(4)}` : ""
        }`,
      });
    }

    // 找到最接近平仓时间的K线
    const exitCandle = findClosestCandle([...currentData], exitTimeSeconds);
    if (exitCandle) {
      const pnlColor = realizedPnl && realizedPnl >= 0 ? "#16a34a" : "#ef4444";
      const pnlText =
        realizedPnl !== undefined
          ? ` | 盈亏: ${realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(4)}`
          : "";
      const feesText =
        totalFees !== undefined ? ` | 手续费: ${totalFees.toFixed(4)}` : "";

      const directionText = positionSide
        ? `${positionSide === "LONG" ? "多单" : "空单"} `
        : "";
      markers.push({
        time: exitCandle.time,
        position: "aboveBar",
        color: pnlColor,
        shape: "arrowDown",
        text: `${directionText}平仓 ${exitPrice.toFixed(
          4
        )}${pnlText}${feesText}`,
      });
    }

    console.log("Setting average trade markers:", markers); // 调试日志

    // 使用v5的新API
    if (markersRef.current) {
      markersRef.current.setMarkers(markers);
    } else {
      markersRef.current = createSeriesMarkers(series, markers);
    }
  } catch (error) {
    console.error("添加平均交易标记失败:", error);
  }
}

// 添加时间标记（仅时间，不显示价格）
function addTimeMarkers(
  series: any, // ISeriesApi
  entryTime: string,
  exitTime: string,
  markersRef: React.MutableRefObject<any>,
  positionSide?: "LONG" | "SHORT"
) {
  try {
    const entryTimeSeconds = Math.floor(new Date(entryTime).getTime() / 1000);
    const exitTimeSeconds = Math.floor(new Date(exitTime).getTime() / 1000);

    // 获取当前数据，找到最接近开仓和平仓时间的K线
    const currentData = (series as any).data();
    if (!currentData || currentData.length === 0) {
      console.warn("没有K线数据，无法添加时间标记");
      return;
    }

    const markers: any[] = [];

    // 找到最接近开仓时间的K线
    const entryCandle = findClosestCandle([...currentData], entryTimeSeconds);
    if (entryCandle) {
      const directionText = positionSide
        ? `${positionSide === "LONG" ? "多单" : "空单"} `
        : "";
      markers.push({
        time: entryCandle.time,
        position: "belowBar",
        color: "#2563eb",
        shape: "arrowUp",
        text: `${directionText}开单时间: ${new Date(
          entryTime
        ).toLocaleString()}`,
      });
    }

    // 找到最接近平仓时间的K线
    const exitCandle = findClosestCandle([...currentData], exitTimeSeconds);
    if (exitCandle) {
      const directionText = positionSide
        ? `${positionSide === "LONG" ? "多单" : "空单"} `
        : "";
      markers.push({
        time: exitCandle.time,
        position: "aboveBar",
        color: "#dc2626",
        shape: "arrowDown",
        text: `${directionText}关单时间: ${new Date(
          exitTime
        ).toLocaleString()}`,
      });
    }

    console.log("Setting time markers:", markers); // 调试日志

    // 使用v5的新API
    if (markersRef.current) {
      markersRef.current.setMarkers(markers);
    } else {
      markersRef.current = createSeriesMarkers(series, markers);
    }
  } catch (error) {
    console.error("添加时间标记失败:", error);
  }
}

// 找到最接近指定时间的K线数据点
function findClosestCandle(candleData: any[], targetTimeSeconds: number) {
  if (!candleData || candleData.length === 0) return null;

  // 找到最接近的时间点
  let closest = candleData[0];
  let minDiff = Math.abs(Number(candleData[0].time) - targetTimeSeconds);

  for (const candle of candleData) {
    const diff = Math.abs(Number(candle.time) - targetTimeSeconds);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candle;
    }
  }

  return closest;
}

// 本地 datetime-local 与 ISO 互转
function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalInputValue(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
