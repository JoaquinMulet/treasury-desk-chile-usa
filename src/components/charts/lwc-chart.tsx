"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  AreaSeries,
  LineSeries,
} from "lightweight-charts";
import { useTheme } from "next-themes";

export type LineDef = {
  data: { time: string; value: number }[];
  color: string;
  title?: string;
  lineWidth?: number;
  type?: "line" | "area";
};

export function LWCChart({
  lines,
  height = 320,
  priceFormat,
}: {
  lines: LineDef[];
  height?: number;
  priceFormat?: { minMove?: number; precision?: number };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line" | "Area">[]>([]);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    const dark = resolvedTheme === "dark";
    const chart = createChart(containerRef.current, {
      height,
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: dark ? "#8b949e" : "#57606a",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: dark ? "rgba(48,54,61,0.4)" : "rgba(209,217,224,0.4)" },
        horzLines: { color: dark ? "rgba(48,54,61,0.4)" : "rgba(209,217,224,0.4)" },
      },
      rightPriceScale: {
        borderColor: dark ? "#21262d" : "#d1d9e0",
      },
      timeScale: {
        borderColor: dark ? "#21262d" : "#d1d9e0",
        timeVisible: false,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: dark ? "#4493f8" : "#0969da",
          width: 1,
          style: 3,
          labelBackgroundColor: dark ? "#4493f8" : "#0969da",
        },
        horzLine: {
          color: dark ? "#4493f8" : "#0969da",
          width: 1,
          style: 3,
          labelBackgroundColor: dark ? "#4493f8" : "#0969da",
        },
      },
    });

    chartRef.current = chart;

    seriesRef.current = lines.map((l) => {
      const opts = {
        color: l.color,
        lineWidth: (l.lineWidth ?? 1.5) as 1 | 2 | 3 | 4,
        title: l.title,
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: priceFormat
          ? {
              type: "price" as const,
              minMove: priceFormat.minMove ?? 0.01,
              precision: priceFormat.precision ?? 2,
            }
          : undefined,
      };
      const s =
        l.type === "area"
          ? chart.addSeries(AreaSeries, {
              ...opts,
              topColor: l.color + "33",
              bottomColor: l.color + "00",
              lineColor: l.color,
            })
          : chart.addSeries(LineSeries, opts);
      s.setData(
        l.data.map((p) => ({ time: p.time as Time, value: p.value })),
      );
      return s;
    });

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
  }, [lines, height, resolvedTheme, priceFormat]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
