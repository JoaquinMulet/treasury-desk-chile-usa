/**
 * K-means clustering con inicialización k-means++ y múltiples seeds.
 *
 * INVARIANTES:
 * 1. Determinismo: dado el mismo `seed`, mismo resultado. RNG es LCG explícito.
 * 2. La estandarización de features debe hacerse FUERA. K-means es sensible a
 *    escalas — pasarle features con varianzas heterogéneas distorsiona la
 *    distancia euclídea. El caller es responsable.
 * 3. `inertia` = suma de distancias euclídeas al cuadrado al centro asignado.
 *    Métrica estándar para comparar runs (menor es mejor).
 * 4. `nInit > 1` ejecuta múltiples runs y retiene el de menor inertia. Mitiga
 *    sensibilidad a la inicialización aleatoria (k-means es no-convexo).
 */

export type KMeansResult = {
  centers: number[][];
  labels: number[];
  inertia: number;
  iterations: number;
};

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

function meanRows(rows: number[][]): number[] {
  const dim = rows[0].length;
  const m = new Array(dim).fill(0);
  for (const r of rows) for (let i = 0; i < dim; i++) m[i] += r[i];
  for (let i = 0; i < dim; i++) m[i] /= rows.length;
  return m;
}

/** LCG determinístico — sin dependencia del Math.random global */
function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * k-means++ initialization (Arthur & Vassilvitskii 2007).
 * Selecciona centroides iniciales con probabilidad proporcional a D².
 */
function kmeansPlusPlusInit(X: number[][], k: number, rng: () => number): number[][] {
  const n = X.length;
  const centers: number[][] = [];
  centers.push(X[Math.floor(rng() * n)].slice());

  while (centers.length < k) {
    const d2arr: number[] = new Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      let minD = Infinity;
      for (const c of centers) {
        const d = dist2(X[i], c);
        if (d < minD) minD = d;
      }
      d2arr[i] = minD;
      total += minD;
    }
    if (total === 0) {
      // Datos degenerados — todos iguales. Replica un centro existente.
      centers.push(centers[0].slice());
      continue;
    }
    let r = rng() * total;
    let picked = n - 1;
    for (let i = 0; i < n; i++) {
      r -= d2arr[i];
      if (r <= 0) {
        picked = i;
        break;
      }
    }
    centers.push(X[picked].slice());
  }
  return centers;
}

function singleRun(
  X: number[][],
  k: number,
  seed: number,
  maxIter: number,
  tol: number,
): KMeansResult {
  const n = X.length;
  const rng = lcg(seed);
  let centers = kmeansPlusPlusInit(X, k, rng);
  const labels = new Array<number>(n).fill(0);
  let prevInertia = Infinity;
  let iter = 0;

  for (; iter < maxIter; iter++) {
    // Assign step
    for (let i = 0; i < n; i++) {
      let best = Infinity;
      let bestK = 0;
      for (let j = 0; j < k; j++) {
        const d = dist2(X[i], centers[j]);
        if (d < best) {
          best = d;
          bestK = j;
        }
      }
      labels[i] = bestK;
    }

    // Update step — promedio de puntos asignados a cada cluster.
    // Si un cluster queda vacío, se reinicializa al punto con mayor distancia al
    // centro asignado (sklearn-style). Mantener el centro vacío puede congelar k
    // efectivo < k declarado sin advertencia.
    const newCenters: number[][] = [];
    for (let j = 0; j < k; j++) {
      const cluster = X.filter((_, i) => labels[i] === j);
      if (cluster.length === 0) {
        let farthestIdx = 0;
        let farthestD = -1;
        for (let i = 0; i < n; i++) {
          const d = dist2(X[i], centers[labels[i]]);
          if (d > farthestD) {
            farthestD = d;
            farthestIdx = i;
          }
        }
        newCenters.push(X[farthestIdx].slice());
      } else {
        newCenters.push(meanRows(cluster));
      }
    }

    // Compute new inertia
    let inertia = 0;
    for (let i = 0; i < n; i++) inertia += dist2(X[i], newCenters[labels[i]]);

    centers = newCenters;

    // Convergence check
    if (Math.abs(prevInertia - inertia) < tol) {
      iter++;
      break;
    }
    prevInertia = inertia;
  }

  let finalInertia = 0;
  for (let i = 0; i < n; i++) finalInertia += dist2(X[i], centers[labels[i]]);
  return { centers, labels, inertia: finalInertia, iterations: iter };
}

export function kmeans(
  X: number[][],
  k: number,
  opts?: { maxIter?: number; tol?: number; nInit?: number; seed?: number },
): KMeansResult {
  if (X.length === 0) throw new Error("kmeans: empty data");
  if (k <= 0) throw new Error("kmeans: k must be > 0");
  if (k > X.length) throw new Error("kmeans: k > n");

  const maxIter = opts?.maxIter ?? 200;
  const tol = opts?.tol ?? 1e-6;
  const nInit = opts?.nInit ?? 10;
  const baseSeed = opts?.seed ?? 42;

  let best: KMeansResult | null = null;
  for (let s = 0; s < nInit; s++) {
    const r = singleRun(X, k, baseSeed + s * 17, maxIter, tol);
    if (!best || r.inertia < best.inertia) best = r;
  }
  return best!;
}

/** Asigna cada punto al centro más cercano. Útil para predecir clusters sobre nuevos puntos. */
export function assignLabels(X: number[][], centers: number[][]): number[] {
  return X.map((x) => {
    let best = Infinity;
    let bestK = 0;
    for (let j = 0; j < centers.length; j++) {
      const d = dist2(x, centers[j]);
      if (d < best) {
        best = d;
        bestK = j;
      }
    }
    return bestK;
  });
}
