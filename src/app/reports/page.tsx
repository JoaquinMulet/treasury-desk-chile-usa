"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Printer } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { lastValueClient as lastValue } from "@/lib/data/bcch-client";
import { US_SNAPSHOT } from "@/lib/data/market";
import { toast } from "sonner";
import { PageHeader, Panel, KV } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { CLP, Num, Yld, Price } from "@/components/fin/num";

type Holding = { id: string; name: string; assetClass: string; currency: string; quantity: number; unitPrice: number; duration: number; yieldPct: number };

const FX: Record<string, number> = { CLP: 1, UF: 40763, USD: 906.68 };

export default function ReportsPage() {
  const [holdings] = useLocalStorage<Holding[]>("portfolio.holdings", []);
  const [busy, setBusy] = useState(false);

  const totalCLP = holdings.reduce((s, h) => s + h.quantity * h.unitPrice * (FX[h.currency] ?? 1), 0);
  const wDur = totalCLP > 0 ? holdings.reduce((s, h) => s + (h.quantity * h.unitPrice * (FX[h.currency] ?? 1) * h.duration), 0) / totalCLP : 0;
  const wYield = totalCLP > 0 ? holdings.reduce((s, h) => s + (h.quantity * h.unitPrice * (FX[h.currency] ?? 1) * h.yieldPct), 0) / totalCLP : 0;

  const today = new Date().toLocaleDateString("es-CL");
  const uf30 = lastValue("uf_30y"), uf10 = lastValue("uf_10y");
  const clp10 = lastValue("clp_10y"), bei10 = lastValue("bei_10y");
  const tpm = lastValue("tpm"), usdclp = lastValue("usdclp");

  function downloadHTML() {
    setBusy(true);
    try {
      const html = generateReportHTML({
        date: today, holdings, totalCLP, wDur, wYield,
        market: {
          uf30: uf30?.value, uf10: uf10?.value, clp10: clp10?.value, bei10: bei10?.value,
          tpm: tpm?.value, usdclp: usdclp?.value,
          us10: US_SNAPSHOT.yields.us_10y, us30: US_SNAPSHOT.yields.us_30y,
          tlt: US_SNAPSHOT.etfs.tlt, edv: US_SNAPSHOT.etfs.edv, move: US_SNAPSHOT.vol.move,
        },
      });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `treasury-desk-report-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Reporte descargado");
    } finally { setBusy(false); }
  }

  function downloadCSV() {
    if (holdings.length === 0) { toast.error("Sin posiciones"); return; }
    const headers = ["name", "assetClass", "currency", "quantity", "unitPrice", "duration", "yieldPct", "valueCLP"];
    const rows = holdings.map((h) => [h.name, h.assetClass, h.currency, h.quantity, h.unitPrice, h.duration, h.yieldPct, Math.round(h.quantity * h.unitPrice * (FX[h.currency] ?? 1))].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `treasury-holdings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reportes · Exportación"
        description="HTML imprimible · CSV holdings · snapshot print"
      />

      <Commentary title="Reportes ejecutivos · accountability del proceso de tesorería">
        <P>
          Los reportes formales cumplen tres funciones: (1) <Term>accountability</Term> hacia gerencia y directorio
          sobre desempeño y decisiones tomadas; (2) <Term>archivo histórico</Term> para auditoría y compliance —
          la mayoría de marcos regulatorios exigen evidencia de proceso documentado; (3) <Term>disciplina interna</Term>
          al forzar revisión periódica estructurada en lugar de monitoreo reactivo. La frecuencia mensual es el
          estándar de la industria para reportes ejecutivos; semanal para operacional; trimestral para directorio.
        </P>
        <P>
          La estructura clásica incluye: resumen ejecutivo (1 página), composición y valorización de cartera,
          atribución de retorno (factor decomposition), métricas de riesgo (duración, FX, VaR), cumplimiento de
          política, y benchmark vs target. La exportación CSV de holdings es la base para reconciliación contable
          y para que terceros (auditor, contador, asesor externo) puedan procesar la data en sus propios sistemas.
        </P>
      </Commentary>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ActionCard
          icon={FileText}
          color="var(--color-info)"
          title="Reporte ejecutivo HTML"
          desc="Posiciones + market snapshot, imprimible"
          actionLabel="Descargar HTML"
          onClick={downloadHTML}
          disabled={busy}
        />
        <ActionCard
          icon={Download}
          color="var(--color-pos)"
          title="Holdings CSV"
          desc="Cartera actual para Excel"
          actionLabel="Exportar CSV"
          onClick={downloadCSV}
        />
        <ActionCard
          icon={Printer}
          color="var(--color-warn)"
          title="Imprimir snapshot"
          desc="Snapshot del día vía navegador"
          actionLabel="Imprimir"
          onClick={() => window.print()}
        />
      </div>

      <Commentary title="Componentes del reporte ejecutivo" variant="compact">
        <P>
          El reporte ejecutivo se estructura en tres bloques canónicos. <Term>Resumen de cartera</Term> agrega las
          métricas first-order (valor mark-to-market, duración ponderada, yield ponderado) que responden a la pregunta
          ¿cuánto vale y cuánto riesgo de tasas tiene mi tesorería? <Term>Market snapshot</Term> contextualiza
          esos valores contra los niveles vigentes de las curvas relevantes — sin este contexto los números absolutos
          no son interpretables. <Term>Detalle de posiciones</Term> permite atribución posición-por-posición para
          identificar concentraciones y excepciones de política.
        </P>
        <P>
          La <Term>atribución de retorno</Term> formal (Brinson-Hood-Beebower 1986) descompone el retorno total en
          allocation effect (¿cuánto contribuyó la decisión de pesos por clase?) y selection effect (¿cuánto
          contribuyó la selección dentro de cada clase?). Para tesorería corporativa donde la mayoría de instrumentos
          son soberanos o bancarios AA+, el selection effect es bajo y la decisión clave es la allocation entre
          duración corta/media/larga y entre monedas.
        </P>
        <P>
          Métricas complementarias del reporte ejecutivo: <Term>tracking error</Term> (volatilidad anualizada del
          retorno excedente versus benchmark elegido), <Term>information ratio</Term> (alpha sobre tracking error,
          mide skill del gestor activo), <Term>DV01</Term> de cartera (pérdida en CLP por +1 bp paralelo en la
          curva — útil para sizing de hedges), y <Term>VaR / Expected Shortfall</Term> al 95% y 99% (medidas de
          cola para reportar a directorio). El reporte debe contextualizar todos los números contra targets de
          política definidos previamente.
        </P>
      </Commentary>

      <Panel title={`Preview reporte ejecutivo · ${today}`}>
        <section className="border-b border-border pb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Resumen cartera</h3>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Valorización</div>
              <div className="num mt-1 text-xl font-semibold"><CLP value={totalCLP} /> CLP</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Duración pond.</div>
              <div className="num mt-1 text-xl font-semibold"><Num value={wDur} /> años</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Yield pond.</div>
              <div className="num mt-1 text-xl font-semibold"><Yld value={wYield} /></div>
            </div>
          </div>
        </section>

        <section className="border-b border-border py-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Market snapshot</h3>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0 md:grid-cols-3">
            <KV label="UST 10Y"><Yld value={US_SNAPSHOT.yields.us_10y} /></KV>
            <KV label="UST 30Y"><Yld value={US_SNAPSHOT.yields.us_30y} /></KV>
            <KV label="TLT"><Price value={US_SNAPSHOT.etfs.tlt} /></KV>
            <KV label="UF 10Y"><Yld value={uf10?.value} /></KV>
            <KV label="UF 30Y"><Yld value={uf30?.value} /></KV>
            <KV label="EDV"><Price value={US_SNAPSHOT.etfs.edv} /></KV>
            <KV label="CLP 10Y"><Yld value={clp10?.value} /></KV>
            <KV label="BEI 10Y"><Yld value={bei10?.value} /></KV>
            <KV label="MOVE"><Price value={US_SNAPSHOT.vol.move} /></KV>
            <KV label="TPM"><Yld value={tpm?.value} /></KV>
            <KV label="USD/CLP"><Price value={usdclp?.value} /></KV>
            <KV label="Fed Funds"><Yld value={4.375} /></KV>
          </div>
        </section>

        {holdings.length > 0 && (
          <section className="pt-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Posiciones</h3>
            <div className="mt-2">
              <FinTable>
                <FinThead>
                  <FinTr>
                    <FinTh>Posición</FinTh>
                    <FinTh>Clase</FinTh>
                    <FinTh>Curr</FinTh>
                    <FinTh align="right">Cant</FinTh>
                    <FinTh align="right">Precio</FinTh>
                    <FinTh align="right">Valor CLP</FinTh>
                    <FinTh align="right">Dur</FinTh>
                    <FinTh align="right">YTM</FinTh>
                  </FinTr>
                </FinThead>
                <FinTbody>
                  {holdings.map((h) => (
                    <FinTr key={h.id}>
                      <FinTd className="font-medium">{h.name}</FinTd>
                      <FinTd><span className="pill border-border text-muted-foreground">{h.assetClass}</span></FinTd>
                      <FinTd>{h.currency}</FinTd>
                      <FinTd align="right" numeric>{h.quantity}</FinTd>
                      <FinTd align="right" numeric>{h.unitPrice.toFixed(2)}</FinTd>
                      <FinTd align="right"><CLP value={h.quantity * h.unitPrice * (FX[h.currency] ?? 1)} /></FinTd>
                      <FinTd align="right" numeric>{h.duration.toFixed(1)}</FinTd>
                      <FinTd align="right"><Yld value={h.yieldPct} /></FinTd>
                    </FinTr>
                  ))}
                </FinTbody>
              </FinTable>
            </div>
          </section>
        )}
      </Panel>
    </div>
  );
}

function ActionCard({ icon: Icon, color, title, desc, actionLabel, onClick, disabled }: { icon: typeof FileText; color: string; title: string; desc: string; actionLabel: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="cursor-pointer border border-border bg-card p-4 transition-colors hover:bg-muted/40" onClick={onClick}>
      <Icon className="h-7 w-7" style={{ color }} strokeWidth={1.5} />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">{desc}</p>
      <Button size="sm" variant="outline" className="mt-3" disabled={disabled}>{actionLabel}</Button>
    </div>
  );
}

function generateReportHTML(d: { date: string; holdings: Holding[]; totalCLP: number; wDur: number; wYield: number; market: Record<string, number | undefined> }): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Treasury Desk · Reporte ${d.date}</title>
<style>
body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 920px; margin: 30px auto; padding: 20px; color: #111; }
h1 { font-size: 22px; margin: 0 0 4px; font-weight: 600; letter-spacing: -0.3px; }
h2 { font-size: 11px; margin: 26px 0 8px; padding-bottom: 6px; border-bottom: 1px solid #d1d9e0; text-transform: uppercase; letter-spacing: 0.08em; color: #57606a; font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 5px 8px; text-align: left; border-bottom: 1px solid #e5e7ea; }
th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #57606a; font-weight: 600; }
.tabular { font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", monospace; }
.right { text-align: right; }
.stat { display: inline-block; margin-right: 30px; }
.stat-label { font-size: 10px; color: #57606a; text-transform: uppercase; letter-spacing: 0.08em; }
.stat-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
</style></head><body>
<h1>Treasury Desk — Reporte ejecutivo</h1>
<p style="color:#57606a;font-size:12px;margin:0;">Generado el ${d.date}</p>

<h2>Cartera consolidada</h2>
<div class="stat"><div class="stat-label">Valorización</div><div class="stat-value">${Math.round(d.totalCLP).toLocaleString("es-CL")} CLP</div></div>
<div class="stat"><div class="stat-label">Duración pond.</div><div class="stat-value">${d.wDur.toFixed(2)} años</div></div>
<div class="stat"><div class="stat-label">Yield pond.</div><div class="stat-value">${d.wYield.toFixed(2)}%</div></div>
<div class="stat"><div class="stat-label">Posiciones</div><div class="stat-value">${d.holdings.length}</div></div>

<h2>Market snapshot</h2>
<table>
<tr><th>Métrica</th><th class="right">Valor</th><th>Métrica</th><th class="right">Valor</th></tr>
<tr><td>USA 10Y</td><td class="right tabular">${d.market.us10?.toFixed(2) ?? "—"}%</td><td>UF 10Y</td><td class="right tabular">${d.market.uf10?.toFixed(2) ?? "—"}%</td></tr>
<tr><td>USA 30Y</td><td class="right tabular">${d.market.us30?.toFixed(2) ?? "—"}%</td><td>UF 30Y</td><td class="right tabular">${d.market.uf30?.toFixed(2) ?? "—"}%</td></tr>
<tr><td>TLT</td><td class="right tabular">${d.market.tlt?.toFixed(2) ?? "—"}</td><td>CLP 10Y</td><td class="right tabular">${d.market.clp10?.toFixed(2) ?? "—"}%</td></tr>
<tr><td>EDV</td><td class="right tabular">${d.market.edv?.toFixed(2) ?? "—"}</td><td>BEI 10Y</td><td class="right tabular">${d.market.bei10?.toFixed(2) ?? "—"}%</td></tr>
<tr><td>MOVE</td><td class="right tabular">${d.market.move?.toFixed(2) ?? "—"}</td><td>TPM</td><td class="right tabular">${d.market.tpm?.toFixed(2) ?? "—"}%</td></tr>
<tr><td></td><td></td><td>USD/CLP</td><td class="right tabular">${d.market.usdclp?.toFixed(2) ?? "—"}</td></tr>
</table>

${d.holdings.length > 0 ? `
<h2>Detalle posiciones</h2>
<table>
<tr><th>Nombre</th><th>Clase</th><th>Curr</th><th class="right">Cant</th><th class="right">Precio</th><th class="right">Valor CLP</th><th class="right">Dur</th><th class="right">YTM</th></tr>
${d.holdings.map((h) => `<tr><td>${h.name}</td><td>${h.assetClass}</td><td>${h.currency}</td><td class="right tabular">${h.quantity}</td><td class="right tabular">${h.unitPrice.toFixed(2)}</td><td class="right tabular">${Math.round(h.quantity * h.unitPrice * (FX[h.currency] ?? 1)).toLocaleString("es-CL")}</td><td class="right tabular">${h.duration.toFixed(1)}</td><td class="right tabular">${h.yieldPct.toFixed(2)}%</td></tr>`).join("")}
</table>
` : ""}

<p style="margin-top:40px;font-size:10px;color:#57606a;">Generado por Bonds Treasury Desk · Datos: BCCh BDE + Yahoo Finance + cálculos propios</p>
</body></html>`;
}
