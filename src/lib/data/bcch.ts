/**
 * Lectura de series del Banco Central de Chile — SERVER ONLY.
 * Lee CSVs en data/bcch/{series_id}.csv. No usar desde componentes client.
 * Para client, usar bcch-client.ts (lookups sobre _catalog.json estático).
 */
import fs from "node:fs";
import path from "node:path";
import { TimePoint } from "./types";
import { BCCH_SERIES, BCChKey } from "./bcch-meta";

export { BCCH_SERIES };
export type { BCChKey };

const DATA_DIR = path.join(process.cwd(), "data", "bcch");

function parseCsv(csv: string): TimePoint[] {
  const lines = csv.trim().split(/\r?\n/);
  // skip header
  const out: TimePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const [date, value] = line.split(",");
    const v = parseFloat(value);
    if (Number.isFinite(v)) {
      out.push({ time: date, value: v });
    }
  }
  return out;
}

const cache = new Map<string, TimePoint[]>();

export function loadSeries(key: BCChKey): TimePoint[] {
  if (cache.has(key)) return cache.get(key)!;
  const meta = BCCH_SERIES[key];
  const file = path.join(DATA_DIR, `${meta.code}.csv`);
  if (!fs.existsSync(file)) {
    console.warn(`[bcch] Missing ${file}`);
    return [];
  }
  const data = parseCsv(fs.readFileSync(file, "utf-8"));
  cache.set(key, data);
  return data;
}

export function lastValue(key: BCChKey): { value: number; date: string } | null {
  const series = loadSeries(key);
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  return { value: last.value, date: last.time };
}

export function rollingZScore(series: TimePoint[], windowDays = 252 * 5): number {
  if (series.length < windowDays) return 0;
  const recent = series.slice(-windowDays);
  const last = recent[recent.length - 1].value;
  const mean = recent.reduce((s, p) => s + p.value, 0) / recent.length;
  const variance =
    recent.reduce((s, p) => s + (p.value - mean) ** 2, 0) / recent.length;
  const sd = Math.sqrt(variance);
  return sd === 0 ? 0 : (last - mean) / sd;
}

export function percentileRank(series: TimePoint[], windowDays = 252 * 5): number {
  if (series.length < 10) return 0;
  const recent = series.slice(-windowDays);
  const last = recent[recent.length - 1].value;
  const below = recent.filter((p) => p.value <= last).length;
  return (below / recent.length) * 100;
}
