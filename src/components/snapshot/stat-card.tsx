import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  unit,
  date,
  delta,
  deltaUnit = "bps",
  percentile,
  hint,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  date?: string | null;
  delta?: number;
  deltaUnit?: "bps" | "%";
  percentile?: number;
  hint?: string;
}) {
  const formatted =
    value == null
      ? "—"
      : typeof value === "number"
      ? value.toLocaleString("es-CL", { maximumFractionDigits: 4 })
      : value;

  const deltaSign = delta != null && delta !== 0 ? (delta > 0 ? "+" : "") : "";
  const deltaColor =
    delta == null
      ? "text-muted-foreground"
      : delta > 0
      ? "text-red-500"
      : delta < 0
      ? "text-emerald-500"
      : "text-muted-foreground";

  return (
    <Card className="gap-1 py-3">
      <CardHeader className="px-4 pb-1">
        <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          {percentile != null && (
            <Badge variant="outline" className="text-[10px]">
              p{percentile.toFixed(0)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{formatted}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{date ?? ""}</span>
          {delta != null && (
            <span className={cn("tabular-nums", deltaColor)}>
              {deltaSign}
              {delta.toFixed(deltaUnit === "%" ? 2 : 1)} {deltaUnit}
            </span>
          )}
        </div>
        {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
