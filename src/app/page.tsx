import {
  loadSeries,
  lastValue,
  percentileRank,
  rollingZScore,
  BCChKey,
} from "@/lib/data/bcch";
import { US_SNAPSHOT, US_CHANGES, US_HISTORY_LABELS, US_HISTORY } from "@/lib/data/market";
import { PageHeader, Section, Panel } from "@/components/fin/section";
import { MetricTile } from "@/components/fin/metric-tile";
import { CurveSnapshot } from "@/components/charts/curve-snapshot";
import { LWCChart } from "@/components/charts/lwc-chart";
import { Yld, Price } from "@/components/fin/num";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function snap(key: BCChKey) {
  const lv = lastValue(key);
  if (!lv) return { value: null, date: null, percentile: 0, z: 0, series: [] as { time: string; value: number }[] };
  const series = loadSeries(key);
  return {
    value: lv.value,
    date: lv.date,
    percentile: percentileRank(series),
    z: rollingZScore(series),
    series,
  };
}

function recentSpark(series: { time: string; value: number }[], n = 60): number[] {
  return series.slice(-n).map((p) => p.value);
}

function zUS(key: keyof typeof US_HISTORY): number {
  const s = US_HISTORY[key];
  if (s.length < 5) return 0;
  const last = s[s.length - 1];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  return sd === 0 ? 0 : (last - mean) / sd;
}

export default function Home() {
  const uf2 = snap("uf_2y"), uf5 = snap("uf_5y"), uf10 = snap("uf_10y"), uf20 = snap("uf_20y"), uf30 = snap("uf_30y");
  const clp2 = snap("clp_2y"), clp5 = snap("clp_5y"), clp10 = snap("clp_10y");
  const bei2 = snap("bei_2y"), bei5 = snap("bei_5y"), bei10 = snap("bei_10y");
  const tpm = snap("tpm");
  const usdclp = snap("usdclp");
  const uf = snap("uf");

  const us10yZ = zUS("us_10y");
  const us30yZ = zUS("us_30y");
  const moveZ = zUS("move");
  const uf20Z = uf20.z;
  const compositeScore = (us10yZ + us30yZ - moveZ + uf20Z) / 4;
  const verdict =
    compositeScore >= 1.5 ? { label: "Convicción alta", tone: "pos" as const, hint: "Múltiples señales alineadas con la tesis." } :
    compositeScore >= 0.5 ? { label: "Favorable", tone: "info" as const, hint: "Sesgo positivo, validar timing." } :
    compositeScore >= -0.5 ? { label: "Neutral", tone: "neutral" as const, hint: "Señales mixtas sin convicción direccional." } :
    compositeScore >= -1.5 ? { label: "Adverso", tone: "warn" as const, hint: "Sesgo en contra, esperar mejor entry." } :
    { label: "Contraindicado", tone: "neg" as const, hint: "Múltiples señales contra. No agregar." };

  const ufCurvePoints = [
    { tenor: "2Y", tenorYears: 2, yield: uf2.value ?? 0 },
    { tenor: "5Y", tenorYears: 5, yield: uf5.value ?? 0 },
    { tenor: "10Y", tenorYears: 10, yield: uf10.value ?? 0 },
    { tenor: "20Y", tenorYears: 20, yield: uf20.value ?? 0 },
    { tenor: "30Y", tenorYears: 30, yield: uf30.value ?? 0 },
  ];
  const clpCurvePoints = [
    { tenor: "2Y", tenorYears: 2, yield: clp2.value ?? 0 },
    { tenor: "5Y", tenorYears: 5, yield: clp5.value ?? 0 },
    { tenor: "10Y", tenorYears: 10, yield: clp10.value ?? 0 },
  ];
  const usCurvePoints = [
    { tenor: "5Y", tenorYears: 5, yield: US_SNAPSHOT.yields.us_5y },
    { tenor: "10Y", tenorYears: 10, yield: US_SNAPSHOT.yields.us_10y },
    { tenor: "30Y", tenorYears: 30, yield: US_SNAPSHOT.yields.us_30y },
  ];

  const usHistoryChart = US_HISTORY_LABELS.map((time, i) => ({
    us10: { time, value: US_HISTORY.us_10y[i] },
    us30: { time, value: US_HISTORY.us_30y[i] },
    us5: { time, value: US_HISTORY.us_5y[i] },
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Snapshot táctico"
        description="Estado del mercado de bonos · Chile (BCCh) + USA (yfinance)"
        right={
          <div className="flex flex-col items-end gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>USA · {fmtDate(US_SNAPSHOT.asOf)}</span>
            <span>BCCh · {fmtDate(uf10.date)}</span>
          </div>
        }
      />

      <Commentary title="Cómo leer este snapshot">
        <P>
          El <Term>score táctico compuesto</Term> agrega cuatro señales normalizadas (z-scores rolling) en una
          métrica resumen sobre qué tan atractiva está la duración USA larga respecto al promedio reciente. Score
          marcadamente positivo combina dos condiciones que históricamente preceden buenas entradas: yields por
          encima de tendencia y volatilidad implícita comprimida.
        </P>
        <P>
          La técnica viene de la literatura de <Term>tactical asset allocation</Term> (Faber, Asness): combinar
          señales independientes con baja correlación mejora la robustez de la decisión frente a cualquier
          indicador aislado. No es una predicción — es una medida de cuán extremo está el régimen actual frente a
          su distribución histórica.
        </P>
      </Commentary>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,360px]">
        <Panel title="Score táctico · Duración USA larga" right={
          <span className={
            verdict.tone === "pos" ? "pill border-[var(--color-pos)] text-[var(--color-pos)]" :
            verdict.tone === "neg" ? "pill border-[var(--color-neg)] text-[var(--color-neg)]" :
            verdict.tone === "warn" ? "pill border-[var(--color-warn)] text-[var(--color-warn)]" :
            verdict.tone === "info" ? "pill border-[var(--color-info)] text-[var(--color-info)]" :
            "pill"
          }>{verdict.label}</span>
        }>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px,1fr]">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="num text-4xl font-semibold tracking-tight">
                  {compositeScore > 0 ? "+" : ""}{compositeScore.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">σ</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{verdict.hint}</p>
            </div>
            <div className="space-y-2 border-l border-border pl-4">
              <ScoreRow label="UST 10Y vs 6m" value={us10yZ} ctx={`10Y ${US_SNAPSHOT.yields.us_10y.toFixed(3)}%`} />
              <ScoreRow label="UST 30Y vs 6m" value={us30yZ} ctx={`30Y ${US_SNAPSHOT.yields.us_30y.toFixed(3)}%`} />
              <ScoreRow label="MOVE (inv)" value={-moveZ} ctx={`MOVE ${US_SNAPSHOT.vol.move.toFixed(1)}`} />
              <ScoreRow label="UF 20Y vs 5y" value={uf20Z} ctx={`UF 20Y ${(uf20.value ?? 0).toFixed(2)}%`} />
            </div>
          </div>
        </Panel>

        <Commentary title="Mecánica del score" variant="compact">
          <P>
            Cada componente es un <Term>z-score</Term>: diferencia entre el valor actual y el promedio de la ventana,
            dividido por la desviación estándar. Un z de +2 indica que el yield está dos desviaciones por encima del
            promedio reciente — situación históricamente excepcional. La señal del MOVE entra con signo invertido:
            vol implícita comprimida (bajo MOVE) precede a movimientos direccionales claros en duración.
          </P>
        </Commentary>
      </div>

      <Section title="USA · Treasury y duración larga">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          <MetricTile label="UST 5Y" value={<Yld value={US_SNAPSHOT.yields.us_5y} decimals={3} />} delta={US_CHANGES.us_5y.day} deltaUnit="bps" spark={US_HISTORY.us_5y} sparkColor="#4493f8" />
          <MetricTile label="UST 10Y" value={<Yld value={US_SNAPSHOT.yields.us_10y} decimals={3} />} delta={US_CHANGES.us_10y.day} deltaUnit="bps" spark={US_HISTORY.us_10y} sparkColor="#4493f8" />
          <MetricTile label="UST 30Y" value={<Yld value={US_SNAPSHOT.yields.us_30y} decimals={3} />} delta={US_CHANGES.us_30y.day} deltaUnit="bps" spark={US_HISTORY.us_30y} sparkColor="#f85149" subtitle="Sobre 5% post-oct-23" />
          <MetricTile label="TLT" value={<Price value={US_SNAPSHOT.etfs.tlt} />} delta={US_CHANGES.tlt.day} deltaUnit="%" spark={US_HISTORY.tlt} sparkColor="#3fb950" subtitle="Bottom $82.42" />
          <MetricTile label="EDV" value={<Price value={US_SNAPSHOT.etfs.edv} />} delta={US_CHANGES.edv.day} deltaUnit="%" spark={US_HISTORY.edv} sparkColor="#3fb950" subtitle="Bajo rango 52s" />
          <MetricTile label="MOVE" value={<Price value={US_SNAPSHOT.vol.move} decimals={1} />} delta={US_CHANGES.move.day} deltaUnit="%" spark={US_HISTORY.move} sparkColor="#d29922" subtitle="Vol implícita" />
        </div>
      </Section>

      <Commentary title="Curva del Tesoro USA y proxies de duración">
        <P>
          Los yields del Treasury 5Y, 10Y y 30Y definen la <Term>estructura temporal de tasas</Term> en dólares — la
          referencia global de tasa libre de riesgo nominal. El delta diario en bps refleja presión de corto plazo:
          un movimiento de +20 bps en el 10Y es históricamente inusual y suele asociarse a sorpresas macro,
          subastas débiles, o cambios de guidance Fed.
        </P>
        <P>
          TLT (duración modificada ~17) y EDV (duración ~24) son los ETFs que materializan la apuesta. Su retorno
          1Y se aproxima por <Term>−duration × Δyield + ½ × convexity × (Δyield)² + cupón</Term>. Una baja paralela
          de 100 bps se traduce aproximadamente en +17% para TLT y +24% para EDV. La diferencia es <Term>convexidad</Term>:
          crece con el plazo y vuelve a EDV preferible en escenarios de movimientos grandes.
        </P>
        <P>
          El MOVE Index es el VIX del mercado de Treasuries: volatilidad implícita ponderada de opciones a 1 mes
          sobre swaps. Rango histórico típico: 70–90. Sobre 130 marca régimen de stress (post-SVB en marzo 2023
          llegó a 198). Lecturas bajas con yields altos suelen marcar inflection points — complacencia previa al
          repricing.
        </P>
      </Commentary>

      <Section title="Chile · Curva UF (real)">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "UF 2Y", s: uf2 },
            { label: "UF 5Y", s: uf5 },
            { label: "UF 10Y", s: uf10 },
            { label: "UF 20Y", s: uf20 },
            { label: "UF 30Y", s: uf30 },
          ].map(({ label, s }) => (
            <MetricTile
              key={label}
              label={label}
              value={<Yld value={s.value} />}
              spark={recentSpark(s.series, 90)}
              sparkColor="#39d0d8"
              pill={{ label: `p${s.percentile.toFixed(0)}`, tone: s.percentile < 25 ? "info" : s.percentile > 75 ? "warn" : "neutral" }}
              subtitle={fmtDate(s.date)}
            />
          ))}
        </div>
      </Section>

      <Commentary title="Yields reales chilenos y la equivalencia Fisher">
        <P>
          La curva UF cotiza <Term>yields reales</Term> — el retorno por sobre la inflación medida en UF. La
          <Term> ecuación de Fisher</Term> descompone el yield nominal en yield real más inflación esperada más
          prima de riesgo por inflación: <span className="num">(1+i) = (1+r)(1+π)</span>. La curva UF es el
          equivalente chileno de los TIPS estadounidenses y permite leer directamente el componente real del costo
          de capital local.
        </P>
        <P>
          El percentil (pill) ubica el yield actual dentro de su distribución de los últimos 5 años. Un p10 indica
          que el yield está más bajo que el 90% de las observaciones recientes — caro frente al histórico. Un p90
          es lo opuesto: barato y candidato a entry. Es la versión no-paramétrica del z-score; resiste mejor a
          outliers que el promedio y la desviación estándar.
        </P>
      </Commentary>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Curva UF · snapshot">
          <CurveSnapshot points={ufCurvePoints} colorMain="#39d0d8" labelMain="UF actual" />
        </Panel>
        <Panel title="Curva CLP · snapshot">
          <CurveSnapshot points={clpCurvePoints} colorMain="#4493f8" labelMain="CLP actual" />
        </Panel>
        <Panel title="Curva UST · snapshot">
          <CurveSnapshot points={usCurvePoints} colorMain="#f85149" labelMain="USA actual" />
        </Panel>
      </div>

      <Commentary title="La estructura temporal de tasas — tres curvas, tres mensajes">
        <P>
          Una <Term>curva de yield</Term> grafica el rendimiento al vencimiento contra el plazo. Codifica
          expectativas de tasas futuras, prima por plazo (<Term>term premium</Term>) y, en curvas indexadas,
          expectativas de inflación. La hipótesis de expectativas pura postula que el yield a plazo n es el
          promedio geométrico esperado de las tasas cortas futuras. En la práctica el term premium es no-cero y
          varía con el ciclo: típicamente positivo, pero puede colapsar a negativo en períodos de QE intenso.
        </P>
        <P>
          Las tres curvas se leen como un sistema. La distancia entre la curva UF y la CLP nominal define el
          <Term> breakeven inflation</Term> implícito: <span className="num">CLP − UF</span> en cada plazo es la
          inflación promedio que iguala los retornos. La curva UST es el benchmark de tasa libre de riesgo global;
          el spread CLP sobre UST captura prima de riesgo país más expectativas de devaluación.
        </P>
      </Commentary>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Section title="Chile · Curva CLP (nominal)">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "CLP 2Y", s: clp2 },
              { label: "CLP 5Y", s: clp5 },
              { label: "CLP 10Y", s: clp10 },
            ].map(({ label, s }) => (
              <MetricTile
                key={label}
                label={label}
                value={<Yld value={s.value} />}
                spark={recentSpark(s.series, 90)}
                sparkColor="#4493f8"
                pill={{ label: `p${s.percentile.toFixed(0)}`, tone: s.percentile < 25 ? "info" : s.percentile > 75 ? "warn" : "neutral" }}
                subtitle={fmtDate(s.date)}
              />
            ))}
          </div>
        </Section>
        <Section title="Chile · Breakeven inflation (swaps)">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "BEI 2Y", s: bei2 },
              { label: "BEI 5Y", s: bei5 },
              { label: "BEI 10Y", s: bei10 },
            ].map(({ label, s }) => (
              <MetricTile
                key={label}
                label={label}
                value={<Yld value={s.value} />}
                spark={recentSpark(s.series, 90)}
                sparkColor="#d29922"
                pill={{ label: `p${s.percentile.toFixed(0)}`, tone: s.percentile < 25 ? "info" : s.percentile > 75 ? "warn" : "neutral" }}
                subtitle={fmtDate(s.date)}
              />
            ))}
          </div>
        </Section>
      </div>

      <Commentary title="Curva nominal CLP y compensación inflacionaria">
        <P>
          La curva CLP nominal incorpora dos premios: el yield real esperado y la compensación por inflación
          (BEI). Esto habilita <Term>relative-value trading</Term> entre las dos curvas. Si el BEI implícito
          (<span className="num">CLP − UF</span>) está por debajo del consenso EOF/EEEE de inflación de largo plazo,
          comprar UF y vender CLP es una apuesta a que el mercado reprice al alza las expectativas. El trade
          inverso aplica cuando está por encima.
        </P>
        <P>
          Los swaps cámara cotizan expectativas de inflación spot y forward sin necesidad de interpolar curvas —
          son la fuente más limpia para construir el BEI. El BEI 2Y refleja expectativas de corto plazo, sensible
          a IPC realizado reciente y a commodities. El BEI 10Y captura la credibilidad estructural del banco
          central: cuando se sostiene sobre 3.5%, el mercado descuenta inflación persistente sobre el target —
          señal de desanclaje.
        </P>
      </Commentary>

      <Section title="Política monetaria · Tipos de cambio">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricTile label="TPM Chile" value={<Yld value={tpm.value} />} subtitle={fmtDate(tpm.date)} spark={recentSpark(tpm.series, 60)} sparkColor="#4493f8" />
          <MetricTile label="Fed Funds" value={<Yld value={4.375} />} subtitle="Target 4.25–4.50" />
          <MetricTile label="USD/CLP" value={<Price value={usdclp.value} />} subtitle={fmtDate(usdclp.date)} spark={recentSpark(usdclp.series, 60)} sparkColor="#39d0d8" />
          <MetricTile label="UF" value={<Price value={uf.value} />} subtitle={fmtDate(uf.date)} spark={recentSpark(uf.series, 60)} sparkColor="#8b949e" />
        </div>
      </Section>

      <Commentary title="Política monetaria y transmisión cambiaria">
        <P>
          La TPM del BCCh y la Fed Funds del FOMC son las tasas overnight de referencia en cada jurisdicción.
          Anclan la curva corta: el extremo izquierdo queda determinado casi por completo por la expectativa
          de TPM o Fed Funds promedio durante el plazo. El spread TPM−Fed Funds, junto a la prima de riesgo
          país y la inflación esperada, define el equilibrio del USD/CLP forward por <Term>covered interest
          parity</Term>.
        </P>
        <P>
          El USD/CLP responde a tres factores: precio del cobre (terms of trade), diferencial de tasas reales
          Chile−USA, y aversión al riesgo global vía DXY. La UF se actualiza diariamente según el IPC del mes
          anterior y opera como unidad de cuenta indexada para contratos largos. Su movimiento conjunto con
          USD/CLP captura inflación local relativa al USD.
        </P>
      </Commentary>

      <Panel title="UST 5Y · 10Y · 30Y — últimos 6 meses" right={<span className="text-[10px] uppercase tracking-wider text-muted-foreground">yfinance</span>}>
        <LWCChart
          height={300}
          lines={[
            { data: usHistoryChart.map((d) => d.us30), color: "#f85149", title: "30Y", lineWidth: 2 },
            { data: usHistoryChart.map((d) => d.us10), color: "#4493f8", title: "10Y", lineWidth: 2 },
            { data: usHistoryChart.map((d) => d.us5), color: "#3fb950", title: "5Y", lineWidth: 1.5 },
          ]}
          priceFormat={{ minMove: 0.001, precision: 3 }}
        />
      </Panel>

      <Commentary title="Evolución de la curva USA · 6 meses">
        <P>
          Tres patrones organizan la lectura. El <Term>nivel</Term> — movimiento paralelo de los tres yields —
          indica cambios en la tasa libre de riesgo global. La <Term>pendiente</Term> (10Y−2Y o 30Y−5Y) mide
          expectativas relativas: positiva señala crecimiento e inflación; negativa o invertida es indicador
          clásico de recesión a 12–18 meses (Estrella y Mishkin 1996). La <Term>curvatura</Term> (2×10Y − 5Y − 30Y)
          captura sensibilidad a la política monetaria intermedia.
        </P>
        <P>
          Estos tres factores explican típicamente más del 95% de la varianza de los movimientos de curva
          (<Term>PCA factor decomposition</Term>, Litterman y Scheinkman 1991). Cualquier estrategia táctica en
          duración debe descomponer su tesis en estos componentes: una apuesta a baja paralela (factor nivel)
          es distinta de una apuesta a empinamiento (factor pendiente), y los vehículos óptimos para cada una
          difieren.
        </P>
      </Commentary>
    </div>
  );
}

function ScoreRow({ label, value, ctx }: { label: string; value: number; ctx: string }) {
  const color = value > 0.5 ? "text-[var(--color-pos)]" : value < -0.5 ? "text-[var(--color-neg)]" : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex-1">
        <div className="text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{ctx}</div>
      </div>
      <div className={`num ${color}`}>
        {value > 0 ? "+" : ""}{value.toFixed(2)}
      </div>
    </div>
  );
}
