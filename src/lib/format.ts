/**
 * Formateo financial-grade.
 * Convenciones Wall Street: minus unicode '−' (U+2212), thin-space para miles,
 * tabular numbers, decimales según el tipo de métrica.
 */

const MINUS = "−";

export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return v < 0 ? `${MINUS}${abs}` : abs;
}

export function fmtPct(v: number | null | undefined, decimals = 2, signed = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toFixed(decimals);
  if (v < 0) return `${MINUS}${abs}%`;
  return signed ? `+${abs}%` : `${abs}%`;
}

export function fmtBps(v: number | null | undefined, signed = true): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toFixed(0);
  if (v < 0) return `${MINUS}${abs} bps`;
  return signed ? `+${abs} bps` : `${abs} bps`;
}

export function fmtYield(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(decimals)}%`;
}

export function fmtPrice(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** CLP con separador local, sin decimales por default */
export function fmtCLP(v: number | null | undefined, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toLocaleString("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return v < 0 ? `${MINUS}${abs}` : abs;
}

/** Compact: 1.2K, 3.4M, 5.6B */
export function fmtCompact(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1e12) s = (abs / 1e12).toFixed(decimals) + "T";
  else if (abs >= 1e9) s = (abs / 1e9).toFixed(decimals) + "B";
  else if (abs >= 1e6) s = (abs / 1e6).toFixed(decimals) + "M";
  else if (abs >= 1e3) s = (abs / 1e3).toFixed(decimals) + "K";
  else s = abs.toFixed(decimals);
  return v < 0 ? `${MINUS}${s}` : s;
}

export function fmtSigned(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toFixed(decimals);
  return v < 0 ? `${MINUS}${abs}` : v > 0 ? `+${abs}` : abs;
}

export function signClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "num-neutral";
  if (v > 0) return "num-pos";
  if (v < 0) return "num-neg";
  return "num-neutral";
}

export function inverseSignClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "num-neutral";
  if (v > 0) return "num-neg";
  if (v < 0) return "num-pos";
  return "num-neutral";
}

export function fmtDate(date: string | null | undefined, fmt: "short" | "iso" | "monthYear" = "short"): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  if (fmt === "iso") return d.toISOString().slice(0, 10);
  if (fmt === "monthYear") {
    return d.toLocaleString("es-CL", { month: "short", year: "numeric" });
  }
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" });
}
