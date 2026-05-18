/**
 * Lectura de series FRED desde CSVs locales — SERVER ONLY.
 * Análogo a bcch.ts. CSVs en data/fred/{series_id}.csv.
 *
 * Las series se actualizan ejecutando scripts/fred_fetch.py
 * (requiere FRED_API_KEY en .env).
 */
import fs from "node:fs";
import path from "node:path";
import { TimePoint } from "./types";
import { FRED_SERIES, FREDKey } from "./fred-meta";

export { FRED_SERIES };
export type { FREDKey };

const DATA_DIR = path.join(process.cwd(), "data", "fred");

function parseCsv(csv: string): TimePoint[] {
  const lines = csv.trim().split(/\r?\n/);
  const out: TimePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const [date, value] = line.split(",");
    // FRED usa "." para valores faltantes — se filtran
    if (!value || value === ".") continue;
    const v = parseFloat(value);
    if (Number.isFinite(v)) {
      out.push({ time: date, value: v });
    }
  }
  return out;
}

const cache = new Map<string, TimePoint[]>();

export function loadFredSeries(key: FREDKey): TimePoint[] {
  if (cache.has(key)) return cache.get(key)!;
  const meta = FRED_SERIES[key];
  const file = path.join(DATA_DIR, `${meta.code}.csv`);
  if (!fs.existsSync(file)) {
    console.warn(`[fred] Missing ${file} — run scripts/fred_fetch.py`);
    return [];
  }
  const data = parseCsv(fs.readFileSync(file, "utf-8"));
  cache.set(key, data);
  return data;
}

export function lastFredValue(key: FREDKey): { value: number; date: string } | null {
  const series = loadFredSeries(key);
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  return { value: last.value, date: last.time };
}

/** Z-score sobre los últimos `windowDays` valores diarios de la serie */
export function fredRollingZScore(series: TimePoint[], windowDays = 252 * 5): number {
  if (series.length < windowDays) return 0;
  const recent = series.slice(-windowDays);
  const last = recent[recent.length - 1].value;
  const mean = recent.reduce((s, p) => s + p.value, 0) / recent.length;
  const variance =
    recent.reduce((s, p) => s + (p.value - mean) ** 2, 0) / (recent.length - 1);
  const sd = Math.sqrt(variance);
  return sd === 0 ? 0 : (last - mean) / sd;
}

/** Percentil rank del último valor sobre los últimos `windowDays` */
export function fredPercentileRank(series: TimePoint[], windowDays = 252 * 5): number {
  if (series.length < 10) return 0;
  const recent = series.slice(-windowDays);
  const last = recent[recent.length - 1].value;
  const below = recent.filter((p) => p.value <= last).length;
  return (below / recent.length) * 100;
}

/**
 * Cambio absoluto en bps entre el último valor y `lagDays` atrás.
 * Útil para diff 1d / 1w / 1m / 1y de yields.
 */
export function fredYieldChange(series: TimePoint[], lagDays: number): number {
  if (series.length < lagDays + 1) return 0;
  const last = series[series.length - 1].value;
  const prev = series[series.length - 1 - lagDays].value;
  return (last - prev) * 100; // pp → bps
}
