/**
 * Snapshot de mercado USA · client-safe (sin node:fs).
 *
 * YIELDS (us_5y/10y/30y) vienen del snapshot JSON generado por
 * `scripts/fred_fetch.py`, que el cron de GitHub Actions actualiza
 * cada día hábil a las 23:00 UTC (post-cierre USA y CL).
 *
 * ETFs (TLT, EDV, VGLT, ZROZ), MOVE y DXY no están en FRED — siguen
 * hardcoded como fallback. TODO: añadir scraper Stooq/Yahoo para
 * cerrar ese gap. Hasta entonces, esos valores reflejan el último
 * pull manual del 15-may-2026.
 *
 * Import del JSON es estático (resolveJsonModule en tsconfig) y
 * client-safe; este archivo se puede importar desde "use client"
 * components sin problema (watchlist, ticker-bar, etc.).
 */

import { TimePoint } from "./types";
import snapshot from "../../../data/fred/_snapshot.json";

// ---------- Tipado explícito del snapshot ----------
type FredSnapshot = {
  as_of: string;
  source: string;
  yields: {
    us_5y: number | null;
    us_10y: number;
    us_30y: number | null;
  };
  changes_bps: {
    us_5y: { day: number | null; week: number | null; month: number | null } | null;
    us_10y: { day: number | null; week: number | null; month: number | null };
    us_30y: { day: number | null; week: number | null; month: number | null } | null;
  };
  history: {
    labels: string[];
    us_5y: (number | null)[];
    us_10y: number[];
    us_30y: (number | null)[];
  };
};

const snap = snapshot as FredSnapshot;

// Forward-fill simple: si un valor es null, usar el último válido anterior.
// Necesario porque DGS5 y DGS30 pueden tener gaps relativos al calendario de DGS10.
function forwardFill(arr: (number | null)[], fallback: number): number[] {
  const out: number[] = new Array(arr.length);
  let last = fallback;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null && Number.isFinite(arr[i] as number)) {
      last = arr[i] as number;
    }
    out[i] = last;
  }
  return out;
}

// ---------- US_SNAPSHOT (spot values) ----------
export const US_SNAPSHOT = {
  asOf: snap.as_of,
  source: snap.source,
  yields: {
    us_5y: snap.yields.us_5y ?? 0,
    us_10y: snap.yields.us_10y,
    us_30y: snap.yields.us_30y ?? 0,
  },
  // TODO: migrar a fuente live (Stooq CSV o Yahoo Finance via API route)
  etfs: {
    tlt: 83.66,
    edv: 61.47,
    vglt: 53.58,
    zroz: 60.24,
  },
  vol: {
    move: 79.87,
  },
  fx: {
    dxy: 99.27,
  },
} as const;

// ---------- US_CHANGES (delta diario / semanal) ----------
const c5 = snap.changes_bps.us_5y;
const c10 = snap.changes_bps.us_10y;
const c30 = snap.changes_bps.us_30y;

export const US_CHANGES = {
  us_5y: { day: c5?.day ?? 0, week: c5?.week ?? 0 }, // bps
  us_10y: { day: c10.day ?? 0, week: c10.week ?? 0 }, // bps
  us_30y: { day: c30?.day ?? 0, week: c30?.week ?? 0 }, // bps
  // TODO: derivar de fuente live al migrar ETF/MOVE/DXY
  tlt: { day: -1.48, week: -2.22 }, // %
  edv: { day: -2.15, week: -3.20 }, // %
  move: { day: 14.71, week: 12.91 }, // %
  dxy: { day: 0.40, week: 1.36 }, // %
} as const;

// ---------- US_HISTORY (series semanales, 28 puntos · ~6 meses) ----------
export const US_HISTORY_LABELS = snap.history.labels;

const us10Hist = snap.history.us_10y;
const us5Hist = forwardFill(snap.history.us_5y, us10Hist[0] - 0.4);
const us30Hist = forwardFill(snap.history.us_30y, us10Hist[0] + 0.4);

// ETFs/MOVE: serie hardcoded de 28 puntos del mismo período (nov-2025 → may-2026)
// alineadas aproximadamente con las fechas de FRED. TODO: migrar a fuente live.
const FALLBACK_HIST = {
  move: [67.2, 78.9, 82.6, 76.8, 69.9, 75.4, 67.1, 61.2, 64.0, 66.9, 56.1, 56.2, 59.2, 63.6, 70.1, 68.0, 73.2, 79.7, 85.2, 98.2, 108.3, 83.2, 74.3, 70.8, 68.7, 76.8, 71.7, 79.87],
  tlt: [87.76, 87.58, 87.13, 88.03, 87.17, 86.34, 86.25, 86.21, 85.88, 86.07, 87.01, 86.64, 85.85, 86.58, 88.74, 88.76, 88.93, 88.55, 86.54, 85.73, 86.12, 86.32, 86.89, 86.25, 86.05, 85.43, 84.99, 83.66],
  edv: [67.12, 66.86, 66.18, 67.03, 66.01, 65.14, 64.78, 64.76, 64.25, 64.33, 65.59, 65.17, 64.09, 64.79, 67.25, 67.21, 67.42, 67.09, 64.69, 64.01, 64.37, 64.53, 65.00, 64.31, 64.11, 63.42, 62.87, 61.47],
};

// Si el snapshot tiene N labels, recortamos los fallback a la misma longitud
// (toma los N últimos) para mantener la alineación cardinal de los arrays.
function trimToLength(arr: number[], n: number): number[] {
  return arr.length >= n ? arr.slice(-n) : [...new Array(n - arr.length).fill(arr[0] ?? 0), ...arr];
}

const N = US_HISTORY_LABELS.length;

export const US_HISTORY = {
  us_5y: us5Hist,
  us_10y: us10Hist,
  us_30y: us30Hist,
  move: trimToLength(FALLBACK_HIST.move, N),
  tlt: trimToLength(FALLBACK_HIST.tlt, N),
  edv: trimToLength(FALLBACK_HIST.edv, N),
};

export function usHistoryToTimePoints(key: keyof typeof US_HISTORY): TimePoint[] {
  return US_HISTORY[key].map((value, i) => ({
    time: US_HISTORY_LABELS[i],
    value,
  }));
}
