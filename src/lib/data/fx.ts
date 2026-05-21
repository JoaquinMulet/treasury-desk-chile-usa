/**
 * Loader de tipos de cambio · client-safe.
 *
 * USD/CLP y UF se obtienen de BCCh (data/bcch/_catalog.json vía bcch-client.ts).
 * Fallbacks razonables si el catálogo no responde (no debería ocurrir si el
 * cron diario está sano).
 *
 * Esta función reemplaza las copias hardcoded de `const FX = {...}` que
 * existían inline en /portfolio, /reports y /stress hasta la auditoría de
 * mayo 2026.
 */

import { lastValueClient } from "./bcch-client";

export type Currency = "CLP" | "UF" | "USD";
export type FXRates = Record<Currency, number>;

// Fallbacks usados sólo si el catálogo BCCh no responde
// (estaba hardcoded antes — mantenido aquí como último recurso defensivo).
const FALLBACK_UF = 40763;
const FALLBACK_USD = 906.68;

/** Tipos de cambio vivos · multiplicador a CLP por unidad de moneda. */
export function getFx(): FXRates {
  const uf = lastValueClient("uf")?.value ?? FALLBACK_UF;
  const usd = lastValueClient("usdclp")?.value ?? FALLBACK_USD;
  return { CLP: 1, UF: uf, USD: usd };
}

/** Fecha más reciente entre USD/CLP y UF · null si ningún catálogo respondió */
export function getFxAsOf(): string | null {
  const uf = lastValueClient("uf");
  const usd = lastValueClient("usdclp");
  if (!uf && !usd) return null;
  if (!uf) return usd!.date;
  if (!usd) return uf.date;
  return uf.date > usd.date ? uf.date : usd.date;
}

/** Indica si los valores devueltos vienen de fallback (catálogo BCCh ausente) */
export function isFxStale(): boolean {
  return !lastValueClient("uf") || !lastValueClient("usdclp");
}
