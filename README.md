# Pavement Design

An interactive pavement design assistant built on IRC codes. You pick the
pavement type and layer materials, enter the inputs, and the app computes the
design — showing the working and citing the clause behind every step. Change a
thickness or a material and it recomputes immediately, so trying alternatives
costs nothing.

Built mobile-first and dependency-free, so it runs in a phone browser today and
ports cleanly to Android later.

Live at **https://pavementdesign.vercel.app**

## Running it

```bash
npm run serve      # then open http://localhost:8080
npm test           # 38 tests, no dependencies
```

There is no build step and nothing to install. `npm run serve` is a small static
file server; any other static server, or opening the files through one, works
equally well. To use it on your phone while developing, serve from your machine
and open its address on the phone over the same network.

## What it does today

**Flexible pavement (IRC:37-2018)** — the complete path, end to end:

1. **Design traffic.** Cumulative standard axles from the commercial vehicle
   count, growth rate, design life, lane distribution factor and vehicle damage
   factor. Below 2 msa the step offers IRC:SP:72 beside IRC:37; choosing it
   moves the design into the low volume road steps.
2. **Layer combination.** Bituminous layer (BC over DBM, BC only, SDBC over
   DBM), base (WMM, WBM, CTB, or RAP treated with foamed bitumen or emulsion,
   Cl. 8.4), sub-base (GSB or CTSB), on a fixed subgrade. Choosing a cement
   treated base brings up the crack relief interlayer it requires. The
   materials and conditions ticked for the site (aggregates, cement, CTSB
   plant, SAMI, cold recycling, existing bituminous layer) limit the
   compositions offered.
3. **Axle loads** (cement treated base only). CTB material and 28-day UCS,
   which give the modulus of rupture (Cl. 8.2.2), and the axle load spectrum:
   the share of single, tandem and tridem axles and of each load class. The app
   works out the expected repetitions of every class from the design traffic.
4. **Inputs.** Subgrade CBR, or a select borrow over the embankment reduced
   to an effective modulus (Cl. 6.4, reproducing Annex-II.1); reliability,
   80% or 90%; binder grade, pavement temperature, mix modulus from the mix
   design if known, mix volumetrics; construction traffic (dumper axle loads
   and trips); trial thicknesses; and narrative paragraphs for the report.
5. **Result.** Fatigue and rutting checks, and the construction traffic
   checks: the granular sub-base under the dumper traffic or 10,000 standard
   axles, whichever is more (Cl. 7.2.2), and a freshly laid CTB at its 7-day
   flexural strength under the dumpers bringing the layer above it (Cl. 8.2.1,
   reproducing Annex-II.4). Also with a safe/unsafe verdict, the
   governing life, the computed strains, every layer modulus with its working,
   and the traffic calculation — each step citing the clause it came from.
   A cement treated base is checked for fatigue (Eq. 3.5) and for cumulative
   fatigue damage over the axle load spectrum (Eq. 3.6 / 3.7): tandem and
   tridem axles as two and three single axles, the CTB stress for each class
   from the elastic analysis at 0.80 MPa, and CFD ≤ 1. The CTB is sized to
   pass both. The stresses reproduce the Annex-II example (0.70 MPa under the
   190 kN single axle).

6. **IITPAVE.** Every analysis behind the design laid out as IITPAVE's
   inputs (layers, moduli, Poisson's ratios, thicknesses, wheel load, tyre
   pressure, analysis points, wheel set), with a copy button. Outputs read
   from IITPAVE can be entered, are compared with the app's own, and can be
   used for the verdict in their place, including the CTB stress of each axle
   load class. The report carries the inputs as an appendix.

You can either check a trial section you have entered, or let the app find the
thinnest safe bituminous thickness for the foundation you have set.

**Rates and trials.** Enter a rate per cubic metre for each layer to cost the
section. Save as many trials as you like; they are listed safe-first then
cheapest, and you mark the one you intend to build.

**Low volume roads.** The home page offers flexible and rigid only; the traffic
step suggests the low volume code where the traffic is low enough, and the
design then follows it throughout.

- *Flexible, IRC:SP:72-2015* (below 2 msa). Design traffic in ESAL from HCV and
  MCV counts with the code's VDFs, harvesting seasons (Cl. 3.4.1) and lane
  factor, or from Appendix A where only the CVPD is known; traffic categories
  T1 – T9 and subgrade classes S1 – S5; the composition from the granular
  (Fig. 4) or cement treated (Fig. 6) catalogue, with surface gravel or a
  surface treatment by rainfall (Table 5), surfacing type (Cl. 7.3.3), part of a
  gravel base as sub-base (Table 4), a WBM substitute where gravel of CBR 80 is
  not available, frost (Cl. 8), and the overlay on an existing road
  (Cl. 2.2.3). Reproduces Appendix D.
- *Rigid, IRC:SP:62-2014* (below 450 CVPD). Westergaard edge stress from the
  50 kN dual wheel (and a tractor wheel), Bradbury curling with the relief of
  the non-linear differential (Appendix II), and the three design cases of
  Cl. 4.3 up to fatigue at 60% reliability; the thinnest slab from 150 mm.
  Reproduces the edge stresses of Appendix I.

**Rigid pavement (IRC:58-2015).** The full fatigue design of a jointed plain
concrete slab: foundation k from Tables 2 – 4, temperature differentials from
Table 1, six-hour design repetitions, the Appendix-V stress equations for
bottom-up and top-down cracking, and cumulative fatigue damage over the axle
load spectrum. The thinnest slab with CFD ≤ 1 is found in 10 mm steps, with
dowel bars from Table 5. It reproduces the illustrative design of Appendix-VII
(290 mm with tied shoulders and dowels, 340 mm without). Bonded slabs, tie bars
and drainage layers are not yet in the app.

## Saved work and cloud sync

The app is offline-first. Everything is written to device storage the moment
you save it, so it keeps working with no signal — which is the point, on site.

Each code is a module with numbered steps — flexible (IRC:37-2018), rigid
(IRC:58-2015) and low volume roads (IRC:SP:72-2015, IRC:SP:62-2014) — ending in a design report
with every input, calculation step and clause, printable to PDF or downloadable
as a Word file. On a wide screen the side panel is docked beside the page.

The side panel (☰ at the top left on a phone) holds the saved designs, saved projects —
named copies of a design's inputs, flexible or rigid — the material rates used
for costing, the design steps, and About.

When a network is available, trials and projects are mirrored to
a Firebase Realtime Database so they survive a lost phone and follow you between
devices. Sign-in is anonymous: each device gets a Firebase uid and its records
live under `users/{uid}`. Losing the cloud never costs you a design — every
failure path falls back to local storage and says so on the home screen.

Merging is last-write-wins per record, and deletes leave a tombstone so that
deleting a trial on one phone is not undone by another device's older copy.
`tests/sync.test.js` covers those cases.

### Firebase setup

Two things must be switched on in the [Firebase
console](https://console.firebase.google.com/project/pavement-design) before
sync works:

1. **Authentication → Sign-in method → Anonymous → Enable.** Without this the
   app reports "Anonymous sign-in is not enabled" and stays local.
2. **Realtime Database → Rules.** Publish the contents of
   `database.rules.json`. They deny everything by default and let each user read
   and write only their own records.

   Do not leave the database in test mode. Test-mode rules are open to the
   whole internet: anyone could read or wipe every saved design.

The Firebase config in `src/config/firebase.js` is committed deliberately. A web
`apiKey` is a public project identifier, not a credential — it is meant to ship
in client code, and the security rules are what actually protect the data. Set
`FIREBASE_ENABLED` to false there to run purely on device storage.

## Deployment

Vercel serves the repository as a static site — there is no build step, so there
is nothing to configure beyond connecting the repo. Pushes to `main` deploy to
production; `vercel.json` only sets cache and security headers.

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

### Verified against the codes

Every value the app designs with has been checked against IRC:37-2018,
IRC:58-2015, IRC:SP:72-2015 and IRC:SP:62-2014, and every citation carries the
printed page it was read on. [docs/VERIFICATION.md](docs/VERIFICATION.md) lists
each value with its clause, table or equation and page, what was corrected, and
where the app and a code's worked example differ. The worked examples of all
four codes are reproduced by the tests.

Keep your own copies of the codes in `codebooks/`, which git ignores.

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
  ctbDamage.js            Cumulative fatigue damage of a CTB
  construction.js         Construction traffic: dumper axles, CTB stress
  ruralSP72.js            Low volume roads, flexible (IRC:SP:72)
  ruralRigid.js           Low volume roads, rigid (IRC:SP:62)
  rigidFatigue.js         IRC:58 stresses, fatigue and repetitions
  rigidDesign.js          IRC:58 foundation, temperature and slab search
  costing.js              Quantities and cost
src/data/               IRC constants with citations and pages; layer catalogue;
                        sp72.js and sp62.js for the low volume codes
src/config/firebase.js  Firebase project config (public, not a secret)
src/store/
  sync.js                 Offline-first storage with merge and tombstones
  cloud.js                Firebase mirroring, entirely optional
  trials.js               Saved trials and project state
  projects.js             Saved projects
src/ui/                 Screens and DOM helpers
  modules.js              The design modules and their codes
  drawer.js               The side panel
  stepper.js              Numbered step tabs for each module
  spectrum.js             Axle load spectrum editors, rigid and CTB
  ctbProject.js           CTB axle loads and strength for the design
  flexibleProject.js      The flexible design's engine input from the state
  lowVolumeProject.js     The low volume designs from the state
  lowVolume.js            The low volume code offered at the traffic step
  iitpave.js              Analyses laid out as IITPAVE inputs
  screens/report.js       The design report, for print, PDF and Word
tests/                  Node test runner, no dependencies
docs/VERIFICATION.md    Every value checked against the codes, with pages
tools/serve.js          Static file server for development
database.rules.json     Realtime Database security rules to publish
```

`src/engine/` and `src/data/` are deliberately free of any browser API. That is
the part worth keeping when this moves to Android — either wrapped in a WebView
as it stands, or translated to Kotlin against the same tests.

## Credits

Created by Navin Kumar P R — Transportation Engineering, M.Tech. in Civil
Engineering, IIT Madras.

## Where this is going

The goal is one app covering flexible pavements, rigid pavements and low volume
rural roads across several IRC design methods. Next up:

- The IRC:37 design catalogue as a second route alongside the
  mechanistic-empirical one already built.
- IRC:58 bonded slabs, tie bars and drainage layers.
