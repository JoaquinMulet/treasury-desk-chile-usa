/**
 * Tipos compartidos para series temporales y datos de mercado.
 */

export type TimePoint = {
  time: string; // YYYY-MM-DD
  value: number;
};

export type SeriesMeta = {
  id: string;
  name: string;
  source: "BCCh" | "FRED" | "Yahoo" | "CMF";
  unit: string;
  frequency: "daily" | "monthly" | "quarterly" | "annual";
  lastValue: number | null;
  lastDate: string | null;
  rows: number;
};

export type CurvePoint = {
  tenor: string; // "1Y" | "2Y" | "5Y" | "10Y" | "20Y" | "30Y"
  tenorYears: number;
  yield: number;
};

export type Snapshot = {
  asOf: string; // ISO date
  chileUF: CurvePoint[];
  chileCLP: CurvePoint[];
  usaTreasury: CurvePoint[];
  breakevenChile: CurvePoint[];
  policyRates: {
    tpm: number | null;
    fedFunds: number | null;
  };
  fx: {
    usdclp: number | null;
    uf: number | null;
    dxy: number | null;
  };
  longDuration: {
    tlt: number | null;
    edv: number | null;
    move: number | null;
  };
};
