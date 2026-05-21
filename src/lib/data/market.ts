/**
 * Snapshot de mercado USA · client-safe (sin node:fs).
 *
 * Datos vivos auto-actualizados por el cron diario de GitHub Actions
 * (23:00 UTC, lunes a viernes). Dos fuentes:
 *
 *   FRED (data/fred/_snapshot.json)
 *     - Yields nominal: 1M, 3M, 6M, 1Y, 2Y, 5Y, 7Y, 10Y, 20Y, 30Y
 *     - TIPS real:      5Y, 10Y, 20Y, 30Y
 *     - BEI USA:        5Y, 10Y
 *     - Spreads:        T10Y2Y, T10Y3M
 *     - Policy rates:   Fed Funds (DFF), SOFR
 *     - Backtest:       120 meses de DGS10 para /backtest
 *
 *   Yahoo Finance (data/yf/_snapshot.json)
 *     - ETFs long-duration: TLT, EDV, VGLT, ZROZ
 *     - ETFs intermediate:  TLH, IEF, IEI
 *     - ETFs short/cash:    SHY, SGOV
 *     - Volatility & FX:    MOVE, DXY
 *
 * Los JSON imports son estáticos (resolveJsonModule en tsconfig) y
 * client-safe; este archivo se puede importar desde componentes
 * "use client" sin restricciones.
 */

import { TimePoint } from "./types";
import fredSnap from "../../../data/fred/_snapshot.json";
import yfSnap from "../../../data/yf/_snapshot.json";

// ============================================================
// Tipos del snapshot FRED
// ============================================================
type NominalKey =
  | "us_1mo" | "us_3mo" | "us_6mo" | "us_1y" | "us_2y"
  | "us_5y" | "us_7y" | "us_10y" | "us_20y" | "us_30y";
type TipsKey = "us_5y" | "us_10y" | "us_20y" | "us_30y";
type BeiKey = "us_5y" | "us_10y";
type SpreadKey = "t10y2y" | "t10y3m";
type PolicyKey = "fed_funds" | "sofr";

type ChangesBlock = { day: number | null; week: number | null; month: number | null };

type FredSnapshot = {
  as_of: string;
  source: string;
  yields: {
    nominal: Record<NominalKey, number | null>;
    tips: Record<TipsKey, number | null>;
    bei: Record<BeiKey, number | null>;
  };
  spreads: Record<SpreadKey, number | null>;
  policy: Record<PolicyKey, number | null>;
  changes_bps: {
    nominal: Record<NominalKey, ChangesBlock | null>;
    tips: Record<TipsKey, ChangesBlock | null>;
    bei: Record<BeiKey, ChangesBlock | null>;
    spreads: Record<SpreadKey, ChangesBlock | null>;
    policy: Record<PolicyKey, ChangesBlock | null>;
  };
  history: {
    labels: string[];
    nominal: Record<NominalKey, (number | null)[]>;
    tips: Record<TipsKey, (number | null)[]>;
    bei: Record<BeiKey, (number | null)[]>;
    spreads: Record<SpreadKey, (number | null)[]>;
  };
  backtest: {
    dgs10_monthly: { date: string; value: number }[];
  };
};

// ============================================================
// Tipos del snapshot Yahoo Finance
// ============================================================
type YFTicker =
  | "tlt" | "edv" | "vglt" | "zroz"
  | "tlh" | "ief" | "iei" | "shy" | "sgov"
  | "move" | "dxy";

type YFSnapshot = {
  as_of: string;
  source: string;
  prices: Record<YFTicker, number | null>;
  changes_pct: Record<YFTicker, ChangesBlock | null>;
  history: {
    labels: string[];
  } & Record<YFTicker, (number | null)[]>;
};

const fred = fredSnap as FredSnapshot;
const yf = yfSnap as YFSnapshot;

// ============================================================
// Helpers
// ============================================================
/** Forward-fill: si un valor es null, usa el último válido anterior. */
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

function pctOrZero(b: ChangesBlock | null | undefined): { day: number; week: number } {
  if (!b) return { day: 0, week: 0 };
  return { day: b.day ?? 0, week: b.week ?? 0 };
}

function bpsOrZero(b: ChangesBlock | null | undefined): { day: number; week: number } {
  if (!b) return { day: 0, week: 0 };
  return { day: b.day ?? 0, week: b.week ?? 0 };
}

// ============================================================
// US_SNAPSHOT (spot values · cero hardcoded)
// ============================================================
export const US_SNAPSHOT = {
  asOf: fred.as_of,
  asOfYF: yf.as_of,
  source: { yields: fred.source, prices: yf.source },

  // Yields nominal por plazo · estructura plana para retrocompat con consumidores
  // que ya usaban us_5y / us_10y / us_30y, más nuevos tenores.
  yields: {
    us_1mo: fred.yields.nominal.us_1mo ?? 0,
    us_3mo: fred.yields.nominal.us_3mo ?? 0,
    us_6mo: fred.yields.nominal.us_6mo ?? 0,
    us_1y: fred.yields.nominal.us_1y ?? 0,
    us_2y: fred.yields.nominal.us_2y ?? 0,
    us_5y: fred.yields.nominal.us_5y ?? 0,
    us_7y: fred.yields.nominal.us_7y ?? 0,
    us_10y: fred.yields.nominal.us_10y ?? 0,
    us_20y: fred.yields.nominal.us_20y ?? 0,
    us_30y: fred.yields.nominal.us_30y ?? 0,
  },

  // TIPS real yields
  tips: {
    us_5y: fred.yields.tips.us_5y ?? 0,
    us_10y: fred.yields.tips.us_10y ?? 0,
    us_20y: fred.yields.tips.us_20y ?? 0,
    us_30y: fred.yields.tips.us_30y ?? 0,
  },

  // Breakeven inflation USA (FRED-computed = nominal − TIPS)
  bei: {
    us_5y: fred.yields.bei.us_5y ?? 0,
    us_10y: fred.yields.bei.us_10y ?? 0,
  },

  // Spreads pre-computados por FRED
  spreads: {
    t10y2y: fred.spreads.t10y2y ?? 0,
    t10y3m: fred.spreads.t10y3m ?? 0,
  },

  // Policy rates
  policy: {
    fedFunds: fred.policy.fed_funds ?? 0,
    sofr: fred.policy.sofr ?? 0,
  },

  // ETFs universe completo (9 tickers · long-dur a cash)
  etfs: {
    tlt: yf.prices.tlt ?? 0,
    edv: yf.prices.edv ?? 0,
    vglt: yf.prices.vglt ?? 0,
    zroz: yf.prices.zroz ?? 0,
    tlh: yf.prices.tlh ?? 0,
    ief: yf.prices.ief ?? 0,
    iei: yf.prices.iei ?? 0,
    shy: yf.prices.shy ?? 0,
    sgov: yf.prices.sgov ?? 0,
  },

  vol: { move: yf.prices.move ?? 0 },
  fx: { dxy: yf.prices.dxy ?? 0 },
} as const;

// ============================================================
// US_CHANGES (delta 1d / 1w por instrumento)
// Yields/spreads en bps · ETFs/MOVE/DXY en %
// ============================================================
export const US_CHANGES = {
  // Yields nominal (bps)
  us_5y: bpsOrZero(fred.changes_bps.nominal.us_5y),
  us_10y: bpsOrZero(fred.changes_bps.nominal.us_10y),
  us_30y: bpsOrZero(fred.changes_bps.nominal.us_30y),
  us_2y: bpsOrZero(fred.changes_bps.nominal.us_2y),

  // Spreads (bps)
  t10y2y: bpsOrZero(fred.changes_bps.spreads.t10y2y),
  t10y3m: bpsOrZero(fred.changes_bps.spreads.t10y3m),

  // Policy (bps)
  fedFunds: bpsOrZero(fred.changes_bps.policy.fed_funds),

  // ETFs y otros (%)
  tlt: pctOrZero(yf.changes_pct.tlt),
  edv: pctOrZero(yf.changes_pct.edv),
  vglt: pctOrZero(yf.changes_pct.vglt),
  zroz: pctOrZero(yf.changes_pct.zroz),
  tlh: pctOrZero(yf.changes_pct.tlh),
  ief: pctOrZero(yf.changes_pct.ief),
  iei: pctOrZero(yf.changes_pct.iei),
  shy: pctOrZero(yf.changes_pct.shy),
  sgov: pctOrZero(yf.changes_pct.sgov),
  move: pctOrZero(yf.changes_pct.move),
  dxy: pctOrZero(yf.changes_pct.dxy),
} as const;

// ============================================================
// US_HISTORY (series semanales · alineadas al calendario FRED)
// ============================================================
export const US_HISTORY_LABELS = fred.history.labels;

const us10Hist = forwardFill(fred.history.nominal.us_10y, US_SNAPSHOT.yields.us_10y);
const fillbackFromUS10 = us10Hist[0];

export const US_HISTORY = {
  // Yields nominal
  us_2y: forwardFill(fred.history.nominal.us_2y, US_SNAPSHOT.yields.us_2y || fillbackFromUS10 - 1),
  us_5y: forwardFill(fred.history.nominal.us_5y, US_SNAPSHOT.yields.us_5y || fillbackFromUS10 - 0.4),
  us_10y: us10Hist,
  us_30y: forwardFill(fred.history.nominal.us_30y, US_SNAPSHOT.yields.us_30y || fillbackFromUS10 + 0.4),

  // TIPS real yields
  tips_10y: forwardFill(fred.history.tips.us_10y, US_SNAPSHOT.tips.us_10y),

  // BEI USA
  bei_10y: forwardFill(fred.history.bei.us_10y, US_SNAPSHOT.bei.us_10y),

  // Spreads
  t10y2y: forwardFill(fred.history.spreads.t10y2y, US_SNAPSHOT.spreads.t10y2y),
  t10y3m: forwardFill(fred.history.spreads.t10y3m, US_SNAPSHOT.spreads.t10y3m),

  // ETFs · todos los 9 tickers
  tlt: forwardFill(yf.history.tlt, US_SNAPSHOT.etfs.tlt),
  edv: forwardFill(yf.history.edv, US_SNAPSHOT.etfs.edv),
  vglt: forwardFill(yf.history.vglt, US_SNAPSHOT.etfs.vglt),
  zroz: forwardFill(yf.history.zroz, US_SNAPSHOT.etfs.zroz),
  tlh: forwardFill(yf.history.tlh, US_SNAPSHOT.etfs.tlh),
  ief: forwardFill(yf.history.ief, US_SNAPSHOT.etfs.ief),
  iei: forwardFill(yf.history.iei, US_SNAPSHOT.etfs.iei),
  shy: forwardFill(yf.history.shy, US_SNAPSHOT.etfs.shy),
  sgov: forwardFill(yf.history.sgov, US_SNAPSHOT.etfs.sgov),

  // Volatility & FX
  move: forwardFill(yf.history.move, US_SNAPSHOT.vol.move),
  dxy: forwardFill(yf.history.dxy, US_SNAPSHOT.fx.dxy),
};

export function usHistoryToTimePoints(key: keyof typeof US_HISTORY): TimePoint[] {
  return US_HISTORY[key].map((value, i) => ({
    time: US_HISTORY_LABELS[i],
    value,
  }));
}

// ============================================================
// US_BACKTEST · monthly DGS10 (120 meses) para /backtest
// ============================================================
export const US_BACKTEST_DGS10_MONTHLY: TimePoint[] = fred.backtest.dgs10_monthly.map((p) => ({
  time: p.date,
  value: p.value,
}));

// ============================================================
// Helpers para construir curva completa USA (10 plazos)
// ============================================================
export function usCurvePoints(): { tenor: number; label: string; yield: number }[] {
  return [
    { tenor: 1 / 12, label: "1M", yield: US_SNAPSHOT.yields.us_1mo },
    { tenor: 3 / 12, label: "3M", yield: US_SNAPSHOT.yields.us_3mo },
    { tenor: 6 / 12, label: "6M", yield: US_SNAPSHOT.yields.us_6mo },
    { tenor: 1, label: "1Y", yield: US_SNAPSHOT.yields.us_1y },
    { tenor: 2, label: "2Y", yield: US_SNAPSHOT.yields.us_2y },
    { tenor: 5, label: "5Y", yield: US_SNAPSHOT.yields.us_5y },
    { tenor: 7, label: "7Y", yield: US_SNAPSHOT.yields.us_7y },
    { tenor: 10, label: "10Y", yield: US_SNAPSHOT.yields.us_10y },
    { tenor: 20, label: "20Y", yield: US_SNAPSHOT.yields.us_20y },
    { tenor: 30, label: "30Y", yield: US_SNAPSHOT.yields.us_30y },
  ].filter((p) => p.yield > 0);
}

export function usTipsCurvePoints(): { tenor: number; label: string; yield: number }[] {
  return [
    { tenor: 5, label: "5Y TIPS", yield: US_SNAPSHOT.tips.us_5y },
    { tenor: 10, label: "10Y TIPS", yield: US_SNAPSHOT.tips.us_10y },
    { tenor: 20, label: "20Y TIPS", yield: US_SNAPSHOT.tips.us_20y },
    { tenor: 30, label: "30Y TIPS", yield: US_SNAPSHOT.tips.us_30y },
  ].filter((p) => p.yield > 0);
}
