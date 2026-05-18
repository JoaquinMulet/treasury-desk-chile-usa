"use client";

import { cn } from "@/lib/utils";

/**
 * Curve snapshot: muestra la curva (yield por tenor) en un instante.
 * Render SVG nativo para máximo control estético.
 */
export function CurveSnapshot({
  points,
  comparePoints,
  height = 160,
  className,
  colorMain = "#4493f8",
  colorCompare = "#8b949e",
  labelMain = "Actual",
  labelCompare = "Comparativa",
}: {
  points: { tenor: string; tenorYears: number; yield: number }[];
  comparePoints?: { tenor: string; tenorYears: number; yield: number }[];
  height?: number;
  className?: string;
  colorMain?: string;
  colorCompare?: string;
  labelMain?: string;
  labelCompare?: string;
}) {
  if (points.length < 2) return null;
  const allPoints = [...points, ...(comparePoints ?? [])];
  const yMin = Math.min(...allPoints.map((p) => p.yield));
  const yMax = Math.max(...allPoints.map((p) => p.yield));
  const xMin = Math.min(...allPoints.map((p) => p.tenorYears));
  const xMax = Math.max(...allPoints.map((p) => p.tenorYears));
  const yRange = yMax - yMin || 1;
  const xRange = xMax - xMin || 1;

  const W = 600;
  const H = height;
  const padL = 40, padR = 12, padT = 12, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  function x(t: number) { return padL + ((t - xMin) / xRange) * innerW; }
  function y(v: number) { return padT + (1 - (v - yMin) / yRange) * innerH; }

  const mainPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.tenorYears)},${y(p.yield)}`).join(" ");
  const comparePath = comparePoints
    ? comparePoints.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.tenorYears)},${y(p.yield)}`).join(" ")
    : null;

  // Y-axis ticks (4 levels)
  const yTicks = [yMin, yMin + yRange / 3, yMin + (2 * yRange) / 3, yMax];

  return (
    <div className={cn("w-full", className)}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="text-muted-foreground">
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={padL} y1={y(tick)} x2={W - padR} y2={y(tick)} stroke="currentColor" strokeWidth={0.5} opacity={0.2} />
            <text x={padL - 4} y={y(tick) + 3} textAnchor="end" fontSize={9} fill="currentColor" fontFamily="var(--font-geist-mono)">
              {tick.toFixed(2)}
            </text>
          </g>
        ))}
        {/* Compare path (dashed) */}
        {comparePath && (
          <path d={comparePath} fill="none" stroke={colorCompare} strokeWidth={1.2} strokeDasharray="3 3" />
        )}
        {/* Main path */}
        <path d={mainPath} fill="none" stroke={colorMain} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        {/* Main points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.tenorYears)} cy={y(p.yield)} r={3} fill={colorMain} />
            <text
              x={x(p.tenorYears)}
              y={H - 8}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              fontFamily="var(--font-geist-mono)"
            >
              {p.tenor}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3" style={{ background: colorMain }} />
          {labelMain}
        </span>
        {comparePoints && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3" style={{ background: colorCompare, opacity: 0.6 }} />
            {labelCompare}
          </span>
        )}
      </div>
    </div>
  );
}
