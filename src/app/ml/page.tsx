import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { MetricTile } from "@/components/fin/metric-tile";
import { BarGauge } from "@/components/fin/bar-gauge";
import { Heatmap } from "@/components/charts/heatmap";
import { Num, Pct, Signed } from "@/components/fin/num";
import { buildMonthlyDataset, FEATURE_LABELS } from "@/lib/ml/features";
import { kmeans } from "@/lib/ml/kmeans";
import { walkForwardLogistic } from "@/lib/ml/walk-forward";
import { trainLogistic, predictProba, featureImportance } from "@/lib/ml/logistic";
import {
  calibration,
  sharpe,
  skewKurt,
  probabilisticSharpe,
  deflatedSharpe,
} from "@/lib/ml/metrics";

export const dynamic = "force-dynamic";

const K = 4;
const MIN_TRAIN = 36;
const STEP = 3;
const BOND_DURATION = 8; // duración modificada aproximada del bono 10Y CLP
// Grid de N_TRIALS para análisis de sensibilidad DSR. El N "verdadero" es opaco
// — debería contar cada hyperparam considerado durante desarrollo (lambda,
// step, threshold, lr, iter, k, features). La tabla reporta varias hipótesis
// para que el lector evalúe robustez.
const N_TRIALS_GRID = [1, 10, 50, 200];

const REGIME_NAMES: Record<number, { label: string; tone: string }> = {
  0: { label: "Régimen A", tone: "var(--color-info)" },
  1: { label: "Régimen B", tone: "var(--color-pos)" },
  2: { label: "Régimen C", tone: "var(--color-warn)" },
  3: { label: "Régimen D", tone: "var(--color-neg)" },
};

export default function MLPage() {
  const { observations, featureNames, rawMonthCount, filteredMonthCount } =
    buildMonthlyDataset();

  if (observations.length < MIN_TRAIN + STEP) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Análisis ML"
          description="Regímenes y predicción condicional"
        />
        <Panel>
          <div className="py-6 text-xs text-muted-foreground">
            Datos BCCh insuficientes para correr el pipeline (n={observations.length},
            mínimo {MIN_TRAIN + STEP}).
          </div>
        </Panel>
      </div>
    );
  }

  const dates = observations.map((o) => o.date);
  const X = observations.map((o) => o.features);

  // ============================================================
  // PANEL 1 · REGIME CLUSTERING (K-means sobre features estandarizadas)
  // ============================================================
  //
  // NOTA METODOLÓGICA: aquí se fitea K-means sobre TODAS las observaciones.
  // El propósito es DESCRIPTIVO (¿qué regímenes existen en la historia?),
  // no predictivo. La asignación de regime a cada mes t depende sólo de
  // features observables en t — los forward returns NO entran al fit.
  // Aun así, el caller debe entender que esta partición usa información
  // posterior a t para definir los centros del cluster — válido para
  // describir la historia, NO para evaluar un sistema real-time.
  // ============================================================

  // Estandarización GLOBAL (sólo para clustering descriptivo)
  const d = X[0].length;
  const globalMean = new Array(d).fill(0);
  for (const r of X) for (let i = 0; i < d; i++) globalMean[i] += r[i];
  for (let i = 0; i < d; i++) globalMean[i] /= X.length;
  const globalStd = new Array(d).fill(0);
  for (const r of X) for (let i = 0; i < d; i++) globalStd[i] += (r[i] - globalMean[i]) ** 2;
  for (let i = 0; i < d; i++) globalStd[i] = Math.sqrt(globalStd[i] / X.length) || 1;
  const Xstd = X.map((r) => r.map((v, j) => (v - globalMean[j]) / globalStd[j]));

  const km = kmeans(Xstd, K, { nInit: 20, seed: 42 });

  type Cluster = {
    label: number;
    n: number;
    months: string[];
    forwardChanges: number[]; // forward 3m yield change (pp)
    avgForwardChange: number;
    forwardStd: number;
    winRateRally: number; // proporción donde yield baja > 25 bps
    centerRaw: number[]; // centroide en escala original (de-estandarizado)
  };

  const clusters: Cluster[] = Array.from({ length: K }, (_, j) => ({
    label: j,
    n: 0,
    months: [],
    forwardChanges: [],
    avgForwardChange: 0,
    forwardStd: 0,
    winRateRally: 0,
    centerRaw: km.centers[j].map((v, idx) => v * globalStd[idx] + globalMean[idx]),
  }));

  for (let i = 0; i < km.labels.length; i++) {
    const lbl = km.labels[i];
    const c = clusters[lbl];
    c.n++;
    c.months.push(dates[i]);
    const t = observations[i].target;
    if (t !== undefined) c.forwardChanges.push(t);
  }
  for (const c of clusters) {
    const fr = c.forwardChanges;
    if (fr.length > 0) {
      const m = fr.reduce((a, b) => a + b, 0) / fr.length;
      c.avgForwardChange = m;
      const v = fr.reduce((s, x) => s + (x - m) ** 2, 0) / fr.length;
      c.forwardStd = Math.sqrt(v);
      c.winRateRally = fr.filter((x) => x < -0.25).length / fr.length;
    }
  }

  const currentLabel = km.labels[km.labels.length - 1];
  const currentMonth = dates[dates.length - 1];

  // Heatmap: centroides por regime × feature
  const heatmapRows = clusters.map((c) => REGIME_NAMES[c.label].label);
  const heatmapCells = clusters.map((c) => c.centerRaw);

  // ============================================================
  // PANEL 2 · WALK-FORWARD LOGISTIC REGRESSION
  // ============================================================
  // Filtra observaciones con target definido (últimas 3 filas no tienen forward)
  const trainable = observations.filter((o) => o.targetBinary !== undefined);
  const Xt = trainable.map((o) => o.features);
  const yt = trainable.map((o) => o.targetBinary!);
  const dt = trainable.map((o) => o.date);

  const wf = walkForwardLogistic(Xt, yt, dt, MIN_TRAIN, STEP, {
    lambda: 0.1,
    lr: 0.15,
    iter: 600,
  });

  const calib = calibration(
    wf.predictions.map((p) => p.actual),
    wf.predictions.map((p) => p.predicted),
    8,
  );

  // Estrategia táctica derivada del modelo OOS:
  //   - Si P(rally) >= 0.5 → posición larga en bond (duración ~8) por 3 meses
  //   - Si P(rally) < 0.5 → cash (return 0)
  //   - Return de bond ≈ -duration × Δyield / 100
  //
  // INVARIANTE: cada signal usa la predicción OOS del fold que cubre ese mes.
  // No hay refit ni cherry-picking de threshold.
  const stratRet: number[] = [];
  const longRet: number[] = []; // baseline: siempre largo
  const cashRet: number[] = []; // baseline trivial: 0
  // Lookup O(1) en lugar de find() O(n) — relevante con muchos folds
  const obsByDate = new Map(trainable.map((o) => [o.date, o]));
  for (const p of wf.predictions) {
    const obs = obsByDate.get(p.date);
    if (!obs || obs.target === undefined) continue;
    const bondRet = (-obs.target * BOND_DURATION) / 100;
    const signal = p.predicted >= 0.5 ? 1 : 0;
    stratRet.push(signal * bondRet);
    longRet.push(bondRet);
    cashRet.push(0);
  }

  const stratSharpeAnn = sharpe(stratRet);
  const longSharpeAnn = sharpe(longRet);
  const stratSk = skewKurt(stratRet);
  // PSR/DSR usan Sharpe en frecuencia de observación (mensual). El divisor sqrt(12)
  // recupera la versión mensual desde la anualizada — equivalente a calcular
  // mean/sd sin reescalar.
  const stratSharpeMonthly = stratSharpeAnn / Math.sqrt(12);
  const psr = probabilisticSharpe(
    stratSharpeMonthly,
    stratRet.length,
    stratSk.skew,
    stratSk.kurt,
  );
  // Sensibilidad DSR sobre grid de N_TRIALS — para hacer transparente la dependencia
  const dsrByN = N_TRIALS_GRID.map((n) => ({
    n,
    dsr: deflatedSharpe(stratSharpeMonthly, stratRet.length, n, stratSk.skew, stratSk.kurt),
  }));

  // ============================================================
  // PANEL 3 · FEATURE IMPORTANCE (modelo fit sobre TODA la historia)
  // ============================================================
  // Este modelo es DESCRIPTIVO — para interpretar qué features han pesado más
  // en la decisión across la historia completa. Usar las predicciones OOS
  // del walk-forward para evaluación, NUNCA este modelo.
  const fullModel = trainLogistic(Xt, yt, { lambda: 0.1, lr: 0.15, iter: 1000 });
  const imp = featureImportance(fullModel);
  const impSorted = featureNames
    .map((name, i) => ({ name, importance: imp[i], weight: fullModel.weights[i] }))
    .sort((a, b) => b.importance - a.importance);
  const maxImp = Math.max(...imp);

  // Predicción actual del modelo full (probabilidad para el último estado observable)
  const lastFeat = X[X.length - 1];
  const currentProb = predictProba([lastFeat], fullModel)[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Análisis ML · regímenes y predicción condicional"
        description="K-means no-supervisado + regresión logística con walk-forward CV · pipeline auditado"
      />

      <Commentary title="Marco · qué hace este page y qué no">
        <P>
          Esta página aplica dos técnicas de machine learning sobre <Term>features</Term> macro de
          la curva chilena con dos propósitos independientes: <Term>identificar regímenes</Term>
          (clustering no-supervisado sobre features estandarizadas) y <Term>estimar probabilidad
          direccional</Term> (<Term>regresión logística</Term> con walk-forward cross-validation).
          Las dos técnicas son complementarias pero no encadenadas: clustering responde &quot;¿qué
          regímenes hay en la historia y a cuál se parece el presente?&quot;; la regresión responde
          &quot;dados los features actuales, ¿cuál es P(yield baja &gt; 25 bps en 3m)?&quot;. El
          cluster label no entra como feature de la regresión — son análisis paralelos.
        </P>
        <P>
          <Term>Lo que no hace</Term>: no entrega <Term>alpha</Term>. La literatura (Gu, Kelly &amp;
          Xiu 2020, <em>Review of Financial Studies</em>) reporta <Term>R² out-of-sample</Term>
          mensual <em>stock-level</em> de aproximadamente 0.4% para los mejores modelos ML sobre
          equity USA (Tabla 1 del paper); el R² agregado a nivel <em>portfolio-level</em> sube a
          ~1.8% bajo decile-spread long-short. Para bonos soberanos no hay un equivalente de
          consenso — Bianchi, Büchner &amp; Tamoni (2021, <em>Review of Financial Studies</em>)
          reporta gains modestos sobre bond risk premia con random forests. Quien busque una señal
          accionable con Sharpe &gt; 1.5 anualizado, reproducible y persistente en un dashboard no
          la encontrará aquí, ni en otros con metodología honesta. Lo que sí entrega esta página:
          estructurar la incertidumbre macro en categorías auditables y mostrar el grado de
          evidencia que sostiene cada predicción.
        </P>
      </Commentary>

      <Commentary title="Riesgos metodológicos del ML aplicado a series financieras">
        <P>
          López de Prado (2018, <em>Advances in Financial Machine Learning</em>) identifica los
          fallos sistemáticos del ML cuantitativo: (1) <Term>backtest overfitting</Term> — la
          probabilidad de descubrir una estrategia &quot;rentable&quot; por azar crece con el número
          de configuraciones probadas, lo que infla Sharpe observados sin edge real; (2)
          <Term> data leakage</Term> — la estandarización global o el uso de features que incluyen
          información posterior a la decisión contamina la evaluación; (3) <Term>non-stationarity</Term>
          — los regímenes macro cambian estructuralmente. En el caso chileno los quiebres documentados
          son crisis asiática 1998 (devaluación del peso, fin de banda cambiaria), adopción del
          régimen IT en 1999, recambio a TPM nominal en pesos en 2001, COVID 2020 (TPM 0.5% y QE
          local) y estallido social 2019 (impacto en prima soberana). Modelos entrenados sobre un
          régimen pierden validez al cruzar quiebres de este tipo.
        </P>
        <P>
          Este pipeline aplica tres salvaguardas. <Term>Walk-forward expansivo</Term>: cada
          predicción usa exclusivamente datos anteriores al mes evaluado. <Term>Estandarización
          por-fold</Term>: la media y desviación de los features se computan sólo sobre el set de
          entrenamiento de cada fold — nunca con información del test. <Term>Deflated Sharpe Ratio</Term>:
          el Sharpe observado se ajusta por el número de configuraciones independientes probadas,
          siguiendo López de Prado (2014). Los hyperparámetros (k=4, lambda=0.1, minTrain=36,
          step=3) están fijados a priori en el código; un tuning posterior demandaría <Term>nested
          CV</Term> para evitar leakage del test al proceso de selección (Cawley &amp; Talbot 2010,
          <em>Journal of Machine Learning Research</em>).
        </P>
      </Commentary>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <MetricTile label="Obs. mensuales" value={filteredMonthCount.toString()} />
        <MetricTile label="Features" value={featureNames.length.toString()} />
        <MetricTile label="Walk-forward folds" value={wf.folds.toString()} />
        <MetricTile label="Train ventana" value={`${wf.trainSizeMin}–${wf.trainSizeMax}m`} />
        <MetricTile
          label="Régimen últ. mes (retrospectivo)"
          value={REGIME_NAMES[currentLabel].label}
        />
      </div>

      <Commentary title="Panel 1 · Regime clustering con K-means">
        <P>
          <Term>K-means</Term> particiona la historia en {K} regímenes según similitud en el vector
          completo de features (10 dimensiones: yields UF/CLP/BEI 10Y, TPM, dos slopes, dos momenta,
          vol realizada 30d, y la señal Faber). La inicialización <Term>k-means++</Term>
          (Arthur &amp; Vassilvitskii 2007) selecciona <Term>centroides</Term> iniciales con
          probabilidad proporcional al cuadrado de la distancia al centro más cercano ya elegido;
          se ejecutan 20 inicializaciones y se retiene la de menor <Term>inertia</Term> (suma de
          distancias cuadradas dentro del cluster). La elección k={K} es exploratoria — sin elbow
          plot ni silhouette score formal — guiada por la inspección visual: k=3 colapsa regímenes
          de signo opuesto en yields, k=5 fragmenta el régimen actual en dos sub-grupos pequeños.
        </P>
        <P>
          Para cada régimen se computa la <Term>distribución condicional</Term> de la variable
          objetivo: el cambio en yield 10Y CLP a 3 meses vista. <Term>El alcance del análisis es
          retrospectivo, no predictivo</Term>: el K-means se ajusta sobre toda la historia, de modo
          que los centros incorporan información posterior a cualquier mes individual. Un sistema
          real-time honesto requeriría refittear los centros con cada mes nuevo usando sólo el
          pasado — implementación pendiente. La etiqueta del último mes ({currentMonth}) ubica el
          presente en uno de los regímenes identificados, pero esa asignación cambia si el K-means
          se re-ajusta mañana con un mes más de datos.
        </P>
      </Commentary>

      <Panel title={`Regímenes identificados · n=${X.length} observaciones`}>
        <FinTable>
          <FinThead>
            <FinTr>
              <FinTh>Régimen</FinTh>
              <FinTh align="right">Meses</FinTh>
              <FinTh align="right">% historia</FinTh>
              <FinTh align="right">Δ yield 3m promedio</FinTh>
              <FinTh align="right">σ Δ yield 3m</FinTh>
              <FinTh align="right">P(rally &gt; 25 bps)</FinTh>
              <FinTh>Estado actual</FinTh>
            </FinTr>
          </FinThead>
          <FinTbody>
            {clusters.map((c) => (
              <FinTr key={c.label}>
                <FinTd>
                  <span
                    className="pill"
                    style={{
                      borderColor: REGIME_NAMES[c.label].tone,
                      color: REGIME_NAMES[c.label].tone,
                    }}
                  >
                    {REGIME_NAMES[c.label].label}
                  </span>
                </FinTd>
                <FinTd align="right" numeric>
                  {c.n}
                </FinTd>
                <FinTd align="right" numeric>
                  {((c.n / X.length) * 100).toFixed(1)}%
                </FinTd>
                <FinTd align="right">
                  <Signed value={c.avgForwardChange * 100} colored decimals={1} />
                  <span className="ml-1 text-[10px] text-muted-foreground">bps</span>
                </FinTd>
                <FinTd align="right" numeric>
                  {(c.forwardStd * 100).toFixed(1)} bps
                </FinTd>
                <FinTd align="right">
                  <Pct value={c.winRateRally * 100} decimals={0} />
                </FinTd>
                <FinTd>
                  {c.label === currentLabel ? (
                    <span className="pill border-foreground text-foreground">← actual</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </FinTd>
              </FinTr>
            ))}
          </FinTbody>
        </FinTable>
      </Panel>

      <Panel title="Centroides · valor promedio de cada feature por régimen">
        <Heatmap
          rows={heatmapRows}
          cols={featureNames.map((n) => FEATURE_LABELS[n] ?? n)}
          cells={heatmapCells}
          format="fixed"
          decimals={2}
        />
      </Panel>

      <Commentary title="Lectura de los centroides" variant="compact">
        <P>
          El heatmap muestra el valor promedio de cada feature dentro de cada régimen, en su escala
          original (no estandarizada). Diferencias grandes entre regímenes en una columna indican
          que ese feature discrimina bien — típicamente yields y TPM son los que cargan más. Las
          dos métricas más informativas de la tabla anterior son <Term>P(rally)</Term> — la
          probabilidad histórica de que el yield baje &gt; 25 bps en 3 meses dado el régimen — y
          <Term> σ de Δ yield</Term>, que mide la dispersión condicional. Regímenes con σ alta son
          ambiguos: la información del régimen sola no acota suficientemente la distribución
          forward, y conviene complementar con la regresión del Panel 2.
        </P>
      </Commentary>

      <Commentary title="Panel 2 · Regresión logística con walk-forward CV">
        <P>
          La <Term>regresión logística</Term> con regularización L2 modela P(rally) como función
          lineal de los features en el <Term>logit</Term>: log(p/(1−p)) = w·x + b. La regularización
          L2 (lambda=0.1) penaliza coeficientes grandes y reduce la varianza del estimador —
          necesaria con n={Xt.length} observaciones y d={featureNames.length} features (razón
          obs:feat = {Math.round(Xt.length / featureNames.length)}:1,{" "}
          {Xt.length / featureNames.length < 30 ? "por debajo" : "por encima"} de la regla de oro
          empírica 30:1 para modelos sin regularización; Harrell 2015). El descenso por gradiente
          corre 600 iteraciones con <Term>learning rate</Term> 0.15. La elección de lambda no se
          cross-valida — está fijada a priori como decisión de diseño; esto se cuenta como un
          trial implícito en el DSR.
        </P>
        <P>
          La evaluación usa <Term>walk-forward expansive cross-validation</Term>: el fold k entrena
          sobre [0, t_k) y predice sobre [t_k, t_k + 3 meses), donde t_k es el primer mes del bloque
          test del fold k. La ventana inicial de entrenamiento es 36 meses; cada fold subsecuente
          añade 3 meses de train y predice los 3 meses siguientes. El total de {wf.folds} folds
          predice OOS desde el mes 37 hasta el último mes con target observable. La estandarización
          (z-score) se computa SÓLO con datos del fold de train — nunca con datos del test,
          condición necesaria para que la métrica OOS sea honesta.
        </P>
      </Commentary>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricTile
          label="In-sample log-loss"
          value={<Num value={wf.inSampleLogLoss} decimals={4} />}
        />
        <MetricTile
          label="Out-of-sample log-loss"
          value={<Num value={wf.outOfSampleLogLoss} decimals={4} />}
        />
        <MetricTile
          label="Baseline log-loss"
          value={<Num value={wf.baselineLogLoss} decimals={4} />}
          unit="trivial"
        />
        <MetricTile
          label="Gap IS–OOS"
          value={<Num value={wf.outOfSampleLogLoss - wf.inSampleLogLoss} decimals={4} />}
        />
        <MetricTile
          label="Accuracy in-sample"
          value={<Pct value={wf.inSampleAcc * 100} decimals={1} />}
        />
        <MetricTile
          label="Accuracy OOS"
          value={<Pct value={wf.outOfSampleAcc * 100} decimals={1} />}
        />
        <MetricTile
          label="Accuracy baseline"
          value={<Pct value={wf.baselineAcc * 100} decimals={1} />}
        />
        <MetricTile
          label="Base rate (y=1)"
          value={<Pct value={wf.baseRate * 100} decimals={1} />}
        />
      </div>

      <Commentary title="Cómo leer estas métricas" variant="compact">
        <P>
          <Term>Log-loss OOS vs baseline</Term> es la métrica decisiva: si OOS log-loss es menor
          que baseline, el modelo aporta información sobre la predicción trivial (siempre predecir
          la frecuencia base). Si es mayor o igual, el modelo es inútil — peor que un coin flip
          calibrado. <Term>Gap IS–OOS</Term> mide overfit: gap pequeño (&lt; 0.05) sugiere que el
          modelo generaliza; gap grande indica memorización del train sin transferencia. Accuracy
          es informativa pero engañosa cuando las clases son desbalanceadas — siempre comparar
          contra accuracy del baseline.
        </P>
      </Commentary>

      <Panel title="Calibración · probabilidad predicha vs frecuencia observada">
        <FinTable>
          <FinThead>
            <FinTr>
              <FinTh>Bin probabilidad</FinTh>
              <FinTh align="right">P predicha</FinTh>
              <FinTh align="right">Frecuencia observada</FinTh>
              <FinTh align="right">Gap</FinTh>
              <FinTh align="right">n observaciones</FinTh>
              <FinTh>Distribución</FinTh>
            </FinTr>
          </FinThead>
          <FinTbody>
            {calib.map((b) => {
              const gap = Number.isFinite(b.meanObserved) ? b.meanObserved - b.meanPredicted : NaN;
              return (
                <FinTr key={b.bin}>
                  <FinTd className="text-[10px] text-muted-foreground">
                    [{(b.binLow * 100).toFixed(0)}–{(b.binHigh * 100).toFixed(0)}%]
                  </FinTd>
                  <FinTd align="right" numeric>
                    {(b.meanPredicted * 100).toFixed(1)}%
                  </FinTd>
                  <FinTd align="right" numeric>
                    {Number.isFinite(b.meanObserved)
                      ? `${(b.meanObserved * 100).toFixed(1)}%`
                      : "—"}
                  </FinTd>
                  <FinTd align="right">
                    {Number.isFinite(gap) ? (
                      <span
                        className={
                          Math.abs(gap) < 0.1
                            ? "num text-[var(--color-pos)]"
                            : Math.abs(gap) < 0.2
                              ? "num text-[var(--color-warn)]"
                              : "num text-[var(--color-neg)]"
                        }
                      >
                        {gap > 0 ? "+" : ""}
                        {(gap * 100).toFixed(1)}pp
                      </span>
                    ) : (
                      "—"
                    )}
                  </FinTd>
                  <FinTd align="right" numeric>
                    {b.count}
                  </FinTd>
                  <FinTd>
                    <div className="w-24">
                      <BarGauge
                        value={b.count}
                        max={Math.max(...calib.map((c) => c.count))}
                        color="#4493f8"
                        height={4}
                      />
                    </div>
                  </FinTd>
                </FinTr>
              );
            })}
          </FinTbody>
        </FinTable>
      </Panel>

      <Commentary title="Estrategia derivada del modelo · Sharpe deflactado">
        <P>
          La estrategia táctica deriva mecánicamente del modelo: largo en bono 10Y CLP (
          <Term>duración</Term> ≈ {BOND_DURATION}) si P(rally) ≥ 0.5, cash en caso contrario,
          mantenido por 3 meses. El threshold 0.5 es la decisión Bayes-óptima sólo si las clases
          están balanceadas y los costos de error son simétricos; con base rate
          {" "}{(wf.baseRate * 100).toFixed(0)}% conviene revisar la tabla de calibración para
          evaluar si 0.5 está bien posicionado o sesga la señal. Los retornos se calculan
          multiplicando la señal binaria por el retorno forward del bono (≈ −duración × Δy). El
          Sharpe anualizado se compara con un baseline siempre-largo (sin filtro).
        </P>
        <P>
          El <Term>Probabilistic Sharpe Ratio</Term> (Bailey &amp; López de Prado 2012, ec. 7) ajusta
          el Sharpe observado por tamaño de muestra, <Term>skewness</Term> y <Term>kurtosis</Term>,
          devolviendo P(verdadero Sharpe &gt; 0). El <Term>Deflated Sharpe Ratio</Term> añade ajuste
          por el número de configuraciones independientes probadas durante el desarrollo (López de
          Prado 2014). DSR ≥ 0.95 corresponde a rechazar la hipótesis nula (verdadero SR ≤ SR*
          esperado bajo multi-testing) con confianza 1−α=95% — la convención estadística estándar,
          no un threshold particular del DSR. La tabla abajo reporta DSR para distintos N de trials
          asumidos porque el N real es opaco (dependería de un log de hyperparams probados durante
          desarrollo); con muchas más configuraciones experimentales, el mismo Sharpe observado
          colapsa a evidencia más débil.
        </P>
      </Commentary>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricTile
          label="Sharpe estrategia (anualizado)"
          value={<Num value={stratSharpeAnn} decimals={2} />}
        />
        <MetricTile
          label="Sharpe baseline largo"
          value={<Num value={longSharpeAnn} decimals={2} />}
        />
        <MetricTile
          label="PSR (P[SR>0])"
          value={<Pct value={psr * 100} decimals={1} />}
        />
        <MetricTile
          label="N obs (meses OOS)"
          value={stratRet.length.toString()}
        />
      </div>

      <Panel title="Sensibilidad DSR · cuántas configuraciones probadas asumimos">
        <FinTable>
          <FinThead>
            <FinTr>
              <FinTh>N trials asumidos</FinTh>
              <FinTh>Interpretación</FinTh>
              <FinTh align="right">DSR</FinTh>
              <FinTh>Veredicto vs α=0.05</FinTh>
            </FinTr>
          </FinThead>
          <FinTbody>
            {dsrByN.map((row) => (
              <FinTr key={row.n}>
                <FinTd numeric>{row.n}</FinTd>
                <FinTd className="text-[10px] text-muted-foreground">
                  {row.n === 1
                    ? "Equivale a PSR (sin ajuste multi-testing)"
                    : row.n <= 10
                      ? "Pocos hyperparams probados durante desarrollo"
                      : row.n <= 50
                        ? "Grid moderado (k × lambda × threshold)"
                        : "Búsqueda intensiva (incluye selección de features)"}
                </FinTd>
                <FinTd align="right">
                  <Pct value={row.dsr * 100} decimals={1} />
                </FinTd>
                <FinTd>
                  <span
                    className={
                      "pill " +
                      (row.dsr >= 0.95
                        ? "border-[var(--color-pos)] text-[var(--color-pos)]"
                        : row.dsr >= 0.5
                          ? "border-[var(--color-warn)] text-[var(--color-warn)]"
                          : "border-[var(--color-neg)] text-[var(--color-neg)]")
                    }
                  >
                    {row.dsr >= 0.95
                      ? "rechaza H0"
                      : row.dsr >= 0.5
                        ? "evidencia débil"
                        : "no rechaza H0"}
                  </span>
                </FinTd>
              </FinTr>
            ))}
          </FinTbody>
        </FinTable>
      </Panel>

      <Commentary title="Panel 3 · Feature importance del modelo full">
        <P>
          Para interpretar qué variables han pesado más en la decisión, se entrena un modelo
          logístico sobre toda la historia disponible con target observable (Xt, yt). Este modelo
          NO se usa para evaluación — esa función la cumple sólo el walk-forward del Panel 2. La
          magnitud del peso en el espacio estandarizado aproxima la <Term>feature importance</Term>
          marginal en el logit. Para modelos no-lineales (random forest, gradient boosting) el
          análogo es <Term>permutation importance</Term> (Breiman 2001) o valores SHAP — no
          implementados aquí, donde el modelo es lineal y los pesos son interpretables directamente.
          El signo del peso indica dirección: positivo significa que valores altos del feature
          aumentan P(rally); negativo significa que la bajan.
        </P>
        <P>
          La <Term>predicción real-time</Term> para el último mes observable es{" "}
          <Term>P(rally) = {(currentProb * 100).toFixed(1)}%</Term>. Esta probabilidad usa los
          features observables al cierre del mes {currentMonth} y los pesos del modelo entrenado
          con todos los meses con target observable — esto es lo que un analista que decide hoy
          podría producir sin contaminación con el futuro. No es una predicción de qué pasará: es
          la mejor estimación condicional dada la información disponible al día de hoy.
        </P>
      </Commentary>

      <Panel title="Importancia y signo de cada feature">
        <div className="space-y-1.5">
          {impSorted.map((f) => (
            <div key={f.name} className="grid grid-cols-[140px_1fr_80px_80px] items-center gap-2">
              <div className="text-xs font-medium">{FEATURE_LABELS[f.name] ?? f.name}</div>
              <BarGauge
                value={f.importance}
                max={maxImp}
                color={f.weight >= 0 ? "#3fb950" : "#f85149"}
                height={5}
              />
              <div className="num text-right text-xs">
                {f.weight >= 0 ? "+" : ""}
                {f.weight.toFixed(3)}
              </div>
              <div className="text-right text-[10px] text-muted-foreground">
                {f.weight >= 0 ? "↑P(rally)" : "↓P(rally)"}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Commentary title="Limitaciones declaradas">
        <P>
          La hipótesis fundamental — que los regímenes pasados son informativos sobre el futuro —
          falla cuando hay <Term>cambios estructurales</Term>. El Banco Central de Chile adoptó
          régimen de Inflation Targeting pleno en septiembre de 1999 (al abandonar la banda
          cambiaria); la TPM se redenominó en pesos nominales en 2001. El sample BCCh disponible
          comienza en 2004, ya consolidado el régimen IT. No hay análogos pre-IT en estos datos.
          Cualquier shock estructural futuro (cambio de mandato del Banco Central, dolarización
          parcial, default soberano, abandono de la UF) invalida la inferencia condicional. El
          walk-forward CV mitiga overfit dentro del régimen IT actual;{" "}
          <Term>no mitiga riesgo de cambio estructural de régimen</Term>.
        </P>
        <P>Otras limitaciones específicas del pipeline:</P>
        <ul className="commentary-prose ml-4 list-disc space-y-1.5 text-[13.5px] leading-[1.7] text-foreground/90">
          <li>
            <Term>Warm-up</Term>: {rawMonthCount - filteredMonthCount} meses iniciales se descartan
            por features rolling incompletos (momentum 12m exige al menos 12 meses de historia),
            reduciendo la muestra efectiva.
          </li>
          <li>
            <Term>Threshold arbitrario</Term>: la elección de 25 bps para definir el target binario
            es decisión de diseño. Una sensibilidad sobre {`{10, 25, 50, 75}`} bps revelaría
            robustez; no implementada en esta versión.
          </li>
          <li>
            <Term>Linealidad en logit</Term>: la regresión logística asume relación lineal entre
            features y logit, descartando efectos de interacción y no-linealidades. Random forest
            o gradient boosting podrían capturarlas, pero con n≈{Xt.length} observaciones y d=
            {featureNames.length} features los modelos de mayor capacidad sobreajustan.
          </li>
          <li>
            <Term>Costos ignorados</Term>: la estrategia táctica derivada no descuenta costos de
            transacción ni bid-ask. Para bonos soberanos chilenos con turnover trimestral, el
            impacto estimado es 30–50 bps anualizados sobre el Sharpe — orden de magnitud, no
            cifra calibrada.
          </li>
          <li>
            <Term>K-means descriptivo</Term>: los centros del clustering se ajustan sobre toda la
            historia. Las estadísticas condicionales (P(rally) por régimen) son válidas
            retrospectivamente pero no extrapolables a real-time sin refittear los centros con
            sólo el pasado.
          </li>
          <li>
            <Term>Hyperparams no validados</Term>: lambda=0.1, lr=0.15, iter=600 están fijos a
            priori. Un tuning posterior demandaría nested CV (Cawley &amp; Talbot 2010) para evitar
            que la selección del hyperparam filtre el test set.
          </li>
        </ul>
      </Commentary>
    </div>
  );
}
