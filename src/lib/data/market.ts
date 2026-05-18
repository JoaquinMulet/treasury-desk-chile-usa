/**
 * Snapshot de mercado USA · client-safe (sin node:fs).
 *
 * Datos vivos auto-actualizados por el cron diario de GitHub Actions
 * (23:00 UTC, lunes a viernes). Dos fuentes:
 *
 *   YIELDS (us_5y/10y/30y · history + changes en bps)
 *     ← Federal Reserve Economic Data (FRED)
 *     ← data/fred/_snapshot.json
 *
 *   ETFs (TLT, EDV, VGLT, ZROZ) + MOVE + DXY (prices + history + changes en %)
 *     ← Yahoo Finance via yfinance
 *     ← data/yf/_snapshot.json
 *
 * History (28 weekly samples) alineada entre ambas fuentes usando las
 * labels del snapshot FRED como calendario de referencia.
 *
 * Los JSON imports son estáticos (resolveJsonModule en tsconfig) y
 * client-safe; este archivo se puede importar desde componentes
 * "use client" sin restricciones.
 */

import { TimePoint } from "./types";
import fredSnap from "../../../data/fred/_snapshot.json";
import yfSnap from "../../../data/yf/_snapshot.json";

// ---------- Tipado explícito de los snapshots ----------
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

type YFSnapshot = {
  as_of: string;
  source: string;
  prices: {
    tlt: number | null;
    edv: number | null;
    vglt: number | null;
    zroz: number | null;
    move: number | null;
    dxy: number | null;
  };
  changes_pct: Record<
    string,
    { day: number | null; week: number | null; month: number | null } | null
  >;
  history: {
    labels: string[];
    tlt: (number | null)[];
    edv: (number | null)[];
    vglt: (number | null)[];
    zroz: (number | null)[];
    move: (number | null)[];
    dxy: (number | null)[];
  };
};

const fred = fredSnap as FredSnapshot;
const yf = yfSnap as YFSnapshot;

// Forward-fill: si un valor es null, usa el último válido anterior.
// Necesario porque series de yields/ETFs/indices pueden tener gaps
// distintos relativos al calendario FRED de referencia.
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
  asOf: fred.as_of,
  asOfYF: yf.as_of,
  source: { yields: fred.source, prices: yf.source },
  yields: {
    us_5y: fred.yields.us_5y ?? 0,
    us_10y: fred.yields.us_10y,
    us_30y: fred.yields.us_30y ?? 0,
  },
  etfs: {
    tlt: yf.prices.tlt ?? 0,
    edv: yf.prices.edv ?? 0,
    vglt: yf.prices.vglt ?? 0,
    zroz: yf.prices.zroz ?? 0,
  },
  vol: {
    move: yf.prices.move ?? 0,
  },
  fx: {
    dxy: yf.prices.dxy ?? 0,
  },
} as const;

// ---------- US_CHANGES (delta diario / semanal) ----------
// Yields en bps · ETFs/MOVE/DXY en %
const c5 = fred.changes_bps.us_5y;
const c10 = fred.changes_bps.us_10y;
const c30 = fred.changes_bps.us_30y;
const yc = yf.changes_pct;

function pctOrZero(
  obj: { day: number | null; week: number | null; month: number | null } | null | undefined,
): { day: number; week: number } {
  if (!obj) return { day: 0, week: 0 };
  return { day: obj.day ?? 0, week: obj.week ?? 0 };
}

export const US_CHANGES = {
  us_5y: { day: c5?.day ?? 0, week: c5?.week ?? 0 }, // bps
  us_10y: { day: c10.day ?? 0, week: c10.week ?? 0 }, // bps
  us_30y: { day: c30?.day ?? 0, week: c30?.week ?? 0 }, // bps
  tlt: pctOrZero(yc.tlt), // %
  edv: pctOrZero(yc.edv), // %
  move: pctOrZero(yc.move), // %
  dxy: pctOrZero(yc.dxy), // %
} as const;

// ---------- US_HISTORY (series semanales · alineadas al calendario FRED) ----------
export const US_HISTORY_LABELS = fred.history.labels;

const us10Hist = fred.history.us_10y;
const us5Hist = forwardFill(fred.history.us_5y, us10Hist[0] - 0.4);
const us30Hist = forwardFill(fred.history.us_30y, us10Hist[0] + 0.4);

export const US_HISTORY = {
  us_5y: us5Hist,
  us_10y: us10Hist,
  us_30y: us30Hist,
  move: forwardFill(yf.history.move, yf.prices.move ?? 70),
  tlt: forwardFill(yf.history.tlt, yf.prices.tlt ?? 85),
  edv: forwardFill(yf.history.edv, yf.prices.edv ?? 65),
};

export function usHistoryToTimePoints(key: keyof typeof US_HISTORY): TimePoint[] {
  return US_HISTORY[key].map((value, i) => ({
    time: US_HISTORY_LABELS[i],
    value,
  }));
}
