import { lastValueClient } from "@/lib/data/bcch-client";
import { US_SNAPSHOT, US_CHANGES } from "@/lib/data/market";
import { fmtYield, fmtPrice, fmtBps, fmtPct } from "@/lib/format";

/**
 * Ticker bar arriba del header — estilo Bloomberg.
 * Muestra métricas clave en una línea horizontal con scroll.
 */
export function TickerBar() {
  const uf10 = lastValueClient("uf_10y");
  const clp10 = lastValueClient("clp_10y");
  const bei10 = lastValueClient("bei_10y");
  const tpm = lastValueClient("tpm");
  const usdclp = lastValueClient("usdclp");
  const uf = lastValueClient("uf");

  const items: { label: string; value: string; delta?: number; deltaUnit?: "bps" | "%" }[] = [
    { label: "UST 10Y", value: fmtYield(US_SNAPSHOT.yields.us_10y, 3), delta: US_CHANGES.us_10y.day, deltaUnit: "bps" },
    { label: "UST 30Y", value: fmtYield(US_SNAPSHOT.yields.us_30y, 3), delta: US_CHANGES.us_30y.day, deltaUnit: "bps" },
    { label: "TLT", value: fmtPrice(US_SNAPSHOT.etfs.tlt, 2), delta: US_CHANGES.tlt.day, deltaUnit: "%" },
    { label: "EDV", value: fmtPrice(US_SNAPSHOT.etfs.edv, 2), delta: US_CHANGES.edv.day, deltaUnit: "%" },
    { label: "MOVE", value: fmtPrice(US_SNAPSHOT.vol.move, 1), delta: US_CHANGES.move.day, deltaUnit: "%" },
    { label: "DXY", value: fmtPrice(US_SNAPSHOT.fx.dxy, 2), delta: US_CHANGES.dxy.day, deltaUnit: "%" },
    { label: "UF 10Y", value: fmtYield(uf10?.value, 3) },
    { label: "CLP 10Y", value: fmtYield(clp10?.value, 3) },
    { label: "BEI 10Y", value: fmtYield(bei10?.value, 2) },
    { label: "TPM", value: fmtYield(tpm?.value, 2) },
    { label: "USD/CLP", value: fmtPrice(usdclp?.value, 2) },
    { label: "UF", value: fmtPrice(uf?.value, 2) },
  ];

  return (
    <div className="flex items-center gap-0 overflow-x-auto border-b border-border bg-background py-1.5 px-3 text-[11px]">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2 border-r border-border px-3 last:border-r-0 whitespace-nowrap">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</span>
          <span className="num font-medium text-foreground">{item.value}</span>
          {item.delta != null && (
            <span
              className={
                item.delta > 0
                  ? "num text-[10px] text-[var(--color-pos)]"
                  : item.delta < 0
                  ? "num text-[10px] text-[var(--color-neg)]"
                  : "num text-[10px] text-muted-foreground"
              }
            >
              {item.deltaUnit === "bps" ? fmtBps(item.delta) : fmtPct(item.delta, 2, true)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
