/**
 * Regresión logística binaria con regularización L2 y descenso por gradiente.
 *
 * INVARIANTES DE NO-LEAKAGE:
 *
 * 1. La estandarización (mean, std) se computa SÓLO con X de entrenamiento.
 *    Esos estadísticos se almacenan en el modelo y se aplican al test después
 *    vía `predictProba`. Es responsabilidad del caller pasar SÓLO datos de
 *    train a `trainLogistic`. Esta separación es lo que evita que la media
 *    o varianza del test se filtre al modelo de train.
 *
 * 2. L2 penaliza SÓLO los pesos, no el bias. Penalizar el bias sesga el
 *    modelo hacia P=0.5 cuando lambda es grande, lo que no es deseable.
 *
 * 3. Sigmoid implementado de forma numéricamente estable para evitar overflow
 *    en valores extremos de z.
 *
 * 4. Pérdida: log-loss promedio + (lambda/2) * ||w||² (excluyendo bias).
 *    El gradiente se reescala por 1/n para que `lr` sea independiente del
 *    tamaño del batch.
 */

export type LogisticModel = {
  weights: number[]; // length d, sin bias
  bias: number;
  mean: number[]; // estadísticos del train para standardize
  std: number[];
  iterations: number;
};

function sigmoid(z: number): number {
  // Forma numéricamente estable
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

function computeMeanStd(X: number[][]): { mean: number[]; std: number[] } {
  const n = X.length;
  const d = X[0].length;
  const mean = new Array(d).fill(0);
  for (const r of X) for (let i = 0; i < d; i++) mean[i] += r[i];
  for (let i = 0; i < d; i++) mean[i] /= n;
  const std = new Array(d).fill(0);
  for (const r of X) for (let i = 0; i < d; i++) std[i] += (r[i] - mean[i]) ** 2;
  for (let i = 0; i < d; i++) {
    std[i] = Math.sqrt(std[i] / n);
    if (std[i] === 0) std[i] = 1; // evita div/0 — constante numérica
  }
  return { mean, std };
}

function standardizeWith(X: number[][], mean: number[], std: number[]): number[][] {
  return X.map((r) => r.map((v, i) => (v - mean[i]) / std[i]));
}

export function trainLogistic(
  X: number[][],
  y: number[],
  opts?: { lambda?: number; lr?: number; iter?: number },
): LogisticModel {
  if (X.length !== y.length) throw new Error("trainLogistic: length mismatch");
  if (X.length === 0) throw new Error("trainLogistic: empty data");

  const lambda = opts?.lambda ?? 0.1;
  const lr = opts?.lr ?? 0.1;
  const iter = opts?.iter ?? 1000;

  // CRÍTICO: estandarización SÓLO con X (que son sólo datos de train)
  const { mean, std } = computeMeanStd(X);
  const Xs = standardizeWith(X, mean, std);
  const n = Xs.length;
  const d = Xs[0].length;

  const w = new Array(d).fill(0);
  let b = 0;

  for (let it = 0; it < iter; it++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * Xs[i][j];
      const p = sigmoid(z);
      const err = p - y[i];
      for (let j = 0; j < d; j++) gw[j] += err * Xs[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) gw[j] = gw[j] / n + lambda * w[j]; // L2 sólo en pesos
    gb /= n; // bias sin regularización
    for (let j = 0; j < d; j++) w[j] -= lr * gw[j];
    b -= lr * gb;
  }

  return { weights: w, bias: b, mean, std, iterations: iter };
}

export function predictProba(X: number[][], m: LogisticModel): number[] {
  const Xs = standardizeWith(X, m.mean, m.std);
  const d = m.weights.length;
  return Xs.map((r) => {
    let z = m.bias;
    for (let j = 0; j < d; j++) z += m.weights[j] * r[j];
    return sigmoid(z);
  });
}

/**
 * Magnitud de cada peso en el espacio estandarizado.
 * Aproxima "feature importance" para un modelo lineal — los features con
 * mayor |peso| después de estandarizar tienen mayor influencia marginal en
 * el logit. No es SHAP, pero es honesto para un modelo lineal.
 */
export function featureImportance(m: LogisticModel): number[] {
  return m.weights.map((w) => Math.abs(w));
}
