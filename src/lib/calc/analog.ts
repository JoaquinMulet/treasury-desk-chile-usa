/**
 * Análogo histórico: encuentra los N períodos más similares al vector actual
 * de features macroeconómicas, y reporta retornos forward de bonos largos.
 */

import { TimePoint } from "@/lib/data/types";

export type Feature = {
  key: string;
  series: TimePoint[]; // mensual ya alineado
  currentValue: number;
};

export function buildMonthlyFromDaily(daily: TimePoint[]): TimePoint[] {
  const byMonth = new Map<string, TimePoint>();
  for (const p of daily) {
    const ym = p.time.slice(0, 7);
    byMonth.set(ym, { time: ym + "-01", value: p.value });
  }
  return Array.from(byMonth.values()).sort((a, b) => a.time.localeCompare(b.time));
}

export function zScore(values: number[], v: number): number {
  if (values.length < 5) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  return sd === 0 ? 0 : (v - mean) / sd;
}

export type AnalogMatch = {
  date: string;
  distance: number;
  features: Record<string, number>;
  forwardReturns?: { m12: number; m24: number; m36: number };
};

export function findAnalogs(
  features: Feature[],
  topN = 15,
  excludeRecentMonths = 36,
): AnalogMatch[] {
  if (features.length === 0) return [];
  // Alinear todas las series por mes
  const allDates = new Set<string>();
  features.forEach((f) => f.series.forEach((p) => allDates.add(p.time)));
  const sortedDates = Array.from(allDates).sort();

  const aligned: Record<string, Record<string, number>> = {};
  for (const f of features) {
    const byDate = new Map(f.series.map((p) => [p.time, p.value]));
    for (const d of sortedDates) {
      aligned[d] = aligned[d] || {};
      const v = byDate.get(d);
      if (v != null) aligned[d][f.key] = v;
    }
  }

  // Calcular z-score por feature usando todo el histórico
  const stats: Record<string, { mean: number; sd: number }> = {};
  for (const f of features) {
    const vals = f.series.map((p) => p.value);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(
      vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length,
    );
    stats[f.key] = { mean, sd: sd === 0 ? 1 : sd };
  }

  // Vector actual normalizado
  const zNow: Record<string, number> = {};
  for (const f of features) {
    zNow[f.key] = (f.currentValue - stats[f.key].mean) / stats[f.key].sd;
  }

  const cutoffIdx = sortedDates.length - excludeRecentMonths;
  const candidates: AnalogMatch[] = [];
  for (let i = 0; i < cutoffIdx; i++) {
    const d = sortedDates[i];
    const row = aligned[d];
    if (!row) continue;
    let dist = 0;
    let valid = true;
    for (const f of features) {
      if (row[f.key] == null) {
        valid = false;
        break;
      }
      const z = (row[f.key] - stats[f.key].mean) / stats[f.key].sd;
      dist += (z - zNow[f.key]) ** 2;
    }
    if (!valid) continue;
    candidates.push({
      date: d,
      distance: Math.sqrt(dist),
      features: { ...row },
    });
  }

  return candidates.sort((a, b) => a.distance - b.distance).slice(0, topN);
}
