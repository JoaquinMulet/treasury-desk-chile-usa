/**
 * Cálculo tributario corporativo Chile.
 * Régimen general 14 A (semi-integrado, 27% 1ra Categoría con 65% crédito IGC).
 * Régimen Pro Pyme 14 D (25% con 100% crédito IGC).
 */

export type TaxRegime = "14A" | "14D";

export type InstrumentTax = {
  type: "DPF_CLP" | "DPF_USD" | "BTU" | "BTP" | "FM_MM" | "FM_RF" | "ETF_USA" | "BOND_USA";
  notional: number;       // CLP equivalente
  expectedReturn: number; // % anual bruto
  horizonYears: number;
  realizedFx?: number;    // ganancia/pérdida cambiaria si aplica
};

export function corporateTax(regime: TaxRegime): number {
  return regime === "14A" ? 0.27 : 0.25;
}

export function afterTaxReturn(
  inst: InstrumentTax,
  regime: TaxRegime,
): { grossReturn: number; taxOwed: number; netReturn: number; netYield: number } {
  const tax = corporateTax(regime);
  const grossReturn = inst.notional * inst.expectedReturn * inst.horizonYears;
  // Para todos los tipos: 1ra Categoría aplica sobre rentas devengadas
  let taxableBase = grossReturn;
  // ETF USA / BOND USA: incluye reconocimiento de ganancia cambiaria realizada (Art. 41)
  if (inst.type === "ETF_USA" || inst.type === "BOND_USA") {
    taxableBase += inst.realizedFx ?? 0;
  }
  const taxOwed = taxableBase * tax;
  const netReturn = grossReturn - taxOwed;
  return {
    grossReturn,
    taxOwed,
    netReturn,
    netYield: inst.notional > 0 ? netReturn / inst.notional / inst.horizonYears : 0,
  };
}

export const TAX_NOTES: Record<InstrumentTax["type"], string> = {
  DPF_CLP: "Intereses tributan al 27% (1ra Categoría) sobre devengo anual.",
  DPF_USD: "Intereses 27% + reconocimiento de ganancia cambiaria al rescate (Art. 41 LIR).",
  BTU:
    "Cupón devengado tributa anual al 27%. Reajuste UF (inflación) también devenga e ingresa a la base.",
  BTP: "Cupón devengado anual al 27%. Sin reajuste — todo es renta gravable.",
  FM_MM: "Distribuciones tributan al 27% sobre devengo. FM no tienen presencia bursátil.",
  FM_RF:
    "Igual que FM_MM. Sin beneficio Art. 107 para personas jurídicas con activos ordinarios.",
  ETF_USA:
    "Ganancia de capital reconocida al vender, valorizada en CLP (Art. 41 LIR). Riesgo cambiario contable cada cierre. Crédito por impuestos retenidos en el exterior.",
  BOND_USA:
    "Cupón devengado anual al 27%. Reconocimiento de ganancia cambiaria. Posible crédito por retención en origen (tratado Chile-USA reduce a 0% sobre intereses gov).",
};
