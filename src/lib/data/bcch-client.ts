/**
 * Last values BCCh — client-safe.
 * Importa estáticamente el catálogo JSON generado por bcch_fetch.py
 * y expone funciones de lookup sin acceso a filesystem.
 */
import catalog from "../../../data/bcch/_catalog.json";
import { BCCH_SERIES, BCChKey } from "./bcch-meta";

type CatalogEntry = {
  id: string;
  name: string;
  rows: number;
  first: string;
  last: string;
  last_value: number;
  file: string;
};

const byCode: Map<string, CatalogEntry> = new Map(
  (catalog as CatalogEntry[]).map((c) => [c.id, c]),
);

export function lastValueClient(key: BCChKey): { value: number; date: string } | null {
  const entry = byCode.get(BCCH_SERIES[key].code);
  return entry ? { value: entry.last_value, date: entry.last } : null;
}

export { BCCH_SERIES };
export type { BCChKey };
