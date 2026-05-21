/**
 * Métricas auxiliares · calibración, Sharpe, Probabilistic Sharpe Ratio.
 *
 * Referencias:
 * - Bailey & López de Prado (2012), "The Sharpe Ratio Efficient Frontier"
 * - López de Prado (2014), "Deflated Sharpe Ratio"
 */

export type CalibrationBin = {
  bin: number;
  binLow: number;
  binHigh: number;
  meanPredicted: number;
  meanObserved: number;
  count: number;
};

/**
 * Calibración por binning de probabilidades predichas vs frecuencia observada.
 * Un modelo bien calibrado tiene meanObserved ≈ meanPredicted en cada bin.
 *
 * IMPORTANTE: las predicciones y actuales deben ser OUT-OF-SAMPLE — calibrar
 * sobre train es trivialmente perfecto y no informativo.
 */
export function calibration(
  actual: number[],
  predicted: number[],
  bins: number = 10,
): CalibrationBin[] {
  if (actual.length !== predicted.length) {
    throw new Error("calibration: length mismatch");
  }
  const result: CalibrationBin[] = [];
  for (let b = 0; b < bins; b++) {
    const lo = b / bins;
    const hi = (b + 1) / bins;
    const idx: number[] = [];
    for (let i = 0; i < predicted.length; i++) {
      const p = predicted[i];
      // Último bin incluye borde superior
      const inBin = b === bins - 1 ? p >= lo && p <= hi : p >= lo && p < hi;
      if (inBin) idx.push(i);
    }
    if (idx.length === 0) {
      result.push({
        bin: b,
        binLow: lo,
        binHigh: hi,
        meanPredicted: (lo + hi) / 2,
        meanObserved: NaN,
        count: 0,
      });
      continue;
    }
    let sumP = 0;
    let sumA = 0;
    for (const i of idx) {
      sumP += predicted[i];
      sumA += actual[i];
    }
    result.push({
      bin: b,
      binLow: lo,
      binHigh: hi,
      meanPredicted: sumP / idx.length,
      meanObserved: sumA / idx.length,
      count: idx.length,
    });
  }
  return result;
}

/** Sharpe anualizado dado retornos mensuales (en proporción, no en %) */
export function sharpe(returns: number[], rfMonthly: number = 0): number {
  if (returns.length < 2) return 0;
  const excess = returns.map((r) => r - rfMonthly);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const variance = excess.reduce((s, x) => s + (x - mean) ** 2, 0) / (excess.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (mean / sd) * Math.sqrt(12);
}

export function skewKurt(x: number[]): { skew: number; kurt: number } {
  const n = x.length;
  if (n < 4) return { skew: 0, kurt: 3 };
  const mean = x.reduce((a, b) => a + b, 0) / n;
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const v of x) {
    const d = v - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
    m4 += d2 * d2;
  }
  m2 /= n;
  m3 /= n;
  m4 /= n;
  if (m2 === 0) return { skew: 0, kurt: 3 };
  return { skew: m3 / Math.pow(m2, 1.5), kurt: m4 / (m2 * m2) };
}

/** Aproximación de la CDF normal estándar usando erf de Abramowitz-Stegun */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return NaN;
  // erf approximation (Abramowitz & Stegun 7.1.26)
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Probabilistic Sharpe Ratio (Bailey & López de Prado 2012, ec. 7).
 *
 * PSR = Φ((SR - SR*) · sqrt(n-1) / sqrt(1 - skew·SR + ((kurt-1)/4)·SR²))
 *
 * con SR* = 0 (Sharpe nulo como benchmark).
 *
 * Devuelve P(verdadero Sharpe > 0 | datos observados). Ajusta el Sharpe
 * observado por:
 *   - n: cantidad de observaciones (más datos → menor varianza del estimador)
 *   - skew: skewness no-normal penaliza Sharpe
 *   - kurt: kurtosis alta penaliza Sharpe (fat tails)
 *
 * El input `observedSR` debe estar en la MISMA frecuencia que las observaciones
 * (e.g. Sharpe mensual con n mensual). NO usar Sharpe anualizado con n mensual.
 */
export function probabilisticSharpe(
  observedSR: number,
  nObservations: number,
  skewness: number = 0,
  kurtosis: number = 3,
): number {
  if (nObservations < 2) return NaN;
  const denom = Math.sqrt(
    1 - skewness * observedSR + ((kurtosis - 1) / 4) * observedSR * observedSR,
  );
  if (denom === 0 || !Number.isFinite(denom)) return NaN;
  const z = (observedSR * Math.sqrt(nObservations - 1)) / denom;
  return normalCdf(z);
}

/**
 * Deflated Sharpe Ratio (López de Prado 2014, ec. 8).
 *
 * Ajusta PSR por el número N de configuraciones independientes probadas.
 *
 * DSR = PSR(SR_observed, n, skew, kurt; SR* = E[max SR_i])
 *
 * donde E[max] se aproxima como:
 *   E[max SR_i] ≈ V·sqrt(σ_SR²) con V = (1-γ)·Φ⁻¹(1 - 1/N) + γ·Φ⁻¹(1 - 1/(N·e))
 *   γ = constante Euler-Mascheroni ≈ 0.5772
 *
 * Implementación simplificada: σ_SR² ≈ 1/(n-1) bajo H0 (Sharpe verdadero = 0,
 * normalidad). El benchmark SR* es entonces la Sharpe esperada del mejor de N
 * sistemas aleatorios.
 */
export function deflatedSharpe(
  observedSR: number,
  nObservations: number,
  nTrials: number,
  skewness: number = 0,
  kurtosis: number = 3,
): number {
  if (nTrials < 1) return NaN;
  if (nTrials === 1) return probabilisticSharpe(observedSR, nObservations, skewness, kurtosis);

  const gamma = 0.5772156649;
  // Aproximación de la expectativa del máximo de N normales estándar
  const phiInv = (p: number) => {
    // Beasley-Springer-Moro aproximación (suficiente para nuestro rango)
    // Para mayor precisión, usar Acklam — pero esto basta
    const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
    const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
    const c = [-7.78489400243029e-3, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
    const d = [7.78469570904146e-3, 0.32246712907004, 2.445134137143, 3.75440866190742];
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q: number;
    let r: number;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  };

  // E[max SR_i] bajo H0
  const expectedMax =
    (1 - gamma) * phiInv(1 - 1 / nTrials) + gamma * phiInv(1 - 1 / (nTrials * Math.E));
  // σ del estimador Sharpe ≈ sqrt(1/(n-1)) bajo H0
  const sigmaSR = 1 / Math.sqrt(nObservations - 1);
  const SRstar = expectedMax * sigmaSR;
  // Modificar PSR usando SR* en lugar de 0
  const denom = Math.sqrt(
    1 - skewness * observedSR + ((kurtosis - 1) / 4) * observedSR * observedSR,
  );
  if (denom === 0 || !Number.isFinite(denom)) return NaN;
  const z = ((observedSR - SRstar) * Math.sqrt(nObservations - 1)) / denom;
  return normalCdf(z);
}
