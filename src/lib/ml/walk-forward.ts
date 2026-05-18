/**
 * Walk-forward cross-validation para series temporales.
 *
 * INVARIANTES DE NO-LEAKAGE (verificadas por auditor):
 *
 * 1. ORDEN TEMPORAL: el caller debe pasar X, y, dates ordenados crónologicamente
 *    (los más antiguos primero). El fold k entrena sobre [0, t_k) y predice
 *    sobre [t_k, t_k + step). Nunca se entrenan modelos con datos posteriores
 *    a su set de test.
 *
 * 2. ESTANDARIZACIÓN POR-FOLD: `trainLogistic` calcula mean/std SÓLO sobre el
 *    fold de train. Esos estadísticos se aplican al test vía el modelo
 *    devuelto. NO existe normalización global pre-CV — sería leakage.
 *
 * 3. PREDICCIÓN UN-PASS POR FOLD: cada test fold se predice una sola vez con
 *    el modelo entrenado hasta ese punto. No hay refit ni "ajuste fino".
 *
 * 4. AGREGACIÓN: las métricas OOS se computan sobre las predicciones de TODOS
 *    los folds concatenadas. Esto da la performance promedio realista —
 *    no la del último fold.
 *
 * 5. BASELINE: predictor que siempre devuelve `baseRate` (frecuencia base
 *    observada en OOS). Su log-loss es el suelo trivial — cualquier modelo
 *    que no lo supere claramente es inútil.
 *
 * 6. EXPANSIVO VS ROLLING: implementación usa ventana EXPANSIVA (train cre-
 *    ce con t). Alternativa rolling fija el tamaño de train. Expansivo
 *    aprovecha más información si la serie es estacionaria; rolling es más
 *    robusto si hay cambios de régimen. Para este dataset (22 años), usar
 *    expansivo por defecto y declararlo explícitamente.
 */

import { trainLogistic, predictProba } from "./logistic";

export type WalkForwardPrediction = {
  date: string;
  actual: number;
  predicted: number;
  fold: number;
};

export type WalkForwardResult = {
  predictions: WalkForwardPrediction[];
  inSampleLogLoss: number;
  outOfSampleLogLoss: number;
  inSampleAcc: number;
  outOfSampleAcc: number;
  baselineLogLoss: number;
  baselineAcc: number;
  baseRate: number; // proporción de y=1 en OOS
  folds: number;
  trainSizeMin: number;
  trainSizeMax: number;
};

export function logLoss(y: number[], p: number[]): number {
  if (y.length === 0) return NaN;
  const eps = 1e-15;
  let s = 0;
  for (let i = 0; i < y.length; i++) {
    const pi = Math.max(eps, Math.min(1 - eps, p[i]));
    s += -(y[i] * Math.log(pi) + (1 - y[i]) * Math.log(1 - pi));
  }
  return s / y.length;
}

export function accuracy(y: number[], p: number[]): number {
  if (y.length === 0) return NaN;
  let n = 0;
  for (let i = 0; i < y.length; i++) {
    if ((p[i] >= 0.5 ? 1 : 0) === y[i]) n++;
  }
  return n / y.length;
}

export function walkForwardLogistic(
  X: number[][],
  y: number[],
  dates: string[],
  minTrain: number,
  step: number,
  modelOpts?: { lambda?: number; lr?: number; iter?: number },
): WalkForwardResult {
  if (X.length !== y.length || X.length !== dates.length) {
    throw new Error("walkForward: length mismatch (X/y/dates)");
  }
  if (X.length < minTrain + step) {
    throw new Error(`walkForward: insufficient data (n=${X.length}, need ≥${minTrain + step})`);
  }

  // Verificación de orden temporal — invariante crítico
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) {
      throw new Error(`walkForward: dates not sorted ascending at i=${i}`);
    }
  }

  const predictions: WalkForwardPrediction[] = [];
  // In-sample aggregation: re-predicción sobre el train de CADA fold.
  // Esto sobre-pondera observaciones tempranas (aparecen en muchos folds).
  // Es la métrica IS estándar para walk-forward; reportada como contraste con OOS.
  const isProb: number[] = [];
  const isActual: number[] = [];
  let fold = 0;
  let trainSizeMin = Infinity;
  let trainSizeMax = 0;

  for (let i = minTrain; i < X.length; i += step) {
    const Xtrain = X.slice(0, i);
    const ytrain = y.slice(0, i);
    const upper = Math.min(i + step, X.length);
    const Xtest = X.slice(i, upper);
    const ytest = y.slice(i, upper);
    const dtest = dates.slice(i, upper);
    if (Xtest.length === 0) break;

    // ENTRENAR usando SÓLO el pasado
    const model = trainLogistic(Xtrain, ytrain, modelOpts);

    // OOS: predecir el bloque siguiente — datos jamás vistos por el modelo
    const probTest = predictProba(Xtest, model);
    for (let k = 0; k < probTest.length; k++) {
      predictions.push({ date: dtest[k], actual: ytest[k], predicted: probTest[k], fold });
    }

    // IS: predecir el train (para gap IS-OOS)
    const probTrain = predictProba(Xtrain, model);
    for (let k = 0; k < probTrain.length; k++) {
      isProb.push(probTrain[k]);
      isActual.push(ytrain[k]);
    }

    if (Xtrain.length < trainSizeMin) trainSizeMin = Xtrain.length;
    if (Xtrain.length > trainSizeMax) trainSizeMax = Xtrain.length;
    fold++;
  }

  const ooActual = predictions.map((p) => p.actual);
  const ooPred = predictions.map((p) => p.predicted);

  // Baseline: frecuencia base de y=1 en el conjunto OOS
  const baseRate = ooActual.length > 0 ? ooActual.reduce((s, v) => s + v, 0) / ooActual.length : 0.5;
  const baseline = new Array(ooActual.length).fill(baseRate);
  // Accuracy del baseline: predice siempre la clase mayoritaria
  const baselineAcc = Math.max(baseRate, 1 - baseRate);

  return {
    predictions,
    inSampleLogLoss: logLoss(isActual, isProb),
    outOfSampleLogLoss: logLoss(ooActual, ooPred),
    inSampleAcc: accuracy(isActual, isProb),
    outOfSampleAcc: accuracy(ooActual, ooPred),
    baselineLogLoss: logLoss(ooActual, baseline),
    baselineAcc,
    baseRate,
    folds: fold,
    trainSizeMin,
    trainSizeMax,
  };
}
