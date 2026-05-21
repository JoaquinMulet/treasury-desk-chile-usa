/**
 * Metadata FRED (Federal Reserve Economic Data) — client-safe (sin node:fs).
 * Análogo a bcch-meta.ts. Puede importarse desde componentes client.
 *
 * Fuente: Federal Reserve Bank of St. Louis · https://fred.stlouisfed.org/
 * API key gratuito · sin rate limits prácticos · datos diarios T+1.
 */

export const FRED_SERIES = {
  // ============================================================
  // TREASURY NOMINAL (Constant Maturity Yield)
  // ============================================================
  dgs1mo: { code: "DGS1MO", name: "Treasury 1M", tenorYears: 0.083, group: "nominal" },
  dgs3mo: { code: "DGS3MO", name: "Treasury 3M", tenorYears: 0.25, group: "nominal" },
  dgs6mo: { code: "DGS6MO", name: "Treasury 6M", tenorYears: 0.5, group: "nominal" },
  dgs1: { code: "DGS1", name: "Treasury 1Y", tenorYears: 1, group: "nominal" },
  dgs2: { code: "DGS2", name: "Treasury 2Y", tenorYears: 2, group: "nominal" },
  dgs5: { code: "DGS5", name: "Treasury 5Y", tenorYears: 5, group: "nominal" },
  dgs7: { code: "DGS7", name: "Treasury 7Y", tenorYears: 7, group: "nominal" },
  dgs10: { code: "DGS10", name: "Treasury 10Y", tenorYears: 10, group: "nominal" },
  dgs20: { code: "DGS20", name: "Treasury 20Y", tenorYears: 20, group: "nominal" },
  dgs30: { code: "DGS30", name: "Treasury 30Y", tenorYears: 30, group: "nominal" },

  // ============================================================
  // TIPS REAL YIELDS (Inflation-Indexed Constant Maturity)
  // ============================================================
  dfii5: { code: "DFII5", name: "TIPS 5Y real", tenorYears: 5, group: "real" },
  dfii10: { code: "DFII10", name: "TIPS 10Y real", tenorYears: 10, group: "real" },
  dfii20: { code: "DFII20", name: "TIPS 20Y real", tenorYears: 20, group: "real" },
  dfii30: { code: "DFII30", name: "TIPS 30Y real", tenorYears: 30, group: "real" },

  // ============================================================
  // BREAKEVEN INFLATION (FRED-calculated: nominal − TIPS)
  // ============================================================
  t5yie: { code: "T5YIE", name: "Breakeven 5Y", tenorYears: 5, group: "bei" },
  t10yie: { code: "T10YIE", name: "Breakeven 10Y", tenorYears: 10, group: "bei" },

  // ============================================================
  // POLICY RATES
  // ============================================================
  dff: { code: "DFF", name: "Fed Funds (effective)", tenorYears: 0, group: "policy" },
  sofr: { code: "SOFR", name: "SOFR overnight", tenorYears: 0, group: "policy" },

  // ============================================================
  // SPREADS PRE-COMPUTADOS POR FRED
  // ============================================================
  t10y2y: { code: "T10Y2Y", name: "Spread 10Y−2Y", tenorYears: 0, group: "spread" },
  t10y3m: { code: "T10Y3M", name: "Spread 10Y−3M", tenorYears: 0, group: "spread" },
} as const;

export type FREDKey = keyof typeof FRED_SERIES;

export type FREDGroup = "nominal" | "real" | "bei" | "policy" | "spread";

/** Lista de series por grupo, para construir curvas o paneles temáticos */
export function fredKeysByGroup(group: FREDGroup): FREDKey[] {
  return (Object.keys(FRED_SERIES) as FREDKey[]).filter(
    (k) => FRED_SERIES[k].group === group,
  );
}
