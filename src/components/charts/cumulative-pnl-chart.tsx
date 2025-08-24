"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, LineSeries, HistogramSeries } from "lightweight-charts";

interface CumulativePnlData {
  date: string; // YYYY-MM-DD
  cumulativePnl: number;
  dailyPnl: number;
  tradeCount: number;
}

interface Props {
  data: CumulativePnlData[];
  height?: number;
  className?: string;
}

const CHART_BACKGROUND_COLOR = "#ffffff";
const CHART_TEXT_COLOR = "#333333";
const CHART_GRID_COLOR = "#f0f0f0";

export function CumulativePnlChart({
  data,
  height = 400,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    // 创建图表
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: CHART_BACKGROUND_COLOR },
        textColor: CHART_TEXT_COLOR,
      },
      grid: {
        vertLines: { color: CHART_GRID_COLOR },
        horzLines: { color: CHART_GRID_COLOR },
      },
      rightPriceScale: {
        visible: true,
        borderColor: CHART_GRID_COLOR,
      },
      timeScale: {
        visible: true,
        borderColor: CHART_GRID_COLOR,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
      height,
    });

    chartRef.current = chart;

    // 创建累计盈亏线系列
    const cumulativeSeries = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      title: "累计盈亏",
    });

    // 创建每日盈亏柱状图系列
    const dailySeries = chart.addSeries(HistogramSeries, {
      color: "#64748b",
      title: "每日盈亏",
      priceFormat: {
        type: "price",
        precision: 4,
        minMove: 0.0001,
      },
    });

    // 转换数据格式
    const cumulativeData = data.map((item) => ({
      time: item.date,
      value: item.cumulativePnl,
    }));

    const dailyData = data.map((item) => ({
      time: item.date,
      value: item.dailyPnl,
      color: item.dailyPnl >= 0 ? "#22c55e80" : "#ef444480",
    }));

    // 设置数据
    cumulativeSeries.setData(cumulativeData);
    dailySeries.setData(dailyData);

    // 自适应内容
    chart.timeScale().fitContent();

    // 添加零线
    if (
      cumulativeData.some((item) => item.value < 0) &&
      cumulativeData.some((item) => item.value > 0)
    ) {
      cumulativeSeries.createPriceLine({
        price: 0,
        color: "#94a3b8",
        lineWidth: 1,
        lineStyle: 3, // dotted
        axisLabelVisible: true,
        title: "盈亏平衡线",
      });
    }

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  if (!data.length) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/20 rounded ${className}`}
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">暂无数据</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} style={{ height }} />
      {/* 图表说明 */}
      <div className="absolute top-2 right-2 bg-background/90 rounded px-2 py-1 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-blue-600"></div>
          <span>累计盈亏</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-2 bg-gray-500/50"></div>
          <span>每日盈亏</span>
        </div>
      </div>
    </div>
  );
}
