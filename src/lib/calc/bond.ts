/**
 * Cálculos de bonos: precio, YTM, duración, convexidad, sensibilidad.
 * Convención: yields y cupones en decimal (5% = 0.05).
 */

export type BondTerms = {
  face: number;             // valor nominal (típicamente 100)
  couponRate: number;       // tasa cupón anual decimal
  couponsPerYear: number;   // 2 = semestral, 1 = anual
  yearsToMaturity: number;  // años fraccionarios desde hoy
};

export function bondPrice(t: BondTerms, ytm: number): number {
  const n = Math.max(1, Math.round(t.yearsToMaturity * t.couponsPerYear));
  const c = (t.couponRate * t.face) / t.couponsPerYear;
  const y = ytm / t.couponsPerYear;
  let pv = 0;
  for (let i = 1; i <= n; i++) pv += c / Math.pow(1 + y, i);
  pv += t.face / Math.pow(1 + y, n);
  return pv;
}

export function bondYTM(t: BondTerms, price: number, guess = 0.05): number {
  let y = guess;
  for (let i = 0; i < 80; i++) {
    const p = bondPrice(t, y);
    const dp = (bondPrice(t, y + 1e-6) - p) / 1e-6;
    if (Math.abs(dp) < 1e-12) break;
    const ny = y - (p - price) / dp;
    if (!Number.isFinite(ny)) break;
    if (Math.abs(ny - y) < 1e-10) {
      y = ny;
      break;
    }
    y = Math.max(-0.5, Math.min(1, ny));
  }
  return y;
}

export function macaulayDuration(t: BondTerms, ytm: number): number {
  const n = Math.max(1, Math.round(t.yearsToMaturity * t.couponsPerYear));
  const c = (t.couponRate * t.face) / t.couponsPerYear;
  const y = ytm / t.couponsPerYear;
  let pvWeighted = 0;
  let pv = 0;
  for (let i = 1; i <= n; i++) {
    const cf = c + (i === n ? t.face : 0);
    const disc = cf / Math.pow(1 + y, i);
    pv += disc;
    pvWeighted += (i / t.couponsPerYear) * disc;
  }
  return pv === 0 ? 0 : pvWeighted / pv;
}

export function modifiedDuration(t: BondTerms, ytm: number): number {
  return macaulayDuration(t, ytm) / (1 + ytm / t.couponsPerYear);
}

export function convexity(t: BondTerms, ytm: number): number {
  const n = Math.max(1, Math.round(t.yearsToMaturity * t.couponsPerYear));
  const c = (t.couponRate * t.face) / t.couponsPerYear;
  const y = ytm / t.couponsPerYear;
  let conv = 0;
  let pv = 0;
  for (let i = 1; i <= n; i++) {
    const cf = c + (i === n ? t.face : 0);
    const disc = cf / Math.pow(1 + y, i);
    pv += disc;
    conv += (i * (i + 1) * disc) / Math.pow(1 + y, 2);
  }
  if (pv === 0) return 0;
  return conv / (pv * Math.pow(t.couponsPerYear, 2));
}

export function dv01(t: BondTerms, ytm: number): number {
  return bondPrice(t, ytm) - bondPrice(t, ytm + 0.0001);
}

export function totalReturnEstimate(
  t: BondTerms,
  ytm: number,
  bpsShock: number,
  horizonYears = 1,
): { priceReturn: number; couponIncome: number; total: number } {
  const modDur = modifiedDuration(t, ytm);
  const conv = convexity(t, ytm);
  const dy = bpsShock / 10000;
  const priceReturn = -modDur * dy + 0.5 * conv * dy * dy;
  const couponIncome = t.couponRate * horizonYears;
  return {
    priceReturn,
    couponIncome,
    total: priceReturn + couponIncome,
  };
}

// ETF duration ratios (aproximados)
export const ETF_DURATIONS = {
  TLT: 17,
  EDV: 24,
  ZROZ: 26,
  VGLT: 16,
  IEF: 7.5,
  TLH: 12.5,
  IEI: 4.5,
  SHY: 1.9,
  GOVT: 6.5,
  AGG: 6.0,
} as const;
