import { cn } from "@/lib/utils";
import { signClass } from "@/lib/format";
import { Sparkline } from "./sparkline";

/**
 * Tile compacto Bloomberg-style: label uppercase muy chico, valor grande monospace,
 * delta y subtítulo opcional. Sin gradientes, sin shadows pesadas.
 */
export function MetricTile({
  label,
  value,
  unit,
  delta,
  deltaUnit = "bps",
  subtitle,
  spark,
  sparkColor,
  pill,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: number;
  deltaUnit?: "bps" | "%" | "abs";
  subtitle?: string;
  spark?: number[];
  sparkColor?: string;
  pill?: { label: string; tone?: "pos" | "neg" | "warn" | "info" | "neutral" };
  className?: string;
}) {
  const deltaColor = delta == null ? "" : signClass(delta);
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border border-border bg-card p-3 transition-colors hover:bg-muted/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {pill && (
          <span
            className={cn("pill", {
              "border-[var(--color-pos)] text-[var(--color-pos)]": pill.tone === "pos",
              "border-[var(--color-neg)] text-[var(--color-neg)]": pill.tone === "neg",
              "border-[var(--color-warn)] text-[var(--color-warn)]": pill.tone === "warn",
              "border-[var(--color-info)] text-[var(--color-info)]": pill.tone === "info",
            })}
          >
            {pill.label}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="num text-xl font-semibold tracking-tight text-foreground">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{subtitle}</span>
        {delta != null && (
          <span className={cn("num", deltaColor)}>
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
            {Math.abs(delta).toFixed(deltaUnit === "abs" ? 2 : 1)} {deltaUnit !== "abs" ? deltaUnit : ""}
          </span>
        )}
      </div>

      {spark && spark.length > 1 && (
        <div className="mt-1">
          <Sparkline values={spark} color={sparkColor} height={28} />
        </div>
      )}
    </div>
  );
}
