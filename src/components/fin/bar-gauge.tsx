import { cn } from "@/lib/utils";

/**
 * Barra horizontal de progreso/percentil. Wall Street style: muy delgada, sin gradientes.
 */
export function BarGauge({
  value,
  max,
  min = 0,
  color = "var(--color-info)",
  height = 6,
  className,
  showLabel,
}: {
  value: number;
  max: number;
  min?: number;
  color?: string;
  height?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const range = max - min;
  const pct = range === 0 ? 0 : Math.max(0, Math.min(100, ((value - min) / range) * 100));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="relative flex-1 overflow-hidden bg-muted"
        style={{ height }}
        role="progressbar"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="num text-[10px] tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
      )}
    </div>
  );
}

/**
 * Indicador de percentil con marcas p5/p25/p50/p75/p95. Útil para spreads y yields.
 */
export function PercentileGauge({
  value,
  p5, p25, p50, p75, p95,
  height = 18,
  className,
}: {
  value: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  height?: number;
  className?: string;
}) {
  const min = p5;
  const max = p95;
  const range = max - min;
  if (range === 0) return null;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100));
  const valuePos = pos(value);

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      {/* p5-p95 spans full width */}
      <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-border" />
      {/* p25-p75 box */}
      <div
        className="absolute inset-y-1/2 -translate-y-1/2 bg-muted-foreground/20"
        style={{ left: `${pos(p25)}%`, width: `${pos(p75) - pos(p25)}%`, height: 8 }}
      />
      {/* p50 median tick */}
      <div
        className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-muted-foreground"
        style={{ left: `${pos(p50)}%` }}
      />
      {/* current value */}
      <div
        className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-info)]"
        style={{ left: `${valuePos}%` }}
      />
    </div>
  );
}
