import { PageHeader, Panel, Section } from "@/components/fin/section";
import { LWCChart } from "@/components/charts/lwc-chart";
import { CurveSnapshot } from "@/components/charts/curve-snapshot";
import { MetricTile } from "@/components/fin/metric-tile";
import { loadSeries, lastValue, BCChKey } from "@/lib/data/bcch";
import { Yld, Bps } from "@/components/fin/num";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { fmtDate, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const PALETTE = ["#4493f8", "#3fb950", "#d29922", "#f85149"];

function recentSpark(series: { time: string; value: number }[], n = 60): number[] {
  return series.slice(-n).map((p) => p.value);
}

export default function InflationPage() {
  const beiKeys: { key: BCChKey; label: string; tenor: number }[] = [
    { key: "bei_1y", label: "1Y", tenor: 1 },
    { key: "bei_2y", label: "2Y", tenor: 2 },
    { key: "bei_5y", label: "5Y", tenor: 5 },
    { key: "bei_10y", label: "10Y", tenor: 10 },
  ];

  const beiLines = beiKeys.map((k, i) => ({
    data: loadSeries(k.key).map((p) => ({ time: p.time, value: p.value })),
    color: PALETTE[i],
    title: k.label,
    lineWidth: 1.5 as const,
  }));

  const lastBEI = beiKeys.map((k) => ({ ...k, last: lastValue(k.key), series: loadSeries(k.key) }));

  const beiCurve = lastBEI
    .map((b) => (b.last ? { tenor: b.label, tenorYears: b.tenor, yield: b.last.value } : null))
    .filter(Boolean) as { tenor: string; tenorYears: number; yield: number }[];

  const bei_2y = lastValue("bei_2y")?.value ?? 0;
  const bei_5y = lastValue("bei_5y")?.value ?? 0;
  const bei_10y = lastValue("bei_10y")?.value ?? 0;
  const fwd_2x3 = (bei_5y * 5 - bei_2y * 2) / 3;
  const fwd_5x5 = (bei_10y * 10 - bei_5y * 5) / 5;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inflación · Breakeven"
        description="Compensación inflacionaria implícita en swaps cámara (BCCh)"
      />

      <Commentary title="Breakeven inflation · qué se mide">
        <P>
          El <Term>breakeven inflation (BEI)</Term> es la tasa de inflación promedio anual durante un plazo n que
          iguala el retorno esperado de un bono nominal con un bono indexado a inflación. Es la expectativa de
          inflación implícita en precios de mercado — distinta a la expectativa de encuesta (EOF/EEEE) y al
          forecast del banco central. Para Chile se construye desde swaps cámara, instrumento que aísla la
          expectativa pura sin necesidad de interpolar curvas BCU vs BCP.
        </P>
        <P>
          Existen tres componentes en el BEI según descomposiciones afines (Adrian-Crump-Moench, D&apos;Amico-Kim-Wei):
          (1) <Term>expectativa real de inflación</Term> condicional a información actual, (2) <Term>prima por riesgo
          inflación</Term> (compensación por incertidumbre sobre la inflación futura — típicamente positiva), y (3)
          <Term>prima de liquidez</Term> entre bonos indexados y nominales (en Chile, UF descuenta liquidez vs CLP).
          El nivel observado del BEI es la suma de los tres.
        </P>
      </Commentary>

      <Section title="BEI por plazo">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {lastBEI.map((b, i) => (
            <MetricTile
              key={b.label}
              label={`BEI ${b.label}`}
              value={<Yld value={b.last?.value} />}
              subtitle={fmtDate(b.last?.date)}
              spark={recentSpark(b.series, 90)}
              sparkColor={PALETTE[i]}
              pill={{
                label: b.last && b.last.value > 3.3 ? "Sobre target" : b.last && b.last.value < 2.7 ? "Bajo target" : "Anclada",
                tone: b.last && b.last.value > 3.3 ? "warn" : b.last && b.last.value < 2.7 ? "info" : "pos",
              }}
            />
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Curva BEI · snapshot">
          <CurveSnapshot points={beiCurve} colorMain="#d29922" labelMain="BEI actual" />
        </Panel>

        <Panel title="Diagnóstico anclaje vs target 3% BCCh">
          <div className="space-y-3">
            <Row label="BEI 2Y vs target" value={bei_2y - 3} suffix="pp" inverse />
            <Row label="BEI 5Y vs target" value={bei_5y - 3} suffix="pp" inverse />
            <Row label="BEI 10Y vs target" value={bei_10y - 3} suffix="pp" inverse />
            <Row label="Slope BEI 10Y−2Y" value={bei_10y - bei_2y} suffix="pp" />
            <div className="mt-3 border-t border-border pt-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Forwards implícitos</div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">BEI 2y×3 (años 3-5)</span>
                <span className="num font-semibold">{fmtPct(fwd_2x3, 2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">BEI 5y×5 (años 6-10)</span>
                <span className="num font-semibold">{fmtPct(fwd_5x5, 2)}</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Commentary title="Z-score y percentile del BEI" variant="compact">
        <P>
          Cada tile muestra el BEI actual y un <Term>percentile</Term> p_N indicando cuán extremo es respecto al
          histórico. Un p10 indica BEI comprimido (mercado descuenta inflación baja históricamente); un p90 indica
          BEI elevado (expectativas inflación arriba del rango histórico). Para hacer trades de inflación, el
          <Term>z-score</Term> equivalente es la métrica estándar: |z|&gt;1.5 marca regiones donde mean reversion
          histórica ha sido informativa.
        </P>
      </Commentary>

      <Commentary title="Snapshot de la curva BEI y forwards implícitos">
        <P>
          El snapshot muestra la <Term>curva BEI</Term> en cada plazo. La forma típica para Chile es ligeramente
          descendente (BEI corto &gt; BEI largo) porque el BCCh está creíblemente comprometido con el target 3% de
          mediano plazo; el extremo corto recoge inflación realizada reciente más expectativas a 12-24 meses,
          mientras que el extremo largo refleja anclaje al target. Cuando BEI 10Y se sostiene sobre 3.5%, hay
          señal de desanclaje estructural.
        </P>
        <P>
          Los <Term>forwards implícitos</Term> (BEI 2y×3 = inflación promedio años 3-5; BEI 5y×5 = años 6-10) se
          calculan via no-arbitraje: <span className="num">(1+BEI_5)^5 = (1+BEI_2)^2 × (1+BEI_2x3)^3</span>. Estos
          forwards son la herramienta clave para evaluar credibilidad del banco central — son las expectativas que
          el mercado descuenta en horizontes donde el output gap y los shocks transitorios deberían haberse disipado.
          BEI 5y×5 sobre 3% indica que el mercado no cree en convergencia al target.
        </P>
      </Commentary>

      <Panel title="Histórico — BEI por plazo (swaps cámara desde 2005)" right={<span className="text-[10px] uppercase tracking-wider text-muted-foreground">{loadSeries("bei_5y").length.toLocaleString("es-CL")} obs</span>}>
        <LWCChart height={400} lines={beiLines} priceFormat={{ minMove: 0.01, precision: 2 }} />
      </Panel>

      <Commentary title="Histórico BEI · lectura del nivel y la pendiente">
        <P>
          Esta serie de 20 años permite identificar regímenes. El BEI 10Y promedió 3.0–3.2% durante 2005–2020 — el
          ancla del target del BCCh. El shock 2021–2022 (inflación realizada llegó a 14% YoY) elevó el BEI 5Y a más
          de 5% pero el BEI 10Y subió menos de 50 bps: la curva BEI se invirtió fuertemente porque el mercado
          confiaba en que la TPM agresivamente alta del BCCh (11.25% peak) traería la inflación de regreso al target.
          Esa convicción fue validada: en 2024 el BEI volvió a la zona 3%.
        </P>
        <P>
          La lección académica: la <Term>credibilidad del régimen monetario</Term> se mide por la elasticidad del
          BEI largo a los shocks de inflación realizada. Bajo régimen creíble, BEI corto fluctúa pero BEI largo
          se mantiene anclado. Esta es la métrica que más le importa al BCCh y que los IPoM monitorean explícitamente.
        </P>
      </Commentary>
    </div>
  );
}

function Row({ label, value, suffix, inverse }: { label: string; value: number; suffix: string; inverse?: boolean }) {
  const absVal = Math.abs(value);
  const color = inverse
    ? absVal > 0.5
      ? "text-[var(--color-neg)]"
      : absVal > 0.2
      ? "text-[var(--color-warn)]"
      : "text-[var(--color-pos)]"
    : value > 0
    ? "text-[var(--color-pos)]"
    : "text-[var(--color-neg)]";
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num font-semibold ${color}`}>
        {value > 0 ? "+" : ""}{value.toFixed(2)} {suffix}
      </span>
    </div>
  );
}
