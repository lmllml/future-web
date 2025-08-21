"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { KlineData } from "@/lib/types";

export type TimeFrame = "1m" | "15m" | "1h" | "1d";

interface KlineChartProps {
  data: KlineData[];
  height?: number;
  entryPrice?: number;
  exitPrice?: number;
  className?: string;
  timeFrame?: TimeFrame;
  onTimeFrameChange?: (timeFrame: TimeFrame) => void;
  showTimeFrameSelector?: boolean;
  onLoadMore?: (direction: "left" | "right", boundaryTimeMs?: number) => void;
  isLoadingMore?: boolean;
  lastLoadDirection?: "left" | "right" | null;
  addedCount?: number;
  // 新增：时间段选择（仅负责发出事件，不直接请求）
  startTime?: string; // ISO
  endTime?: string; // ISO
  onRangeApply?: (startTimeISO: string, endTimeISO: string) => void;
  showRangeSelector?: boolean;
}

const TIME_FRAME_OPTIONS: { label: string; value: TimeFrame }[] = [
  { label: "1分", value: "1m" },
  { label: "15分", value: "15m" },
  { label: "1小时", value: "1h" },
  { label: "1天", value: "1d" },
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
  onLoadMore,
  isLoadingMore = false,
  lastLoadDirection = null,
  addedCount = 0,
  startTime,
  endTime,
  onRangeApply,
  showRangeSelector = false,
}: KlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const entryLineRef = useRef<any>(null);
  const exitLineRef = useRef<any>(null);
  const lastRangeCheckAtRef = useRef<number>(0);
  const loadCooldownMsRef = useRef<number>(500);
  const isLoadingMoreRef = useRef<boolean>(false);
  const prevLenRef = useRef<number>(0);
  const rangeDraftRef = useRef<{ start?: string; end?: string }>({});

  // 跟踪外部加载状态，避免滑动时重复触发
  useEffect(() => {
    isLoadingMoreRef.current = !!isLoadingMore;
  }, [isLoadingMore]);

  // 初始化图表（仅一次）
  useEffect(() => {
    if (chartRef.current || !containerRef.current) return;

    let isMounted = true;

    import("lightweight-charts").then((L) => {
      if (!isMounted || !containerRef.current) return;

      const { createChart, ColorType, CandlestickSeries } = L;

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
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: "#e2e8f0",
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: { mode: 1 },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#16a34a",
        downColor: "#ef4444",
        wickUpColor: "#16a34a",
        wickDownColor: "#ef4444",
        borderVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = series;

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
          series.setData(sorted);
          chart.timeScale().fitContent();
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
        chartRef.current?.remove?.();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      entryLineRef.current = null;
      exitLineRef.current = null;
    };
  }, []);

  // 数据与标线更新
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    try {
      const timeScale = chart.timeScale();
      const prevRange = timeScale.getVisibleLogicalRange() as any;

      const sorted = transformKlinesToCandles(data).sort(
        (a, b) => a.time - b.time
      );
      series.setData(sorted);
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
  }, [data, entryPrice, exitPrice]);

  // 高度变化
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({ height });
  }, [height]);

  if (!data.length) {
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

      {showRangeSelector && onRangeApply && (
        <div className="absolute top-10 left-2 z-10 bg-background/90 rounded px-2 py-1 flex items-center gap-2 text-xs border shadow-sm">
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

      <div ref={containerRef} style={{ height }} />

      <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        {data.length} 根K线 ({timeFrame})
      </div>
    </div>
  );
}

function transformKlinesToCandles(data: KlineData[]) {
  return data.map((k) => {
    const t = new Date(k.openTime).getTime() / 1000;
    return {
      time: Math.floor(t) as any,
      open: Number(k.open),
      high: Number(k.high),
      low: Number(k.low),
      close: Number(k.close),
    };
  });
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
