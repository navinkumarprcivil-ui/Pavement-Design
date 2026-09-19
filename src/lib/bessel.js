/**
 * Bessel functions of the first kind, orders 0 and 1, plus the positive zeros
 * of J1 used as integration breakpoints in the layered-elastic solver.
 *
 * Rational/asymptotic approximations after Abramowitz & Stegun 9.4;
 * absolute accuracy better than ~1e-8 over the full range, which is well
 * inside the tolerance needed for pavement response integration.
 */

export function besselJ0(x) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const p1 =
      57568490574.0 +
      y * (-13362590354.0 +
        y * (651619640.7 +
          y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const p2 =
      57568490411.0 +
      y * (1029532985.0 +
        y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
    return p1 / p2;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 0.785398164;
  const p1 =
    1 +
    y * (-0.1098628627e-2 +
      y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const p2 =
    -0.1562499995e-1 +
    y * (0.1430488765e-3 +
      y * (-0.6911147651e-5 + y * (0.7621095161e-6 + y * -0.934935152e-7)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2);
}

export function besselJ1(x) {
  const ax = Math.abs(x);
  let ans;
  if (ax < 8) {
    const y = x * x;
    const p1 =
      x * (72362614232.0 +
        y * (-7895059235.0 +
          y * (242396853.1 +
            y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const p2 =
      144725228442.0 +
      y * (2300535178.0 +
        y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return p1 / p2;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 2.356194491;
  const p1 =
    1 +
    y * (0.183105e-2 +
      y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const p2 =
    0.04687499995 +
    y * (-0.2002690873e-3 +
      y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2);
  return x < 0 ? -ans : ans;
}

/**
 * J1(x)/x, with the removable singularity at x = 0 resolved to its limit 1/2.
 */
export function besselJ1OverX(x) {
  if (Math.abs(x) < 1e-8) return 0.5 - (x * x) / 16;
  return besselJ1(x) / x;
}

/**
 * The first `count` positive zeros of J1. McMahon's asymptotic expansion
 * refined by Newton iteration using J1' = J0 - J1/x.
 */
export function besselJ1Zeros(count) {
  const zeros = [];
  for (let k = 1; k <= count; k++) {
    const b = (k + 0.25) * Math.PI;
    let x = b - 0.375 / b;
    for (let i = 0; i < 60; i++) {
      const f = besselJ1(x);
      const df = besselJ0(x) - besselJ1(x) / x;
      const step = f / df;
      x -= step;
      if (Math.abs(step) < 1e-13) break;
    }
    zeros.push(x);
  }
  return zeros;
}
