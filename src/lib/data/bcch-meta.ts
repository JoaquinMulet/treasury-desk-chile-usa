/**
 * Metadata BCCh — client-safe (sin node:fs).
 * Puede ser importado desde componentes client.
 */

export const BCCH_SERIES = {
  uf_1y: { code: "F022.BUF.TIS.AN01.UF.Z.D", name: "Yield UF 1Y", tenorYears: 1 },
  uf_2y: { code: "F022.BUF.TIS.AN02.UF.Z.D", name: "Yield UF 2Y", tenorYears: 2 },
  uf_5y: { code: "F022.BUF.TIS.AN05.UF.Z.D", name: "Yield UF 5Y", tenorYears: 5 },
  uf_10y: { code: "F022.BUF.TIS.AN10.UF.Z.D", name: "Yield UF 10Y", tenorYears: 10 },
  uf_20y: { code: "F022.BUF.TIS.AN20.UF.Z.D", name: "Yield UF 20Y", tenorYears: 20 },
  uf_30y: { code: "F022.BUF.TIS.AN30.UF.Z.D", name: "Yield UF 30Y", tenorYears: 30 },
  clp_1y: { code: "F022.BCLP.TIS.AN01.NO.Z.D", name: "Yield CLP 1Y", tenorYears: 1 },
  clp_2y: { code: "F022.BCLP.TIS.AN02.NO.Z.D", name: "Yield CLP 2Y", tenorYears: 2 },
  clp_5y: { code: "F022.BCLP.TIS.AN05.NO.Z.D", name: "Yield CLP 5Y", tenorYears: 5 },
  clp_10y: { code: "F022.BCLP.TIS.AN10.NO.Z.D", name: "Yield CLP 10Y", tenorYears: 10 },
  bei_1y: { code: "F022.SWSP.TAS.AN01.Z.Z.D", name: "Breakeven 1Y", tenorYears: 1 },
  bei_2y: { code: "F022.SWSP.TAS.AN02.Z.Z.D", name: "Breakeven 2Y", tenorYears: 2 },
  bei_5y: { code: "F022.SWSP.TAS.AN05.Z.Z.D", name: "Breakeven 5Y", tenorYears: 5 },
  bei_10y: { code: "F022.SWSP.TAS.AN10.Z.Z.D", name: "Breakeven 10Y", tenorYears: 10 },
  tpm: { code: "F022.TPM.TIN.D001.NO.Z.D", name: "TPM", tenorYears: 0 },
  usdclp: { code: "F073.TCO.PRE.Z.D", name: "USD/CLP", tenorYears: 0 },
  uf: { code: "F073.UFF.PRE.Z.D", name: "UF", tenorYears: 0 },
} as const;

export type BCChKey = keyof typeof BCCH_SERIES;
