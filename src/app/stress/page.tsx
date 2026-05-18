"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { Signed, CLP } from "@/components/fin/num";
import { Heatmap } from "@/components/charts/heatmap";

type Scenario = { id: string; label: string; d10y_us: number; d10y_cl: number; dInflCl: number; dFxUsdClp: number; dEquity: number };

const PRESETS: Scenario[] = [
  { id: "tlt_rally", label: "Fed pivot dovish (−100 bps largo)", d10y_us: -100, d10y_cl: -70, dInflCl: 0, dFxUsdClp: 2, dEquity: 5 },
  { id: "tlt_deep_rally", label: "Recesión USA (−200 bps largo)", d10y_us: -200, d10y_cl: -120, dInflCl: -1, dFxUsdClp: 5, dEquity: -15 },
  { id: "stagflation", label: "Estanflación (+200 bps + recesión)", d10y_us: 200, d10y_cl: 150, dInflCl: 3, dFxUsdClp: 8, dEquity: -25 },
  { id: "tariff_shock", label: "Tariff shock abr-2025", d10y_us: 60, d10y_cl: 30, dInflCl: 0.5, dFxUsdClp: 4, dEquity: -10 },
  { id: "fed_hike", label: "Fed sorpresa +50 bps", d10y_us: 80, d10y_cl: 40, dInflCl: 0, dFxUsdClp: 3, dEquity: -8 },
  { id: "bank_crisis", label: "Crisis bancaria USA (2008 lite)", d10y_us: -150, d10y_cl: -80, dInflCl: -0.5, dFxUsdClp: 8, dEquity: -30 },
  { id: "clp_devalue", label: "Devaluación CLP +15%", d10y_us: 0, d10y_cl: 50, dInflCl: 1.5, dFxUsdClp: 15, dEquity: -5 },
  { id: "clp_strengthen", label: "Apreciación CLP −10%", d10y_us: 0, d10y_cl: -30, dInflCl: -0.5, dFxUsdClp: -10, dEquity: 5 },
  { id: "iran_oil", label: "Shock petróleo Irán", d10y_us: 40, d10y_cl: 50, dInflCl: 2, dFxUsdClp: 3, dEquity: -10 },
];

type Holding = { id: string; name: string; clase: "TLT" | "EDV" | "BTU_long" | "DPF_CLP" | "DPF_USD" | "Equity_CL" | "Equity_US"; valueCLP: number };

const SENSITIVITY: Record<Holding["clase"], { dy_us: number; dy_cl: number; fx: number; equity: number }> = {
  TLT:       { dy_us: -17, dy_cl: 0,   fx: 1.0, equity: 0 },
  EDV:       { dy_us: -24, dy_cl: 0,   fx: 1.0, equity: 0 },
  BTU_long:  { dy_us: 0,   dy_cl: -14, fx: 0,   equity: 0 },
  DPF_CLP:   { dy_us: 0,   dy_cl: 0,   fx: 0,   equity: 0 },
  DPF_USD:   { dy_us: 0,   dy_cl: 0,   fx: 1.0, equity: 0 },
  Equity_CL: { dy_us: 0,   dy_cl: 0,   fx: 0,   equity: 1.0 },
  Equity_US: { dy_us: 0,   dy_cl: 0,   fx: 1.0, equity: 1.0 },
};

function impactPct(s: Scenario, c: Holding["clase"]): number {
  const sen = SENSITIVITY[c];
  return sen.dy_us * (s.d10y_us / 10000) + sen.dy_cl * (s.d10y_cl / 10000) + sen.fx * (s.dFxUsdClp / 100) + sen.equity * (s.dEquity / 100);
}

export default function StressPage() {
  const [holdings] = useLocalStorage<Array<Record<string, unknown>>>("portfolio.holdings", []);
  const [custom, setCustom] = useState<Scenario>({ id: "custom", label: "Custom", d10y_us: 0, d10y_cl: 0, dInflCl: 0, dFxUsdClp: 0, dEquity: 0 });

  const adaptedHoldings: Holding[] = useMemo(() => {
    return holdings.map((h, i) => {
      const name = (h.name as string) || `pos${i}`;
      const valueCLP = ((h.quantity as number) || 0) * ((h.unitPrice as number) || 0) * ({ CLP: 1, UF: 40763, USD: 906.68 } as Record<string, number>)[(h.currency as string) || "CLP"];
      let clase: Holding["clase"] = "DPF_CLP";
      if (h.assetClass === "ETF" && (name.includes("EDV") || name.includes("ZROZ"))) clase = "EDV";
      else if (h.assetClass === "ETF") clase = "TLT";
      else if (h.assetClass === "BTU") clase = "BTU_long";
      else if (h.assetClass === "BOND_USA") clase = "TLT";
      else if (h.assetClass === "DPF" && h.currency === "USD") clase = "DPF_USD";
      else if (h.assetClass === "DPF") clase = "DPF_CLP";
      else if (h.assetClass === "EQUITY" && h.currency === "USD") clase = "Equity_US";
      else if (h.assetClass === "EQUITY") clase = "Equity_CL";
      return { id: (h.id as string) || String(i), name, clase, valueCLP };
    });
  }, [holdings]);

  const totalCLP = adaptedHoldings.reduce((s, h) => s + h.valueCLP, 0);

  function scenarioResult(s: Scenario) {
    let delta = 0;
    const detail = adaptedHoldings.map((h) => {
      const pct = impactPct(s, h.clase);
      const dCLP = h.valueCLP * pct;
      delta += dCLP;
      return { name: h.name, valueCLP: h.valueCLP, pct, dCLP };
    });
    return { totalDelta: delta, totalPct: totalCLP > 0 ? delta / totalCLP : 0, detail };
  }

  const allScenarios: Scenario[] = [...PRESETS, custom];

  // Heatmap: sensitivity por clase × escenario
  const claseList: Holding["clase"][] = ["TLT", "EDV", "BTU_long", "DPF_USD", "DPF_CLP", "Equity_US", "Equity_CL"];
  const heatCells = PRESETS.map((s) => claseList.map((c) => impactPct(s, c) * 100));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stress testing"
        description="Escenarios pre-configurados y custom sobre cartera actual"
      />

      <Commentary title="Stress testing · evaluación bajo escenarios extremos">
        <P>
          El <Term>stress testing</Term> evalúa el portafolio bajo escenarios macroeconómicos adversos predefinidos.
          Complementa al VaR — que asume distribuciones normales — capturando <Term>fat tails</Term> y correlaciones
          que sólo aparecen bajo stress (la correlación crisis vs normal puede diferir en 0.5 unidades). Basel III
          lo exige a la banca como capa complementaria al VaR.
        </P>
        <P>
          Cada escenario combina shocks simultáneos sobre las variables principales: yields USA largos, yields
          chilenos, inflación, tipo de cambio y equity. La sensibilidad por clase se calcula con
          <Term> first-order Greeks</Term>: duración para tasas, beta para equity, exposición FX. Es una
          aproximación lineal — para shocks superiores a 200 bps subestima el efecto de convexidad. La práctica
          recomendada es ejecutar escenarios de magnitud igual o mayor a dos veces la peor pérdida histórica, para
          revelar exposiciones asimétricas (Taleb 2007 sobre robust portfolio construction).
        </P>
      </Commentary>

      <Panel title="Mapa de sensibilidad · % impacto por escenario × clase">
        <Heatmap
          rows={PRESETS.map((s) => s.label)}
          cols={claseList}
          cells={heatCells}
          format="signedPct"
          decimals={1}
        />
      </Panel>

      <Commentary title="Lectura del heatmap de sensibilidad" variant="compact">
        <P>
          El heatmap superior muestra el <Term>% de impacto</Term> en cada clase de activo bajo cada escenario.
          Rojo = pérdida; verde = ganancia; saturación = magnitud. Lecturas claves: TLT y EDV reaccionan
          espejadamente a los escenarios de tasa (verde en escenarios dovish, rojo en hawkish), mientras que
          equity y FX siguen patrones distintos. Las celdas más extremas (saturación máxima) son las exposiciones
          más concentradas que conviene hedgear o reducir antes que el escenario se materialice.
        </P>
      </Commentary>

      <Panel title="Impacto sobre cartera por escenario">
        {adaptedHoldings.length === 0 && (
          <div className="mb-3 border-l-2 border-[var(--color-warn)] bg-[var(--color-warn-bg)] px-3 py-2 text-xs text-muted-foreground">
            Sin posiciones cargadas — agrega holdings en <strong className="text-foreground">Cartera</strong> para impactos absolutos.
          </div>
        )}
        <FinTable>
          <FinThead>
            <FinTr>
              <FinTh>Escenario</FinTh>
              <FinTh align="right">Δ 10Y USA</FinTh>
              <FinTh align="right">Δ 10Y CL</FinTh>
              <FinTh align="right">Δ FX</FinTh>
              <FinTh align="right">Δ Equity</FinTh>
              <FinTh align="right">Δ CLP</FinTh>
              <FinTh align="right">% cartera</FinTh>
            </FinTr>
          </FinThead>
          <FinTbody>
            {allScenarios.map((s) => {
              const r = scenarioResult(s);
              return (
                <FinTr key={s.id}>
                  <FinTd className="font-medium">{s.label}</FinTd>
                  <FinTd align="right" numeric className="text-[10px]">{s.d10y_us > 0 ? "+" : ""}{s.d10y_us} bps</FinTd>
                  <FinTd align="right" numeric className="text-[10px]">{s.d10y_cl > 0 ? "+" : ""}{s.d10y_cl} bps</FinTd>
                  <FinTd align="right" numeric className="text-[10px]">{s.dFxUsdClp > 0 ? "+" : ""}{s.dFxUsdClp}%</FinTd>
                  <FinTd align="right" numeric className="text-[10px]">{s.dEquity > 0 ? "+" : ""}{s.dEquity}%</FinTd>
                  <FinTd align="right"><CLP value={r.totalDelta} colored /></FinTd>
                  <FinTd align="right">
                    <span className={
                      "pill " +
                      (r.totalPct > 0.01 ? "border-[var(--color-pos)] text-[var(--color-pos)]" :
                       r.totalPct < -0.05 ? "border-[var(--color-neg)] text-[var(--color-neg)]" :
                       "border-border text-muted-foreground")
                    }>
                      {r.totalPct > 0 ? "+" : ""}{(r.totalPct * 100).toFixed(2)}%
                    </span>
                  </FinTd>
                </FinTr>
              );
            })}
          </FinTbody>
        </FinTable>
      </Panel>

      <Commentary title="Tipologías de shock de curva · más allá del parallel shift">
        <P>
          El shock más común — <Term>parallel shift</Term> — asume que todos los plazos de la curva se mueven en la
          misma magnitud. Es una aproximación útil para horizontes cortos y carteras de duración intermedia, pero
          captura solo el factor &quot;nivel&quot; (~75% de la varianza de cambios de curva según PCA). Los otros dos
          factores importantes son <Term>steepener</Term> (curva se empina, 30Y sube más que 2Y) y <Term>flattener</Term>
          (curva se aplana, posiblemente invirtiéndose). Estos cambios de pendiente afectan asimétricamente a
          carteras con duración concentrada en distintos plazos.
        </P>
        <P>
          Conceptos complementarios al stress testing tradicional: <Term>basis risk</Term> (riesgo de que el
          instrumento de hedge no se mueva exactamente como el subyacente — ETF USA vs Treasury cash, FM CL vs
          BTU específico); <Term>tail events</Term> (escenarios con probabilidad &lt;5% pero impacto desproporcionado —
          Lehman 2008, COVID 2020, Tariff shock abr-2025); <Term>Expected Shortfall (ES o CVaR)</Term> que calcula
          la pérdida esperada condicional a estar en la cola — métrica más robusta que VaR para colas gordas. La
          práctica de stress testing multifactor — shockear simultáneamente tasas, FX y equity con correlaciones de
          crisis — captura mejor el riesgo real que análisis univariado.
        </P>
      </Commentary>

      <Commentary title="Distribución empírica de drawdowns · evidencia histórica de 1900–2012">
        <P>
          Stress testing simula shocks hipotéticos; la <Term>distribución empírica de drawdowns</Term> reporta lo
          que efectivamente ocurrió. Faber (2013, Appendix B) descompone los retornos del S&amp;P 500 por década
          desde 1900 y reporta el drawdown peak-to-trough máximo de cada una: 1900s −34%, 1910s −28%, 1920s −33%,
          1930s −80%, 1940s −28%, 1950s −15%, 1960s −22%, 1970s −43%, 1980s −30%, 1990s −15%, 2000s −51%. El
          drawdown promedio histórico es −34%, no los −20% que sugiere la intuición de bull market.
        </P>
        <P>
          La aplicación de la regla del 10-month SMA al mismo S&amp;P 500 reduce sistemáticamente los drawdowns:
          la peor década (1930s) cae de −80% a −31%; los 2000s, de −51% a −6.82%; el caso aislado más extremo
          — el crash 1929–1932 — pasa de −84% a −42% (Figura 7). El portafolio GTAA equiponderado completo
          (5 clases con timing) registra drawdown máximo de −9.54% sobre 1973–2012, contra −46% del mismo
          portafolio buy-and-hold. La <Term>distribución anual de retornos</Term> del sistema también se trunca
          en la cola izquierda: en 110 años de S&amp;P 500, el sistema con SMA no registra ningún año peor que
          −20%; el buy-and-hold registra ocho. El alpha del trend-following es asimétrico — concentra su valor
          en evitar los peores años, no en magnificar los mejores.
        </P>
        <P>
          La lección operativa para stress testing es directa: shockear yields y equity simultáneamente no agota
          el ejercicio. Sin modelar la <Term>respuesta endógena del portafolio</Term> al shock — si la política
          prevé reducción de exposición tras una pérdida de N%, el drawdown efectivo es menor que el paramétrico —
          stress testing puramente lineal sobre-estima pérdidas reales para carteras con reglas explícitas de
          stop-loss o de-risking.
        </P>
      </Commentary>

      <Panel title="Escenario custom · sliders manuales">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <FieldInput label="Δ 10Y USA (bps)" value={custom.d10y_us} onChange={(v) => setCustom({ ...custom, d10y_us: v })} />
          <FieldInput label="Δ 10Y Chile (bps)" value={custom.d10y_cl} onChange={(v) => setCustom({ ...custom, d10y_cl: v })} />
          <FieldInput label="Δ Inflación CL (pp)" value={custom.dInflCl} onChange={(v) => setCustom({ ...custom, dInflCl: v })} />
          <FieldInput label="Δ USD/CLP (%)" value={custom.dFxUsdClp} onChange={(v) => setCustom({ ...custom, dFxUsdClp: v })} />
          <FieldInput label="Δ Equity (%)" value={custom.dEquity} onChange={(v) => setCustom({ ...custom, dEquity: v })} />
        </div>
        <div className="mt-3 flex gap-1.5">
          {[
            { label: "+100bps", patch: { d10y_us: 100, d10y_cl: 70 } },
            { label: "−100bps", patch: { d10y_us: -100, d10y_cl: -70 } },
            { label: "+200bps", patch: { d10y_us: 200, d10y_cl: 150 } },
            { label: "Reset", patch: { d10y_us: 0, d10y_cl: 0, dInflCl: 0, dFxUsdClp: 0, dEquity: 0 } },
          ].map((p) => (
            <Button key={p.label} size="sm" variant="outline" onClick={() => setCustom({ ...custom, ...p.patch })}>{p.label}</Button>
          ))}
        </div>
      </Panel>

      {adaptedHoldings.length > 0 && (
        <Panel title="Detalle escenario custom · por posición">
          <FinTable>
            <FinThead>
              <FinTr>
                <FinTh>Posición</FinTh>
                <FinTh align="right">Valor CLP</FinTh>
                <FinTh align="right">% Impacto</FinTh>
                <FinTh align="right">Δ CLP</FinTh>
              </FinTr>
            </FinThead>
            <FinTbody>
              {scenarioResult(custom).detail.map((d, i) => (
                <FinTr key={i}>
                  <FinTd>{d.name}</FinTd>
                  <FinTd align="right"><CLP value={d.valueCLP} /></FinTd>
                  <FinTd align="right"><Signed value={d.pct * 100} colored decimals={2} /></FinTd>
                  <FinTd align="right"><CLP value={d.dCLP} colored /></FinTd>
                </FinTr>
              ))}
            </FinTbody>
          </FinTable>
        </Panel>
      )}
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input className="mt-1 font-mono" type="number" step="any" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
}
