/**
 * Dense linear solve by Gaussian elimination with partial pivoting.
 * The systems here are at most ~24x24 (six pavement layers), so a direct
 * dense solve is the right tool.
 *
 * Returns null when the matrix is numerically singular; callers treat that
 * as "skip this integration sample" rather than failing the whole analysis.
 */
export function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-300) return null;
    if (pivot !== col) {
      const tmp = a[pivot];
      a[pivot] = a[col];
      a[col] = tmp;
    }
    const diag = a[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / diag;
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = a[row][n];
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k];
    x[row] = sum / a[row][row];
    if (!Number.isFinite(x[row])) return null;
  }
  return x;
}

/** 8-point Gauss-Legendre abscissae and weights on [-1, 1]. */
export const GAUSS_8 = {
  nodes: [
    -0.9602898564975363, -0.7966664774136267, -0.525532409916329,
    -0.1834346424956498, 0.1834346424956498, 0.525532409916329,
    0.7966664774136267, 0.9602898564975363,
  ],
  weights: [
    0.1012285362903763, 0.2223810344533745, 0.3137066458778873,
    0.362683783378362, 0.362683783378362, 0.3137066458778873,
    0.2223810344533745, 0.1012285362903763,
  ],
};
