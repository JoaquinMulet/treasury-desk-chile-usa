import { PageHeader, Panel } from "@/components/fin/section";
import { LWCChart } from "@/components/charts/lwc-chart";
import { PercentileGauge } from "@/components/fin/bar-gauge";
import { Heatmap } from "@/components/charts/heatmap";
import { loadSeries, BCChKey } from "@/lib/data/bcch";
import { computeSpread, spreadStats } from "@/lib/calc/spread";
import { US_HISTORY, US_HISTORY_LABELS } from "@/lib/data/market";
import { TimePoint } from "@/lib/data/types";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { fmtSigned } from "@/lib/format";

export const dynamic = "force-dynamic";

function usToTimePoints(key: keyof typeof US_HISTORY): TimePoint[] {
  return US_HISTORY[key].map((value, i) => ({ time: US_HISTORY_LABELS[i], value }));
}

function spreadCurve(a: BCChKey | "us_10y", b: BCChKey | "us_10y"): TimePoint[] {
  const sa = a === "us_10y" ? usToTimePoints("us_10y") : loadSeries(a);
  const sb = b === "us_10y" ? usToTimePoints("us_10y") : loadSeries(b);
  return computeSpread(sa, sb);
}

export default function SpreadsPage() {
  const items = [
    { key: "uf_2s10s", label: "Chile UF 2s10s", note: "Slope curva real", data: spreadCurve("uf_10y", "uf_2y") },
    { key: "uf_5s30s", label: "Chile UF 5s30s", note: "Slope larga", data: spreadCurve("uf_30y", "uf_5y") },
    { key: "clp_2s10s", label: "Chile CLP 2s10s", note: "Slope nominal", data: spreadCurve("clp_10y", "clp_2y") },
    { key: "bei_2s10s", label: "Chile BEI 2s10s", note: "Slope inflación esperada", data: spreadCurve("bei_10y", "bei_2y") },
    { key: "cl_us_10y", label: "Chile CLP 10Y − USA 10Y", note: "Sovereign spread", data: spreadCurve("clp_10y", "us_10y") },
  ].map((it) => ({ ...it, stats: spreadStats(it.data) }));

  // Heatmap: cambio 1d en cada spread × bucket de plazo
  // Construyo matriz simple: filas = spreads, columnas = (1d, 1w, 1m, last)
  const heatRows = items.map((it) => it.label);
  const heatCols = ["Último", "Mediana", "p25", "p75", "Z-score"];
  const heatCells = items.map((it) => {
    const { last, median, p25, p75, sd, mean } = it.stats;
    const z = sd === 0 ? 0 : (last - mean) / sd;
    return [last, median, p25, p75, z];
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Spreads y arbitraje"
        description="Diferenciales relativos · percentil histórico · z-score · bandas de distribución"
      />

      <Commentary title="Por qué importan los spreads">
        <P>
          Un <Term>spread</Term> es la diferencia entre dos yields que aísla un riesgo o expectativa al cancelar el
          componente común. El <Term>2s10s</Term> (10Y − 2Y) aísla la pendiente removiendo el nivel — refleja
          expectativas de tasas futuras versus tasa overnight. El spread <Term>Chile − USA 10Y</Term> aísla el
          premio soberano local (riesgo país más expectativa de devaluación) removiendo el ciclo global. El
          <Term> BEI 2s10s</Term> mide cómo cambian las expectativas de inflación entre corto y largo plazo.
        </P>
        <P>
          El <Term>relative-value trading</Term> opera sobre una observación: los spreads suelen ser mean-reverting,
          oscilando alrededor de una media histórica con bandas estables. Cuando un spread cruza un percentil
          extremo (p5 o p95) en histórico de 5 años, hay base estadística para esperar reversión. El gauge bajo
          cada card visualiza esta posición: caja interna en el rango interquartil (p25–p75) y línea central en
          la mediana.
        </P>
      </Commentary>

      {/* Heatmap principal */}
      <Panel title="Vista comparativa · spreads activos">
        <Heatmap
          rows={heatRows}
          cols={heatCols}
          cells={heatCells}
          format="signed"
          decimals={2}
        />
      </Panel>

      {/* Cards de spread con percentil gauge */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((it) => (
          <div key={it.key} className="border border-border bg-card p-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{it.label}</div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{it.note}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="num text-xl font-semibold tracking-tight">
                {it.stats.last > 0 ? "+" : ""}{it.stats.last.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground">pp</span>
              <span className={
                "pill ml-auto " +
                (it.stats.percentile < 25 ? "border-[var(--color-info)] text-[var(--color-info)]" :
                  it.stats.percentile > 75 ? "border-[var(--color-warn)] text-[var(--color-warn)]" :
                  "border-border text-muted-foreground")
              }>p{it.stats.percentile.toFixed(0)}</span>
            </div>
            <PercentileGauge
              value={it.stats.last}
              p5={it.stats.p5} p25={it.stats.p25} p50={it.stats.median} p75={it.stats.p75} p95={it.stats.p95}
              className="mt-3"
            />
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <div>p5</div><div className="num text-right">{fmtSigned(it.stats.p5, 2)}</div>
              <div>Mediana</div><div className="num text-right">{fmtSigned(it.stats.median, 2)}</div>
              <div>p95</div><div className="num text-right">{fmtSigned(it.stats.p95, 2)}</div>
              <div>σ</div><div className="num text-right">{it.stats.sd.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      <Commentary title="Lectura del heatmap y las cards">
        <P>
          El heatmap superior compara los cinco spreads activos contra estadísticos clave (último valor, mediana,
          cuartiles, z-score). El color sigue una convención financiera: rojo si el valor está debajo del promedio
          histórico, verde si está encima. La saturación es proporcional a la distancia al cero.
        </P>
        <P>
          Cada card combina cuatro elementos: el valor actual, el percentil histórico (un pill p10 indica que
          actualmente el spread está más bajo que el 90% del histórico — comprimido y candidato a wider), un
          <Term> percentile gauge</Term> con caja interquartil y posición actual marcada, y los estadísticos
          descriptivos. La desviación estándar (σ) sirve para convertir el spread actual en z-score: <span
          className="num">(actual − media) / σ</span>; valores |z|&gt;2 son estadísticamente extremos.
        </P>
      </Commentary>

      {/* Series temporales detalladas */}
      <Commentary title="Z-score, percentile y mean reversion estadística">
        <P>
          La conversión del spread observado a <Term>z-score</Term> normaliza por la varianza histórica: <span
          className="num">z = (spread − μ) / σ</span>. Bajo hipótesis de normalidad, |z|&gt;2 indica el 5% más
          extremo de la distribución; |z|&gt;3 marca <Term>tail events</Term>. El <Term>percentile</Term> rank es
          la versión no-paramétrica equivalente: p95 significa que el spread actual está más alto que el 95% de
          observaciones históricas — robusto a outliers, no asume distribución normal.
        </P>
        <P>
          La hipótesis de <Term>mean reversion</Term> (test de Dickey-Fuller, Engle-Granger 1987) postula que
          spreads estacionarios revierten a su media de largo plazo con velocidad medible. Para spreads de
          duración como 2s10s, la half-life típica es 3-9 meses. Esto define el horizonte natural de un trade
          relativo: posicionar cuando el spread cruza p5 o p95, esperar reversión a la mediana en ese horizonte.
          Los trades de <Term>information ratio</Term> más alto en mesas de bonos son precisamente trades
          relative-value sobre spreads históricamente extremos.
        </P>
      </Commentary>

      <Commentary title="Series temporales de cada spread">
        <P>
          Las series temporales muestran la trayectoria de cada spread con la línea de la media histórica
          superpuesta. La banda visual entre la serie y el eje cero ayuda a identificar regímenes: períodos
          prolongados en territorio negativo (slope invertida, prima país comprimida) suelen preceder cambios
          mayores de régimen. Los <Term>swing points</Term> donde el spread cruza la media son frecuentemente
          puntos de entry/exit para trades de relative value.
        </P>
      </Commentary>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((it) => (
          <Panel key={it.key} title={it.label}>
            <LWCChart
              height={220}
              lines={[
                { data: it.data, color: "#4493f8", type: "area", title: "Spread (pp)", lineWidth: 1.8 },
                { data: it.data.map((p) => ({ time: p.time, value: it.stats.mean })), color: "#8b949e", title: `Media ${it.stats.mean.toFixed(2)}`, lineWidth: 1 },
              ]}
              priceFormat={{ minMove: 0.01, precision: 3 }}
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}
