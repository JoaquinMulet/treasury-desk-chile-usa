"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/fin/section";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { MetricTile } from "@/components/fin/metric-tile";
import { LWCChart } from "@/components/charts/lwc-chart";
import { Pct, Signed } from "@/components/fin/num";
import { Commentary, Term, P } from "@/components/fin/commentary";

type Rule = { signal: "yield_above" | "yield_below" | "always_long"; threshold: number; asset: "TLT" | "EDV" | "BTU"; hold_months: number };

function generateHistorical() {
  const out: { date: string; y10us: number; tlt_ret: number }[] = [];
  let y = 4.5;
  const start = new Date(2018, 0);
  for (let i = 0; i < 90; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const shock = (Math.sin(i * 1.13) + Math.cos(i * 0.7)) * 0.15 + (Math.sin(i * 0.3) * 0.4);
    y = Math.max(0.5, Math.min(7, y + shock));
    const dy = (y - (out[out.length - 1]?.y10us ?? y)) / 100;
    const ret = -17 * dy + 0.045 / 12;
    out.push({ date: d.toISOString().slice(0, 7), y10us: parseFloat(y.toFixed(3)), tlt_ret: parseFloat((ret * 100).toFixed(3)) });
  }
  return out;
}
const HIST_MONTHLY = generateHistorical();

function runBacktest(rule: Rule, data: typeof HIST_MONTHLY) {
  const trades: { entry: string; exit: string; ret: number; entryYield: number }[] = [];
  let i = 0;
  while (i < data.length) {
    const d = data[i];
    const fire = rule.signal === "always_long" ? true : rule.signal === "yield_above" ? d.y10us > rule.threshold : d.y10us < rule.threshold;
    if (fire) {
      const end = Math.min(data.length, i + rule.hold_months);
      let ret = 0;
      for (let j = i; j < end; j++) ret += data[j].tlt_ret;
      trades.push({ entry: d.date, exit: data[end - 1]?.date ?? d.date, ret, entryYield: d.y10us });
      i = end;
    } else { i += 1; }
  }
  return trades;
}

export default function BacktestPage() {
  const [rule, setRule] = useState<Rule>({ signal: "yield_above", threshold: 4.5, asset: "TLT", hold_months: 24 });

  const trades = useMemo(() => runBacktest(rule, HIST_MONTHLY), [rule]);
  const bh = HIST_MONTHLY.reduce((s, d) => s + d.tlt_ret, 0);
  const stats = useMemo(() => {
    if (trades.length === 0) return { n: 0, totalRet: 0, avgRet: 0, hitRate: 0, bestRet: 0, worstRet: 0 };
    const totalRet = trades.reduce((s, t) => s + t.ret, 0);
    const positives = trades.filter((t) => t.ret > 0).length;
    return { n: trades.length, totalRet, avgRet: totalRet / trades.length, hitRate: (positives / trades.length) * 100, bestRet: Math.max(...trades.map((t) => t.ret)), worstRet: Math.min(...trades.map((t) => t.ret)) };
  }, [trades]);

  const yieldSeries = HIST_MONTHLY.map((d) => ({ time: d.date + "-01", value: d.y10us }));
  const cumulSeries: { time: string; value: number }[] = [];
  let acc = 0;
  for (const d of HIST_MONTHLY) {
    acc += d.tlt_ret;
    cumulSeries.push({ time: d.date + "-01", value: acc });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Backtesting"
        description="Reglas tactical sobre histórico proxy 90 meses · retornos TLT estimados"
      />

      <Commentary title="Backtesting · disciplina y trampas comunes">
        <P>
          Un <Term>backtest</Term> simula cómo habría rendido una estrategia si se hubiera aplicado sobre un
          histórico. Su valor diagnóstico es alto, pero su valor predictivo está condicionado a tres requisitos
          metodológicos: (1) <Term>out-of-sample testing</Term> — no usar el mismo período para optimizar
          parámetros y reportar performance; (2) <Term>walk-forward optimization</Term> — re-optimizar parámetros
          periódicamente con sólo información disponible al momento; (3) <Term>look-ahead bias zero</Term> — no
          usar variables que no estaban disponibles en tiempo real al momento de la decisión.
        </P>
        <P>
          Métricas clave: el <Term>hit rate</Term> mide el % de trades positivos; útil pero engañoso si los trades
          negativos son grandes. El <Term>Sharpe ratio</Term> ajusta retorno por volatilidad: <span className="num">
          (retorno − tasa libre de riesgo) / σ</span>. El <Term>max drawdown</Term> mide la peor pérdida pico-a-valle:
          fundamental para evaluar si la estrategia es psicológicamente sostenible. Una regla con Sharpe alto pero
          drawdown &gt;30% raramente sobrevive al trading real.
        </P>
      </Commentary>

      <Commentary title="Sistema canónico · trend-following y la regla del 10-month SMA">
        <P>
          El paper de Faber (<Term>A Quantitative Approach to Tactical Asset Allocation</Term>, Cambria
          Investment, 2013) formaliza la regla más estudiada de trend-following: estar largo cuando el precio
          mensual supera su promedio móvil de 10 meses; pasar a caja cuando lo cruza a la baja. La regla
          actualiza una sola vez al mes, opera sobre cinco clases equiponderadas (S&amp;P 500, MSCI EAFE,
          Treasury 10Y, GSCI, NAREIT) y reporta resultados sobre la ventana 1973–2012 — una de las muestras
          de backtest más extensas publicadas para asset allocation táctico, con extensión 1900–2012 para
          el S&amp;P 500 individual.
        </P>
        <P>
          Los resultados base: el buy-and-hold equiponderado retorna 9.92% anual con 10.28% de volatilidad y
          drawdown máximo de −46%; aplicando el filtro de timing, el mismo portafolio retorna 10.48% con 6.99%
          de volatilidad y drawdown máximo de −9.54%. La Sharpe sube de 0.44 a 0.73 sin sacrificar retorno. El
          portafolio expandido a 13 clases (incorporando value, momentum, emerging, oro, corporate) eleva la
          Sharpe a 0.94. Faber documenta <Term>estabilidad de parámetros</Term>: medias móviles de 3 a 12 meses
          producen resultados similares (Sharpe entre 0.60 y 0.77, MaxDD entre −9.8% y −17.4%), lo que descarta
          overfit a la elección puntual de 10 meses y reduce la sospecha de data-mining.
        </P>
      </Commentary>

      <Panel title="Configuración de regla">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Señal</Label>
            <Select value={rule.signal} onValueChange={(v) => v && setRule({ ...rule, signal: v as Rule["signal"] })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yield_above">Yield 10Y &gt; umbral</SelectItem>
                <SelectItem value="yield_below">Yield 10Y &lt; umbral</SelectItem>
                <SelectItem value="always_long">Always long</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Umbral (%)</Label>
            <Input className="mt-1 font-mono" type="number" step="0.1" value={rule.threshold} onChange={(e) => setRule({ ...rule, threshold: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Activo</Label>
            <Select value={rule.asset} onValueChange={(v) => v && setRule({ ...rule, asset: v as Rule["asset"] })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TLT">TLT (dur 17)</SelectItem>
                <SelectItem value="EDV">EDV (dur 24)</SelectItem>
                <SelectItem value="BTU">BTU CL (dur 14)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Holding (meses)</Label>
            <Input className="mt-1 font-mono" type="number" value={rule.hold_months} onChange={(e) => setRule({ ...rule, hold_months: parseInt(e.target.value) || 12 })} />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <MetricTile label="Trades" value={stats.n.toString()} />
        <MetricTile label="Retorno total" value={<Signed value={stats.totalRet} colored />} unit="%" />
        <MetricTile label="Promedio trade" value={<Signed value={stats.avgRet} colored />} unit="%" />
        <MetricTile label="Hit rate" value={`${stats.hitRate.toFixed(0)}%`} />
        <MetricTile label="Mejor trade" value={<Signed value={stats.bestRet} colored />} unit="%" />
        <MetricTile label="Peor trade" value={<Signed value={stats.worstRet} colored />} unit="%" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Yield 10Y · histórico simulado">
          <LWCChart
            height={220}
            lines={[
              { data: yieldSeries, color: "#4493f8", title: "10Y USA", lineWidth: 1.5 },
              { data: yieldSeries.map((p) => ({ time: p.time, value: rule.threshold })), color: "#d29922", title: "Umbral", lineWidth: 1 },
            ]}
            priceFormat={{ minMove: 0.01, precision: 2 }}
          />
        </Panel>
        <Panel title={`Retorno acumulado · regla vs B&H (B&H: ${bh.toFixed(1)}%, regla: ${stats.totalRet.toFixed(1)}%)`}>
          <LWCChart
            height={220}
            lines={[
              { data: cumulSeries, color: "#3fb950", type: "area", title: "B&H acum %", lineWidth: 1.5 },
            ]}
            priceFormat={{ minMove: 0.1, precision: 1 }}
          />
        </Panel>
      </div>

      <Commentary title="Comparativa contra Buy & Hold" variant="compact">
        <P>
          La gráfica derecha muestra el <Term>retorno acumulado</Term> de buy-and-hold sobre el período completo —
          el benchmark más exigente. Una regla táctica solo agrega valor si su retorno total supera al B&amp;H ajustado
          por riesgo (Sharpe), y si la diferencia no es producto de market timing afortunado en pocos meses (
          overfitting a peaks/valleys específicos). La regla del pulgar: si Sharpe táctico no supera Sharpe B&amp;H
          por al menos 0.3 unidades sobre 10+ años, no hay edge estadísticamente significativo.
        </P>
      </Commentary>

      <Commentary title="Por qué funciona · clustering de volatilidad y distribución del alpha en el tiempo">
        <P>
          El mecanismo teórico detrás de la regla del SMA es el <Term>volatility clustering</Term>: en promedio
          sobre las cinco clases analizadas por Faber (S&amp;P 500, MSCI EAFE, Treasury 10Y, GSCI, NAREIT), los
          períodos por debajo del SMA de 10 meses han exhibido retornos 60% más bajos y volatilidad 30% más alta
          que los períodos por encima (Figura 18, 1973–2012). Para el S&amp;P 500 individual el efecto es de
          magnitud similar (−59% retorno, +44% volatilidad). La regla convierte una observación estadística — los
          regímenes de alta volatilidad tienden a persistir — en una señal accionable de reducción de exposición.
          Es la misma intuición que sostienen los modelos <Term>GARCH</Term> (Engle 1982): la varianza condicional
          es predecible aunque la media no lo sea.
        </P>
        <P>
          El alpha del filtro <Term>no se distribuye uniformemente</Term>. La descomposición por décadas en el
          paper (1900s a 2000s, Appendix B) muestra que el timing supera al buy-and-hold por 3–8 puntos anuales
          en décadas volátiles o bajistas (1900s, 1930s, 1970s, 2000s), empata en décadas mixtas (1920s, 1960s,
          1980s) y subperforma en bull markets unidireccionales (1940s, 1990s). En la "década perdida"
          del S&amp;P — los 2000s — el buy-and-hold retornó −0.94% anual con drawdown de −50.95%; la misma regla
          retornó +7.73% con drawdown de −6.82%. El caso más extremo es 1929–1932: el S&amp;P cayó −84%, mientras
          el sistema con SMA limitó la pérdida a −42% (Figura 7). Lección operativa: la utilidad del filtro no es
          generar retornos extra en mercados alcistas estables, es truncar la cola izquierda en mercados bajistas
          largos. Quien busque alpha en bull markets debe usar otro vehículo.
        </P>
      </Commentary>

      <Commentary title="Métricas avanzadas · más allá de Sharpe">
        <P>
          Sharpe es la métrica más conocida pero tiene limitaciones: penaliza simétricamente upside y downside
          volatility, ignora skewness y kurtosis. Complementos estándar: <Term>Sortino ratio</Term> (retorno sobre
          downside deviation — penaliza solo volatilidad negativa, mejor para estrategias con upside asimétrico
          como duración larga); <Term>Calmar ratio</Term> (CAGR sobre max drawdown — captura tolerancia
          psicológica al pain); <Term>information ratio</Term> (retorno excedente sobre tracking error — mide
          skill activo versus benchmark).
        </P>
        <P>
          El <Term>turnover</Term> de la estrategia (% de cartera transada por año) determina cuánto cuesta
          implementarla: a 50% TER + 10 bps spread × turnover = costo real. Estrategias con turnover &gt;200%
          anual rara vez sobreviven el ajuste por costos transaccionales. El <Term>overfitting</Term> es la
          trampa más común en backtests: optimizar parámetros sobre el histórico hasta encontrar combinación que
          performó bien, sin garantía de generalización. Mitigación: <Term>in-sample/out-of-sample split</Term>
          (entrenar en primer 60% del histórico, validar en último 40%) y <Term>regime change testing</Term>
          (verificar que la regla funciona en distintos regímenes macro: ZIRP 2009-2015, normalización 2016-2018,
          COVID-shock 2020-2021, hiking cycle 2022-2024).
        </P>
      </Commentary>

      <Panel title="Trades disparados">
        {trades.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">La regla no gatilló trades</div>
        ) : (
          <FinTable>
            <FinThead>
              <FinTr>
                <FinTh>#</FinTh>
                <FinTh>Entrada</FinTh>
                <FinTh>Salida</FinTh>
                <FinTh align="right">Y10 entrada</FinTh>
                <FinTh align="right">Retorno</FinTh>
              </FinTr>
            </FinThead>
            <FinTbody>
              {trades.map((t, i) => (
                <FinTr key={i}>
                  <FinTd>{i + 1}</FinTd>
                  <FinTd>{t.entry}</FinTd>
                  <FinTd>{t.exit}</FinTd>
                  <FinTd align="right"><Pct value={t.entryYield} /></FinTd>
                  <FinTd align="right">
                    <span className={
                      "pill " +
                      (t.ret > 0 ? "border-[var(--color-pos)] text-[var(--color-pos)]" : "border-[var(--color-neg)] text-[var(--color-neg)]")
                    }>
                      {t.ret > 0 ? "+" : ""}{t.ret.toFixed(1)}%
                    </span>
                  </FinTd>
                </FinTr>
              ))}
            </FinTbody>
          </FinTable>
        )}
      </Panel>
    </div>
  );
}
