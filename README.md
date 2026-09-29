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
npm test           # no dependencies
```

There is no build step and nothing to install. `npm run serve` is a small static
file server; any other static server, or opening the files through one, works
equally well. To use it on your phone while developing, serve from your machine
and open its address on the phone over the same network.

## What it does today

**Flexible pavement (IRC:37-2018)** — the complete path, end to end:

1. **Design traffic.** Cumulative standard axles from the commercial vehicle
   count, growth rate, design life, lane distribution factor and vehicle damage
   factor, or entered directly in msa when already known (the CVPD at
   completion is still asked for the CBR floor of Cl. 6.4.3). The VDF is the
   indicative value of Table 4.2, a surveyed value (the larger direction on an
   undivided road, Cl. 4.6.2), or worked out from the axles weighed
   (Eq. 4.1 – 4.4), with the sample checked against Table 4.1. Stage
   construction (Cl. 4.3.2) designs the bituminous layers for 1.67 times the
   stage-1 traffic and rules out cement treated layers. Below 2 msa the step
   offers IRC:SP:72 beside IRC:37; choosing it moves the design into the low
   volume road steps.
2. **Layer combination.** Bituminous layer (BC over DBM, BC only, SDBC over
   DBM, BC or SDBC over BM), base (WMM, WBM, CTB, or RAP treated with foamed
   bitumen or emulsion, Cl. 8.4), sub-base (GSB or CTSB), on a fixed subgrade.
   Table 9.1 decides the mixes and binders offered at the design traffic and
   road category. Choosing a cement treated base brings up the crack relief
   interlayer it requires. The materials and conditions ticked for the site
   (aggregates, cement, CTSB plant, SAMI, cold recycling, existing bituminous
   layer) limit the compositions offered.
3. **Axle loads** (cement treated base only). CTB material and 28-day UCS,
   which give the modulus of rupture (Cl. 8.2.2), and the axle load spectrum:
   the share of single, tandem and tridem axles and of each load class. The app
   works out the expected repetitions of every class from the design traffic.
4. **Inputs.** Subgrade CBR at the percentile of Cl. 6.2.2, or a select
   borrow (in one layer or two sub-layers) over the embankment reduced to an
   effective modulus (Cl. 6.4, reproducing Annex-II.1), never above the
   subgrade's own. The surface deflection of that system is read from IITPAVE:
   the app sets out the entries in IITPAVE's order and takes the deflection
   back, with its own figure beside it as a check. Reliability, 80% or 90%;
   climate (plains at 35 °C, snow bound at 20 °C, with frost's 450 mm);
   long-life from 300 msa and on expressways (Cl. 10); binder grade, pavement
   temperature, mix modulus from the mix design if known, mix volumetrics;
   CTSB strength and the aggregate over it; construction traffic (dumper axle
   loads and trips); trial thicknesses; and narrative paragraphs for the
   report.
5. **IITPAVE.** The design rests on IITPAVE. Every analysis behind the trial
   section is laid out as IITPAVE's inputs (layers, moduli, Poisson's ratios,
   thicknesses, wheel load, tyre pressure, analysis points, wheel set), with a
   copy button, and the outputs read from IITPAVE are entered back: the strains
   of the standard axle, the CTB strain and the CTB stress of each axle load
   class, and the construction traffic checks. The app's own multi-layer
   elastic analysis stands beside each as a check. Until every value is
   entered the verdict is marked provisional, with the app's figure standing
   in for the missing ones.
6. **Result.** Fatigue and rutting checks, and the construction traffic
   checks: the granular sub-base under the dumper traffic or 10,000 standard
   axles, whichever is more (Cl. 7.2.2), and a freshly laid CTB at its 7-day
   flexural strength under the dumpers bringing the layer above it (Cl. 8.2.1,
   reproducing Annex-II.4). Each check shows where its value came from
   (IITPAVE, or the app pending IITPAVE) and the app's figure as a check,
   with the governing life, every layer modulus with its working, and the
   traffic calculation — each step citing the clause it came from.
   A cement treated base is checked for fatigue (Eq. 3.5) and for cumulative
   fatigue damage over the axle load spectrum (Eq. 3.6 / 3.7): tandem and
   tridem axles as two and three single axles, the CTB stress for each class
   at 0.80 MPa, and CFD ≤ 1. The report carries the IITPAVE inputs and
   outputs, with the app's figures, as an appendix.

You can either check a trial section you have entered, or let the app find the
thinnest bituminous thickness its own analysis passes for the foundation you
have set; either way the section then goes to IITPAVE for its verdict.

**Catalogue.** The inputs step shows the IRC:37 catalogue section (Cl. 12,
Figs. 12.1 – 12.48) for the composition, design traffic and effective CBR,
with the Cl. 12.3 assumptions that do not fit the road flagged. **Use as
trial** starts the analysis from it; the report sets it beside the designed
section. The catalogue is guidance for 2 – 50 msa only and never the verdict.

**Cross-section and bill of quantities.** The report draws the road across
its width: the layers to their widths, paved, tied concrete and earthen
shoulders, a widened outer lane, the debonding sheet under a slab, and the
longitudinal joints with their tie bars. Drainage and filter layers run to the
embankment slopes (IRC:37 Cl. 7.2.1, IRC:58 Cl. 6.5.2); SP:72 shoulders take
100 mm of sub-base material (Cl. 9.2). The bill of quantities is measured off
the same section: layer volumes, prime and tack coats, the separation sheet,
dowel and tie bars in tonnes, and joint sealing.

**Rates and trials.** Enter a rate for each item to cost the section, per km
and per m². Save as many trials as you like; they are listed safe-first then
cheapest, and you mark the one you intend to build. Pick two or three with
**Compare** to set them side by side: layer by layer, total thickness, design
traffic, life or CFD, verdict and cost, with the rows that differ marked.

**Low volume roads.** The home page offers flexible and rigid only; the traffic
step suggests the low volume code where the traffic is low enough, and the
design then follows it throughout.

- *Flexible, IRC:SP:72-2015* (below 2 msa). Design traffic in ESAL from HCV and
  MCV counts with the code's VDFs, harvesting seasons (Cl. 3.4.1) and lane
  factor, from Appendix A where only the CVPD is known, or entered directly;
  traffic categories
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
concrete slab: foundation k from Tables 2 – 4 or measured by plate load test
(Eq. 2) or FWD, flexural strength from the beam test or 0.7 √fck,
temperature differentials from
Table 1, six-hour design repetitions, the Appendix-V stress equations for
bottom-up and top-down cracking, and cumulative fatigue damage over the axle
load spectrum. The thinnest slab with CFD ≤ 1 is found in 10 mm steps, with
dowel bars from Table 5 checked for bearing stress (Eq. 14 / 15, Appendix-VIII).
It reproduces the illustrative design of Appendix-VII
(290 mm with tied shoulders and dowels, 340 mm without).
A PQC may be bonded to the DLC (Cl. 6.7): the slab is designed on the granular
layer below the DLC and replaced by the thinnest PQC whose stiffness bonded to
the DLC matches it (Eq. 10 – 13, reproducing Appendix-VII Option IV: 235 mm on
150 mm DLC for 300 mm). Tie bars for the longitudinal joints are designed by
Cl. 8.2 (Eq. 16 / 17), plain or deformed, reproducing Appendix-IX and every row
of Table 6. A drainage layer below the DLC (Cl. 6.5) is sized from the water
entering by the joints (Eq. 9) and the flow down the resultant slope,
reproducing the Appendix-VI example (319 m/day in 150 mm), with the 300 m/day
floor, the 100 mm minimum and the material checks of Appendix-VI.

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

**Projects.** Save the open project over itself, or **Save as copy** to keep
the original and carry on with a variant. Any saved project can be duplicated,
or exported as a `.pavement.json` file to share or keep; importing a file adds
it as a new saved project, leaving the open one as it is.

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

The design rests on the strains read from IITPAVE. Beside them, and in the
thickness search that proposes the trial section, the app runs its own exact
multi-layer linear elastic analysis — the same class of analysis IITPAVE
performs for IRC:37, not an approximation such as the method of equivalent
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
  rigidDetails.js         IRC:58 bonded PQC on DLC and tie bars
  drainage.js             IRC:58 drainage layer
  crossSection.js         The road across its width: layer widths, shoulders, joints
  quantities.js           Bill of quantities off the cross-section
  costing.js              Money and number formats
  catalogue.js            IRC:37 catalogue section for a composition
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
  iitpaveTables.js        Those inputs drawn as tables and in order of entry
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
