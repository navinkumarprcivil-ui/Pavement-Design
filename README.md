# Pavement Design

An interactive pavement design assistant built on IRC codes. You pick the
pavement type and layer materials, enter the inputs, and the app computes the
design — showing the working and citing the clause behind every step. Change a
thickness or a material and it recomputes immediately, so trying alternatives
costs nothing.

Built mobile-first and dependency-free, so it runs in a phone browser today and
ports cleanly to Android later.

## Running it

```bash
npm run serve      # then open http://localhost:8080
npm test           # 25 tests, no dependencies
```

There is no build step and nothing to install. `npm run serve` is a small static
file server; any other static server, or opening the files through one, works
equally well. To use it on your phone while developing, serve from your machine
and open its address on the phone over the same network.

## What it does today

**Flexible pavement (IRC:37-2018)** — the complete path, end to end:

1. **Design traffic.** Cumulative standard axles from the commercial vehicle
   count, growth rate, design life, lane distribution factor and vehicle damage
   factor. This comes first because it decides which guideline applies: at or
   above 2 msa the design goes to IRC:37, below it to IRC:SP:72.
2. **Layer combination.** Bituminous layer (BC over DBM, BC only, SDBC over
   DBM), base (WMM, WBM or CTB), sub-base (GSB or CTSB), on a fixed subgrade.
   Choosing a cement treated base brings up the crack relief interlayer it
   requires.
3. **Inputs.** Subgrade CBR, binder grade, pavement temperature, mix
   volumetrics, and trial thicknesses.
4. **Result.** Fatigue and rutting checks with a safe/unsafe verdict, the
   governing life, the computed strains, every layer modulus with its working,
   and the traffic calculation — each step citing the clause it came from.

You can either check a trial section you have entered, or let the app find the
thinnest safe bituminous thickness for the foundation you have set.

**Rates and trials.** Enter a rate per cubic metre for each layer to cost the
section. Save as many trials as you like; they are listed safe-first then
cheapest, and you mark the one you intend to build.

**Low volume rural roads (IRC:SP:72-2015).** Traffic categorisation and CBR
banding are implemented. The design catalogue itself is code content, so it is
not shipped — the app gives you the catalogue structure and you enter the cells
from your own copy. Entries are stored on the device and reused from then on.

**Rigid pavement (IRC:58-2015).** Partial. Radius of relative stiffness,
Westergaard edge/interior/corner load stresses, and warping stress by Bradbury's
coefficient are implemented and are sound classical theory. The IRC:58 design
procedure proper — finite-element derived flexural stress equations and
cumulative fatigue damage over the axle load spectrum — is not, so the app
reports stresses without claiming a pass or fail.

## How the structural analysis works

The strains driving the fatigue and rutting checks come from an exact
multi-layer linear elastic analysis — the same class of analysis IITPAVE
performs for IRC:37. It is not an approximation such as the method of equivalent
thicknesses.

`src/engine/elastic.js` solves Love's axisymmetric stress function in the
Hankel-transformed domain. Each layer carries four unknowns fixed by the surface
loading and full bonding at every interface; the growing exponentials are
pre-scaled so thick layers stay numerically stable. Responses from the dual
wheels are superposed in Cartesian components, and the integration over the
transform parameter is segmented on the zeros of J₁.

The solver is validated against the Boussinesq closed form: collapsing every
layer to one material reproduces the analytical σ_z, σ_r and surface deflection
for a uniformly loaded circle on a half-space (`tests/elastic.test.js`).

## The IRC codes are not included

IRC codes are copyrighted publications of the Indian Roads Congress. This app
contains no code text, tables or page images.

What it holds is the numerical parameters needed to compute, each stored in
`src/data/ircConstants.js` alongside the citation telling you where to read the
clause in your own copy. Tap the reference on any computed step to see the
relation used, the numbers substituted into it, the result, and exactly which
clause, table or equation to open.

### Verify the constants before relying on a design

Every constant group carries a `verified` flag, and they are currently all
`false`. The values were entered from engineering references, not read off a
controlled copy of the code. The app says so on the home screen and on every
citation.

Before using any output for construction, open **Codes** in the app, work
through each group against your own copy of the code, correct anything that
differs, and set `verified: true` on the ones you have checked. The two worth
checking first, because they set the answer directly:

- `CRITERIA.bituminousFatigue` and `CRITERIA.subgradeRutting` — the coefficients
  and exponents of the two governing criteria.
- `CRITERIA.cementedFatigue` — explicitly provisional. The cement treated base
  check is reported for information only and deliberately does not govern the
  verdict.

The structural analysis feeding these criteria is exact and independently
validated; it is the empirical coefficients that need your confirmation.

## Layout

```
index.html              App shell
assets/styles.css       Mobile-first styles, light and dark
src/lib/                Bessel functions, linear solve, Gauss-Legendre
src/engine/             Calculation core — no browser APIs
  elastic.js              Multi-layer elastic analysis
  traffic.js              Design traffic and the IRC:37 / IRC:SP:72 branch
  materials.js            Layer moduli
  criteria.js             Fatigue and rutting
  flexibleDesign.js       Trial evaluation and thickness search
  ruralSP72.js            Low volume rural roads
  rigidIRC58.js           Rigid pavement (partial)
  costing.js              Quantities and cost
src/data/               IRC constants with citations; layer catalogue
src/store/              Saved trials and project state
src/ui/                 Screens and DOM helpers
tests/                  Node test runner, no dependencies
tools/serve.js          Static file server for development
```

`src/engine/` and `src/data/` are deliberately free of any browser API. That is
the part worth keeping when this moves to Android — either wrapped in a WebView
as it stands, or translated to Kotlin against the same tests.

## Where this is going

The goal is one app covering flexible pavements, rigid pavements and low volume
rural roads across several IRC design methods. Next up:

- The IRC:37 design catalogue as a second route alongside the
  mechanistic-empirical one already built.
- The IRC:58 fatigue damage procedure, to turn the rigid screen from stresses
  into a design.
- Verifying the constant groups against controlled copies of the codes.
