/**
 * Multi-layer linear elastic analysis of a pavement under circular loads.
 *
 * This is the same class of analysis that IITPAVE performs for IRC:37-2018:
 * n bonded elastic layers resting on a semi-infinite subgrade, loaded by one
 * or more uniformly loaded circular contact areas.
 *
 * Method: Love's axisymmetric stress function, Hankel-transformed. Within a
 * layer the transformed function is
 *     f(z) = (A + Bz)e^(-mz) + (C + Dz)e^(+mz)
 * and the four unknowns per layer are fixed by surface loading plus full
 * bonding (continuity of sigma_z, tau_rz, u_z, u_r) at every interface. The
 * growing exponentials are pre-scaled by e^(-m*h) so every stored term stays
 * bounded, which is what keeps the solve stable for thick layers.
 *
 * Responses from several wheels are superposed in Cartesian components, so
 * dual-wheel geometry (IRC standard axle) is handled directly.
 *
 * Verified against the Boussinesq closed form: collapsing every layer to one
 * material must reproduce sigma_z and sigma_r for a uniformly loaded circle
 * on a half-space (see tests/elastic.test.js).
 *
 * Sign convention: TENSION POSITIVE. A surface load therefore produces
 * negative (compressive) sigma_z.
 */

import { besselJ0, besselJ1, besselJ1OverX, besselJ1Zeros } from '../lib/bessel.js';
import { solveLinearSystem, GAUSS_8 } from '../lib/linalg.js';

const J1_ZEROS = besselJ1Zeros(400);

/**
 * Contact radius of one wheel, mm, from wheel load (N) and tyre pressure (MPa).
 */
export function contactRadius(wheelLoadN, tyrePressureMPa) {
  return Math.sqrt(wheelLoadN / (tyrePressureMPa * Math.PI));
}

/**
 * Assemble and solve the layer-coefficient system for one Hankel parameter m.
 * Returns the coefficient quadruple [alpha, beta, gamma, delta] per layer,
 * or null if the system is singular at this m.
 */
function solveCoefficients(layers, m) {
  const n = layers.length;
  const unknowns = 4 * (n - 1) + 2;
  const matrix = Array.from({ length: unknowns }, () => new Array(unknowns).fill(0));
  const rhs = new Array(unknowns).fill(0);

  // Column index of alpha for layer i.
  const base = (i) => 4 * i;
  const isLast = (i) => i === n - 1;

  // Coefficients of [alpha, beta, gamma, delta] for each bracket, evaluated at
  // local dimensionless depth tau within layer i (T = m * h).
  function brackets(i, tau) {
    const nu = layers[i].nu;
    const En = Math.exp(-tau);
    const T = isLast(i) ? Infinity : m * layers[i].h;
    const Ep = isLast(i) ? 0 : Math.exp(-(T - tau));
    return {
      sigmaZ: [En, (tau + 1 - 2 * nu) * En, -Ep, (1 - 2 * nu - tau) * Ep],
      tauRZ: [En, (tau - 2 * nu) * En, Ep, (tau + 2 * nu) * Ep],
      uZ: [En, (tau + 2 - 4 * nu) * En, Ep, (tau + 4 * nu - 2) * Ep],
      uR: [-En, (1 - tau) * En, Ep, (tau + 1) * Ep],
    };
  }

  function place(row, i, coeffs, scale) {
    const width = isLast(i) ? 2 : 4;
    for (let k = 0; k < width; k++) {
      matrix[row][base(i) + k] += scale * coeffs[k];
    }
  }

  // Surface: sigma_z normalised to -1, tau_rz = 0.
  const surface = brackets(0, 0);
  place(0, 0, surface.sigmaZ, 1);
  rhs[0] = -1;
  place(1, 0, surface.tauRZ, 1);
  rhs[1] = 0;

  // Interface continuity, fully bonded.
  let row = 2;
  for (let i = 0; i < n - 1; i++) {
    const shearModulus = (k) => layers[k].E / (2 * (1 + layers[k].nu));
    const bottom = brackets(i, m * layers[i].h);
    const top = brackets(i + 1, 0);
    const muI = shearModulus(i);
    const muJ = shearModulus(i + 1);

    place(row, i, bottom.sigmaZ, 1);
    place(row, i + 1, top.sigmaZ, -1);
    row++;

    place(row, i, bottom.tauRZ, 1);
    place(row, i + 1, top.tauRZ, -1);
    row++;

    place(row, i, bottom.uZ, 1 / muI);
    place(row, i + 1, top.uZ, -1 / muJ);
    row++;

    place(row, i, bottom.uR, 1 / muI);
    place(row, i + 1, top.uR, -1 / muJ);
    row++;
  }

  const solution = solveLinearSystem(matrix, rhs);
  if (!solution) return null;

  const coefficients = [];
  for (let i = 0; i < n; i++) {
    coefficients.push([
      solution[base(i)],
      solution[base(i) + 1],
      isLast(i) ? 0 : solution[base(i) + 2],
      isLast(i) ? 0 : solution[base(i) + 3],
    ]);
  }
  return coefficients;
}

/**
 * Locate the layer containing depth z. `preferBottomOf` pins the point to the
 * bottom fibre of a given layer index, which is how the tensile strain at the
 * underside of the bituminous layer is evaluated (the strain is discontinuous
 * across a bonded interface, so the side matters).
 */
function locate(layers, z, preferBottomOf) {
  if (preferBottomOf !== undefined && preferBottomOf !== null) {
    return preferBottomOf;
  }
  let top = 0;
  for (let i = 0; i < layers.length - 1; i++) {
    const bottom = top + layers[i].h;
    if (z < bottom - 1e-9) return i;
    top = bottom;
  }
  return layers.length - 1;
}

function layerTop(layers, index) {
  let top = 0;
  for (let i = 0; i < index; i++) top += layers[i].h;
  return top;
}

/**
 * Analyse a pavement structure.
 *
 * @param {object} input
 * @param {Array<{h:number,E:number,nu:number}>} input.layers  Top to bottom, mm
 *        and MPa. The last layer is the semi-infinite subgrade; its `h` is
 *        ignored.
 * @param {object} input.load
 * @param {number} input.load.wheelLoadN      Load on ONE wheel, N.
 * @param {number} input.load.tyrePressureMPa Contact pressure, MPa.
 * @param {number} [input.load.dualSpacingMm] Centre-to-centre spacing of a dual
 *        wheel set. Omit or 0 for a single wheel.
 * @param {Array<{x:number,y:number,z:number,layerIndex?:number,label?:string}>}
 *        input.points Evaluation points. x is measured from the centre of the
 *        first wheel, z downward from the surface, all mm.
 * @returns {Array<object>} one result per point: stresses (MPa), strains
 *        (dimensionless; multiply by 1e6 for microstrain).
 */
export function analyze({ layers, load, points, options = {} }) {
  const a = contactRadius(load.wheelLoadN, load.tyrePressureMPa);
  const q = load.tyrePressureMPa;
  const spacing = load.dualSpacingMm || 0;
  const wheelCentres = spacing > 0 ? [0, spacing] : [0];

  const resolved = points.map((p) => {
    const index = locate(layers, p.z, p.layerIndex);
    return {
      ...p,
      layerIndex: index,
      tauDepth: p.z - layerTop(layers, index),
      material: layers[index],
    };
  });

  // Accumulators: [sxx, syy, szz, sxy, sxz, syz] per point.
  const acc = resolved.map(() => new Float64Array(6));
  let deflection = resolved.map(() => 0);

  // Integration breakpoints. Oscillation is governed by the largest radial
  // distance in play, so the segment width follows that rather than `a` alone.
  const maxRadius = Math.max(
    a,
    ...resolved.flatMap((p) =>
      wheelCentres.map((xw) => Math.hypot(p.x - xw, p.y || 0))
    )
  );
  const segmentWidth = Math.PI / (2 * Math.max(maxRadius, a));
  const maxSegments = options.maxSegments ?? 900;
  const tolerance = options.tolerance ?? 1e-10;

  let quietSegments = 0;
  let magnitude = 0;

  for (let seg = 0; seg < maxSegments; seg++) {
    // Early segments follow the zeros of J1(ma); later ones use uniform steps.
    let mLow;
    let mHigh;
    if (seg < J1_ZEROS.length && J1_ZEROS[seg] / a < (seg + 1) * segmentWidth) {
      mLow = seg === 0 ? 0 : J1_ZEROS[seg - 1] / a;
      mHigh = J1_ZEROS[seg] / a;
    } else {
      mLow = seg * segmentWidth;
      mHigh = (seg + 1) * segmentWidth;
    }
    const half = (mHigh - mLow) / 2;
    const mid = (mHigh + mLow) / 2;

    let segmentMax = 0;

    for (let g = 0; g < GAUSS_8.nodes.length; g++) {
      const m = mid + half * GAUSS_8.nodes[g];
      if (m < 1e-12) continue;
      const weight = GAUSS_8.weights[g] * half;

      const coefficients = solveCoefficients(layers, m);
      if (!coefficients) continue;

      const loadWeight = q * a * besselJ1(m * a) * weight;
      if (loadWeight === 0) continue;

      for (let pi = 0; pi < resolved.length; pi++) {
        const p = resolved[pi];
        const [alpha, beta, gamma, delta] = coefficients[p.layerIndex];
        const nu = p.material.nu;
        const tau = m * p.tauDepth;
        const isLast = p.layerIndex === layers.length - 1;
        const En = Math.exp(-tau);
        const Ep = isLast
          ? 0
          : Math.exp(-(m * layers[p.layerIndex].h - tau));

        const bSigma =
          (alpha + beta * (tau + 1 - 2 * nu)) * En +
          (delta * (1 - 2 * nu) - gamma - delta * tau) * Ep;
        const bTau =
          (alpha + beta * (tau - 2 * nu)) * En +
          (gamma + delta * (tau + 2 * nu)) * Ep;
        const bU =
          (beta * (1 - tau) - alpha) * En + (gamma + delta * (tau + 1)) * Ep;
        const bW =
          (alpha + beta * (tau + 2 - 4 * nu)) * En +
          (gamma + delta * (tau + 4 * nu - 2)) * Ep;
        const sTerm = 2 * nu * (beta * En + delta * Ep);

        const shearModulus = p.material.E / (2 * (1 + nu));

        for (const xw of wheelCentres) {
          const dx = p.x - xw;
          const dy = p.y || 0;
          const r = Math.hypot(dx, dy);
          const j0 = besselJ0(m * r);
          const j1OverMr = besselJ1OverX(m * r);
          const j1 = besselJ1(m * r);

          const sigmaZ = loadWeight * bSigma * j0;
          const sigmaR = loadWeight * (sTerm * j0 + bU * (j0 - j1OverMr));
          const sigmaT = loadWeight * (sTerm * j0 + bU * j1OverMr);
          const tauRZ = loadWeight * bTau * j1;

          const theta = r < 1e-9 ? 0 : Math.atan2(dy, dx);
          const c = Math.cos(theta);
          const s = Math.sin(theta);

          const out = acc[pi];
          out[0] += sigmaR * c * c + sigmaT * s * s; // sxx
          out[1] += sigmaR * s * s + sigmaT * c * c; // syy
          out[2] += sigmaZ; // szz
          out[3] += (sigmaR - sigmaT) * s * c; // sxy
          out[4] += tauRZ * c; // sxz
          out[5] += tauRZ * s; // syz

          deflection[pi] += (-loadWeight * bW * j0) / (2 * shearModulus * m);

          const scale = Math.abs(sigmaZ) + Math.abs(sigmaR);
          if (scale > segmentMax) segmentMax = scale;
        }
      }
    }

    for (const out of acc) {
      for (const v of out) magnitude = Math.max(magnitude, Math.abs(v));
    }
    if (seg > 12 && segmentMax < tolerance * Math.max(magnitude, 1e-12)) {
      quietSegments++;
      if (quietSegments >= 4) break;
    } else {
      quietSegments = 0;
    }
  }

  return resolved.map((p, i) => {
    const [sxx, syy, szz, sxy, sxz, syz] = acc[i];
    const { E, nu } = p.material;
    const exx = (sxx - nu * (syy + szz)) / E;
    const eyy = (syy - nu * (sxx + szz)) / E;
    const ezz = (szz - nu * (sxx + syy)) / E;
    return {
      label: p.label,
      x: p.x,
      y: p.y || 0,
      z: p.z,
      layerIndex: p.layerIndex,
      sigmaXX: sxx,
      sigmaYY: syy,
      sigmaZZ: szz,
      sigmaXY: sxy,
      sigmaXZ: sxz,
      sigmaYZ: syz,
      epsXX: exx,
      epsYY: eyy,
      epsZZ: ezz,
      /** Largest horizontal strain, tension positive. */
      maxHorizontalStrain: Math.max(exx, eyy),
      /** Vertical compressive strain as a positive magnitude. */
      verticalCompressiveStrain: -ezz,
      surfaceDeflectionMm: deflection[i],
    };
  });
}
