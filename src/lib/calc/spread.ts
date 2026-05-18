import { TimePoint } from "@/lib/data/types";

export function computeSpread(a: TimePoint[], b: TimePoint[]): TimePoint[] {
  const map = new Map(b.map((p) => [p.time, p.value]));
  const out: TimePoint[] = [];
  for (const p of a) {
    const bv = map.get(p.time);
    if (bv != null) out.push({ time: p.time, value: p.value - bv });
  }
  return out;
}

export function percentileBand(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
  return sorted[idx];
}

export function spreadStats(spread: TimePoint[]) {
  if (spread.length === 0) {
    return { mean: 0, median: 0, sd: 0, p5: 0, p25: 0, p75: 0, p95: 0, last: 0, percentile: 0 };
  }
  const vals = spread.map((p) => p.value);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  const last = vals[vals.length - 1];
  const below = vals.filter((v) => v <= last).length;
  return {
    mean,
    median: percentileBand(vals, 50),
    sd,
    p5: percentileBand(vals, 5),
    p25: percentileBand(vals, 25),
    p75: percentileBand(vals, 75),
    p95: percentileBand(vals, 95),
    last,
    percentile: (below / vals.length) * 100,
  };
}
