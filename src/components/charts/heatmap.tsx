import { cn } from "@/lib/utils";

/**
 * Heatmap server-safe (sin "use client"). No acepta funciones como props.
 * Configurable vía `format` enum y `valueDomain` opcional para coloring.
 */
type FormatKind = "signed" | "signedPct" | "pct" | "fixed" | "raw";

function formatCell(v: number, kind: FormatKind, decimals = 2): string {
  const abs = Math.abs(v).toFixed(decimals);
  switch (kind) {
    case "signed":     return v < 0 ? `−${abs}` : v > 0 ? `+${abs}` : abs;
    case "signedPct":  return (v < 0 ? `−${abs}` : v > 0 ? `+${abs}` : abs) + "%";
    case "pct":        return abs + "%";
    case "fixed":      return abs;
    case "raw":        return v.toString();
  }
}

function defaultColor(v: number, min: number, max: number): string {
  if (v < 0) {
    const intensity = Math.min(1, Math.abs(v) / Math.max(1, Math.abs(min)));
    const alpha = intensity * 0.55 + 0.08;
    return `rgba(248,81,73,${alpha})`;
  }
  if (v > 0) {
    const intensity = max > 0 ? v / max : 0;
    const alpha = intensity * 0.55 + 0.08;
    return `rgba(63,185,80,${alpha})`;
  }
  return "transparent";
}

export function Heatmap({
  rows,
  cols,
  cells,
  className,
  format = "fixed",
  decimals = 2,
  formatValue,
}: {
  rows: string[];
  cols: string[];
  cells: (number | null)[][];
  className?: string;
  format?: FormatKind;
  decimals?: number;
  formatValue?: (v: number) => string;
}) {
  const allValues = cells.flat().filter((v): v is number => v != null);
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 0;

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border-b border-border bg-card px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground"></th>
            {cols.map((c) => (
              <th key={c} className="border-b border-border bg-card px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <td className="border-b border-border/60 px-2 py-1.5 text-left text-[11px] font-medium text-foreground">
                {r}
              </td>
              {cols.map((c, ci) => {
                const v = cells[ri][ci];
                if (v == null) return <td key={ci} className="border-b border-border/60 px-2 py-1.5 text-center text-muted-foreground">—</td>;
                const display = formatValue ? formatValue(v) : formatCell(v, format, decimals);
                return (
                  <td
                    key={ci}
                    className="num border-b border-border/60 px-2 py-1.5 text-center font-mono tabular-nums"
                    style={{ background: defaultColor(v, min, max) }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
