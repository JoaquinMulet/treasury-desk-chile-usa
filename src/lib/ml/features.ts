/**
 * Feature engineering pipeline · SERVER ONLY
 *
 * Construye observaciones mensuales con features y target forward, alineadas
 * sobre el rango común de todas las series BCCh utilizadas.
 *
 * INVARIANTES CRÍTICAS DE NO-LEAKAGE (verificadas por auditor de pipeline):
 *
 * 1. Cada feature en observation[t] usa SÓLO datos observables hasta el cierre
 *    del mes t (inclusive). No se usan datos de meses t+1 o posteriores.
 *
 * 2. El target `forward3mYieldChange` en observation[t] usa los precios de
 *    cierre de los meses t+1, t+2, t+3 — datos que NO existen como input
 *    para ningún feature de observation[t]. Esta es la separación
 *    feature-target que evita look-ahead.
 *
 * 3. Las últimas 3 observaciones tienen `target = undefined` porque no hay
 *    forward observable. Esas filas deben filtrarse antes de entrenar.
 *
 * 4. La estandarización (z-score) NO se hace aquí. Se hace por-fold dentro
 *    de walk-forward.ts usando exclusivamente datos de training, para evitar
 *    leakage del test set en los estadísticos de normalización.
 *
 * 5. Las features incluyen agregados temporales (momentum 3m/12m, SMA 10m,
 *    realized vol 30d). Todos esos agregados se computan con ventana hacia
 *    atrás (rolling backward). Los primeros meses con ventana insuficiente
 *    se marcan NaN y se filtran.
 */

import { loadSeries } from "@/lib/data/bcch";
import { TimePoint } from "@/lib/data/types";

export type MonthlyObservation = {
  date: string; // YYYY-MM
  features: number[]; // raw values, NOT standardized
  target?: number; // forward 3m yield change of clp_10y in percentage points
  targetBinary?: number; // 1 si yield baja > 25 bps en próximos 3m (bond rally), 0 sino
};

export const FEATURE_NAMES = [
  "uf_10y",
  "clp_10y",
  "bei_10y",
  "tpm",
  "slope_2s10s",
  "bei_slope_5s10s",
  "mom_3m",
  "mom_12m",
  "vol_30d",
  "above_sma10",
] as const;

export const FEATURE_LABELS: Record<string, string> = {
  uf_10y: "UF 10Y",
  clp_10y: "CLP 10Y",
  bei_10y: "BEI 10Y",
  tpm: "TPM",
  slope_2s10s: "Slope 2s10s CLP",
  bei_slope_5s10s: "Slope BEI 5s10s",
  mom_3m: "Momentum 3m",
  mom_12m: "Momentum 12m",
  vol_30d: "Vol 30d daily",
  above_sma10: "Above SMA10m (Faber)",
};

const RALLY_THRESHOLD_PP = 0.25; // 25 bps drop = bond rally

/** Convierte serie diaria a mapa YYYY-MM → último valor disponible del mes */
function dailyToMonthly(points: TimePoint[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  // Ordena ascendente para que el último write (último día) sea el end-of-month
  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  for (const p of sorted) {
    const ym = p.time.slice(0, 7);
    byMonth.set(ym, p.value);
  }
  return byMonth;
}

/**
 * Calcula desvío estándar de los últimos `window` valores diarios cuyo cierre
 * sea ≤ el último día del mes objetivo. Devuelve un mapa YYYY-MM → std.
 *
 * IMPORTANTE: usa SÓLO datos hasta el último día del mes (incluido). No mira
 * al futuro.
 */
function monthlyVolatility(points: TimePoint[], window: number): Map<string, number> {
  const result = new Map<string, number>();
  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time));
  // Índice del último día por mes
  const lastIdxByMonth = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    lastIdxByMonth.set(sorted[i].time.slice(0, 7), i);
  }
  for (const [ym, lastIdx] of lastIdxByMonth) {
    if (lastIdx < window - 1) {
      result.set(ym, NaN);
      continue;
    }
    const slice = sorted.slice(lastIdx - window + 1, lastIdx + 1);
    const mean = slice.reduce((s, p) => s + p.value, 0) / slice.length;
    // Estimador insesgado (Bessel): divisor n-1, no n. Diferencia material con window=30.
    const variance =
      slice.reduce((s, p) => s + (p.value - mean) ** 2, 0) / (slice.length - 1);
    result.set(ym, Math.sqrt(variance));
  }
  return result;
}

/**
 * Construye dataset mensual. Filtra observaciones con features NaN.
 * Devuelve observaciones ordenadas cronológicamente.
 */
export function buildMonthlyDataset(): {
  observations: MonthlyObservation[];
  featureNames: readonly string[];
  rawMonthCount: number;
  filteredMonthCount: number;
} {
  // Carga series como mapas YYYY-MM → valor de cierre del mes
  const uf10 = dailyToMonthly(loadSeries("uf_10y"));
  const clp10 = dailyToMonthly(loadSeries("clp_10y"));
  const clp2 = dailyToMonthly(loadSeries("clp_2y"));
  const bei10 = dailyToMonthly(loadSeries("bei_10y"));
  const bei5 = dailyToMonthly(loadSeries("bei_5y"));
  const tpm = dailyToMonthly(loadSeries("tpm"));

  // Realized vol del clp_10y diario, ventana 30 días, alineada a cierre del mes
  const vol30 = monthlyVolatility(loadSeries("clp_10y"), 30);

  // Meses comunes a todas las series (intersección)
  const seriesMaps = [uf10, clp10, clp2, bei10, bei5, tpm];
  const commonMonths = new Set<string>();
  for (const m of seriesMaps[0].keys()) {
    if (seriesMaps.every((s) => s.has(m))) commonMonths.add(m);
  }
  const months = Array.from(commonMonths).sort();

  // Arrays alineadas para cálculo de momentum
  const clp10Arr = months.map((m) => clp10.get(m)!);

  const obs: MonthlyObservation[] = [];
  for (let i = 0; i < months.length; i++) {
    const m = months[i];

    // Momentum: requiere historia
    const mom3 = i >= 3 ? clp10Arr[i] - clp10Arr[i - 3] : NaN;
    const mom12 = i >= 12 ? clp10Arr[i] - clp10Arr[i - 12] : NaN;

    // SMA 10m (Faber): promedio de los últimos 10 meses
    let aboveSma10: number = NaN;
    if (i >= 9) {
      let sum = 0;
      for (let k = i - 9; k <= i; k++) sum += clp10Arr[k];
      const sma = sum / 10;
      aboveSma10 = clp10Arr[i] > sma ? 1 : 0;
    }

    const features = [
      uf10.get(m)!,
      clp10.get(m)!,
      bei10.get(m)!,
      tpm.get(m)!,
      clp10.get(m)! - clp2.get(m)!, // 2s10s
      bei10.get(m)! - bei5.get(m)!, // BEI 5s10s slope
      mom3,
      mom12,
      vol30.get(m) ?? NaN,
      aboveSma10,
    ];

    // Target: forward 3m yield change de clp_10y
    // IMPORTANTE: forward usa SÓLO meses futuros. No contamina features de t.
    let target: number | undefined;
    let targetBinary: number | undefined;
    if (i + 3 < months.length) {
      target = clp10Arr[i + 3] - clp10Arr[i];
      // y=1 si yield baja más de 25 bps (= bond rally por convexidad/duración)
      targetBinary = target < -RALLY_THRESHOLD_PP ? 1 : 0;
    }

    obs.push({ date: m, features, target, targetBinary });
  }

  // Filtra observaciones con NaN en features (típicamente los primeros 12 meses)
  const filtered = obs.filter((o) => o.features.every((f) => Number.isFinite(f)));

  return {
    observations: filtered,
    featureNames: FEATURE_NAMES,
    rawMonthCount: months.length,
    filteredMonthCount: filtered.length,
  };
}
