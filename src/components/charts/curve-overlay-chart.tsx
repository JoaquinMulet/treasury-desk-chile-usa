"use client";

import { LWCChart } from "./lwc-chart";

export function CurveOverlayChart({
  data,
}: {
  data: { time: string; us10y: number; us30y: number }[];
}) {
  return (
    <LWCChart
      height={320}
      lines={[
        {
          data: data.map((d) => ({ time: d.time, value: d.us30y })),
          color: "#ef4444",
          title: "30Y",
          lineWidth: 2,
        },
        {
          data: data.map((d) => ({ time: d.time, value: d.us10y })),
          color: "#3b82f6",
          title: "10Y",
          lineWidth: 2,
        },
      ]}
      priceFormat={{ minMove: 0.001, precision: 3 }}
    />
  );
}
