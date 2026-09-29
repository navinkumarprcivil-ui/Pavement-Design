# Verification register

Every design value the app uses, checked against the four codes, with the
clause, table or equation and the **printed page number** to open your copy
at. The same page number appears on every clause chip in the app (for example
`Cl. 6.4.1, Eq. 6.3, p. 20`) and in the references of each report.

Checked on 28 September 2026 against:

| Code | Edition | Pages checked |
|---|---|---|
| IRC:37-2018 | Fourth Revision | 1 – 84 (clauses, Table 11.1, Annex II) |
| IRC:58-2015 | Fourth Revision | 1 – 94 (clauses, Appendix V, VII) |
| IRC:SP:72-2015 | First Revision | 1 – 42 (clauses, Figs. 4 and 6, Appendix A – D) |
| IRC:SP:62-2014 | First Revision | 1 – 41 (clauses, Appendix I, II) |

The register holds numbers and citations only. The codes are copyrighted
publications of the Indian Roads Congress; their text, tables and figures are
not reproduced here or in the app.

Status: **✓** agrees with the code · **Corrected** changed in this check ·
**Note** agrees, with a remark below.

---

## IRC:37-2018 — flexible pavements

| Item | App value | Reference | Page | Status |
|---|---|---|---|---|
| Scope | IRC:37 from 2 msa; below, IRC:SP:72 | Cl. 2.1 | 3 | ✓ |
| Subgrade rutting | NR = 4.1656e-8 (1/εv)^4.5337 at 80%; 1.41e-8 at 90% | Cl. 3.6.1, Eq. 3.1 / 3.2 | 5 | ✓ |
| Analysis load | 80 kN axle, 20 kN a wheel, 310 mm c/c, 0.56 MPa | Cl. 3.6.1, Table 3.1 | 6, 9 | ✓ |
| Bituminous fatigue | Nf = 1.6064e-4 C (1/εt)^3.89 (1/MRm)^0.854 at 80%; 0.5161e-4 at 90% | Cl. 3.6.2, Eq. 3.3 / 3.4 | 6 | ✓ |
| Mix factor | C = 10^M, M = 4.84 [Vbe/(Va+Vbe) − 0.69] | Cl. 3.6.2 | 6 | ✓ |
| Design air voids | 3.5% single DBM; 3.0% bottom of two | Cl. 9.2 | 31 | ✓ |
| CTB fatigue | N = RF [(113000/E^0.804 + 191)/εt]^12, at 0.80 MPa | Cl. 3.6.3.1, Eq. 3.5 | 7 | ✓ |
| Reliability factor RF | 1 on important roads and above 10 msa; 2 otherwise | Cl. 3.6.3.1 | 7 | ✓ |
| CTB damage | log10 Nfi = (0.972 − σt/MRup)/0.0825; CFD = Σ ni/Nfi < 1 | Cl. 3.6.3.2, Eq. 3.6 / 3.7 | 7, 8 | ✓ |
| Tandem and tridem | 2 singles at ½ load; 3 singles at ⅓ load; 0.80 MPa | Cl. 3.6.3.2 | 8 | ✓ |
| Reliability | 90% on important roads, and on others from 20 msa; else 80% | Cl. 3.7 | 8 | ✓ |
| Growth rate floor | 5% | Cl. 4.2.2 | 14 | ✓ |
| Design period | 20 years NH, SH, urban; 15 others; 30 or long-life above 300 msa | Cl. 4.3.1 | 14 | ✓ |
| Indicative VDF | 0–150: 1.7 / 0.6; 150–1500: 3.9 / 1.7; >1500: 5.0 / 2.8 | Cl. 4.4.6, Table 4.2 | 16 | ✓ |
| Lateral distribution | 1.0, 0.75, 0.5, 0.4; divided 0.75, 0.6, 0.45 | Cl. 4.5.1 | 16, 17 | ✓ |
| Design traffic | N = 365 A D F [(1+r)^n − 1]/r; A = P(1+r)^x | Cl. 4.6.1, Eq. 4.5 / 4.6 | 17 | ✓ |
| Subgrade modulus | 10 CBR (≤ 5%); 17.6 CBR^0.64 (> 5%); μ 0.35 | Cl. 6.3, Eq. 6.1 / 6.2 | 19 | ✓ |
| Effective subgrade | 40,000 N, 0.56 MPa, a = 150.8 mm, 500 mm layer, MRS = 2(1−μ²)pa/δ; δ from the app's analysis or read from IITPAVE (step (i)); app 1.411 mm against Annex-II.1's 1.41 mm | Cl. 6.4.1, Eq. 6.3 | 20 | ✓ |
| Subgrade modulus cap | 100 MPa | Cl. 6.4.2 | 20 | ✓ |
| Minimum subgrade CBR | Over 5% above 450 CVPD | Cl. 6.4.3 | 20 | ✓ |
| GSB minimum | 150 mm (single filter-cum-drainage layer) | Cl. 7.2.2 | 21 | ✓ |
| Construction traffic | Larger of dumper traffic and 10,000 standard axles | Cl. 7.2.2 | 21, 22 | ✓ |
| Granular modulus | MR = 0.2 h^0.45 MR(support); μ 0.35 | Cl. 7.2.3, Eq. 7.1 | 22 | ✓ |
| CTSB | 600 MPa, μ 0.25, minimum 200 mm | Cl. 7.3.1 / 7.3.2 | 23 | ✓ |
| Granular base on CTSB | 300 MPa gravel, 350 MPa crushed rock | Cl. 8.1 | 24 | ✓ |
| Unbound base minimum | 150 mm; crack relief layer 100 mm | Cl. 8.1 | 24 | ✓ |
| CTB | 5000 MPa, μ 0.25, minimum 100 mm | Cl. 8.2.1 | 25 | ✓ |
| Modulus of rupture | 20% of 28-day UCS; caps 1.40, 1.05, 0.70 MPa | Cl. 8.2.2 | 26 | ✓ |
| Crack relief aggregate | 450 MPa, μ 0.35 | Cl. 8.3 | 26 | ✓ |
| Treated RAP base | 800 MPa, μ 0.35, minimum 100 mm | Cl. 8.4 | 27 | ✓ |
| Bituminous moduli | VG10, VG30, VG40 at 20 – 40 °C | Cl. 9.2, Table 9.2 | 30 | ✓ |
| Mix-design modulus | Smaller of the tested value and Table 9.2 | Cl. 9.2 / 11.1.2, Table 11.1 | 30, 33, 34 | **Corrected** (1) |
| Bituminous over CTB | At least 100 mm above 20 msa | Cl. 9.2 | 32 | ✓ |
| Material properties | As Table 11.1 | Table 11.1 | 34 | ✓ |
| Dumper VDF | 2 (120/80)^4 + (80/65)^4 = 12.41; 200 trips | Annex II, Example II.2 | 69 | ✓ |
| CTB under construction | 7-day flexural ≈ 70% of MRup; 70 trips | Annex II, Example II.4 | 76 | ✓ |

## IRC:58-2015 — rigid pavements

| Item | App value | Reference | Page | Status |
|---|---|---|---|---|
| Scope | More than 450 CVPD; below, IRC:SP:62 | Cl. 2.1 | 2 | ✓ |
| Load classes | Single 10 kN, tandem 20 kN, tridem 30 kN | Cl. 5.2 | 4 | ✓ |
| Growth rate floor | 5% | Cl. 5.5.2.1 | 5 | **Corrected** (2) |
| Design lane | 25% of two-way; 25% of the predominant direction on divided roads | Cl. 5.5.2.3 | 5 | ✓ |
| Top-down traffic | 50% default, wheel base under joint spacing | Cl. 5.5.2.4 | 5 | ✓ |
| Commercial vehicles | C = 365 A [(1+r)^n − 1]/r | Cl. 5.5.2.7, Eq. 1 | 6 | ✓ |
| Temperature | Zones I – VII, 150 / 200 / 250 / 300 – 400 mm | Cl. 5.6.1.1, Table 1 | 7 | ✓ |
| Night differential | Half the day value, plus 5 °C built-in curl | Cl. 5.6.1.1 / 5.6.2.1 / 5.6.2.3 | 6 – 8 | ✓ |
| k from CBR | 2 … 100% → 21 … 220 MPa/m | Cl. 5.7.3.4, Table 2 | 9 | ✓ |
| Minimum CBR | 8% for the 500 mm subgrade | Cl. 5.7.3.6 | 10 | **Corrected** (2) |
| DLC | 7 MPa at 7 days; minimum 150 mm | Cl. 5.7.4.1 | 11 | **Corrected** (2) |
| k over GSB and CTSB | Table 3 | Cl. 5.7.4.4, Table 3 | 12 | ✓ |
| k over DLC | Table 4, upper limit 300 MPa/m | Cl. 5.7.4.4, Table 4 | 11, 12 | ✓ |
| Flexural strength | 0.7 √fck; 90-day = 1.10 × 28-day; not under 4.5 MPa | Cl. 5.8.1 / 5.8.2 | 12, 13 | ✓ |
| Concrete | E 30,000 MPa, μ 0.15, α 10e-6 /°C, γ 24 kN/m³ | Cl. 5.8.4.1 / 5.8.5, App. V | 13, 74 | ✓ |
| Fatigue | Unlimited under SR 0.45; Eq. 5 for 0.45 – 0.55; Eq. 6 above | Cl. 5.8.6.1, Eq. 5 / 6 | 13, 14 | Note (3) |
| Bottom-up stress | Eq. V.1 – V.12 coefficients, k bands 80 and 150 | Appendix V | 73, 74 | ✓ |
| Top-down stress | Eq. V.13: −0.219, 1.686, 168.48, 0.1089; β 0.66 / 0.90 | Appendix V | 74, 75 | ✓ |
| Criterion | CFD(BUC) + CFD(TDC) ≤ 1; +10 mm for retexturing | Cl. 6.3.4.1, Eq. 7 / 8 | 19 | ✓ |
| Dowels | Table 5; none under 200 mm | Cl. 7.2.6, Table 5 | 27 | ✓ |
| Bonded PQC on DLC | k on the 200 – 250 mm granular layer below the DLC (Table 3); slab h designed there; PQC h1 (5 mm steps) with D1 + D2 ≥ E h³/12(1 − µ²); DLC E = 1000 fck(28), µ 0.2, 7-day ≥ 10 MPa | Cl. 6.7.1 – 6.7.3, Eq. 10 – 13 | 22, 23 | Note (9) |
| Bonded example | d 0.16 m; D1 46.65, D2 23.28, D 69.05 MN·m; 235 mm PQC on 150 mm DLC for a 300 mm slab | Appendix VII, Option IV | 89 | ✓ |
| Tie bars | As = b f W / Sst, f 1.5, 24 kN/m³; Sst 125 / 200 MPa, B* 1.75 / 2.46 MPa (plain / deformed); L = 2 Sst A / (B* P) + 100 + 50 mm; spacing ≤ 750 mm, Ø ≤ 16 mm | Cl. 8.2.1 – 8.2.4, Eq. 16 / 17 | 28, 29 | Note (10) |
| Tie bar examples | 330 mm slab, 3.5 m lane, 12 mm: plain 332.6 mm²/m, 340 c/c, 580 long; deformed 207.9 mm²/m, 540 c/c, 640 long; every row of Table 6 | Appendix IX; Table 6 | 92, 93; 29 | ✓ |
| Joints | Contraction joints ≤ 4.5 m; slab wider than 4.5 m needs a longitudinal joint; stress relations for a 3.5 × 4.5 m slab | Cl. 6.2.6 / 7.1.3 / 7.1.6 | 17, 25, 26 | ✓ |
| Drainage layer | qi = Ic [Nc/Wp + Wc/(Wp Cs)] + Kp, Ic 0.223 m³/day/m, Kp 0; Q = AD qi; K = Q/(I t); K ≥ 300 m/day; designed where rainfall > 1000 mm; below the DLC with a separation layer | Cl. 6.5.1 – 6.5.3, Eq. 9 | 20, 21 | Note (11) |
| Drainage material | t ≥ 100 mm; Cu = D60/D10 in 2 – 8, stabilised under 4; D10 > 2 mm; LA abrasion < 40%; stabiliser cement 2 – 2.5%, bitumen 1.5 – 2.5%, emulsion 2.5 – 3% | Cl. 5.7.3.9 / 6.5.2 / 6.5.3; Appendix VI, VI-II / VI-III | 10, 20, 21, 77, 78 | Note (11) |
| Drainage example | B 10.4 m, AC 12.48 m, AD 16.24 m, I 0.039, qi 0.115, Q 1.868 m³/day/m; K 319 m/day in 150 mm, 160 m/day in 300 mm | Appendix VI, VI-VIII | 79 – 81 | ✓ (11) |
| Worked example | Appendix VII stresses, repetitions and damage reproduced | Appendix VII | 82 – 88 | ✓ |

## IRC:SP:72-2015 — low volume roads, flexible

| Item | App value | Reference | Page | Status |
|---|---|---|---|---|
| Commercial vehicle | 3 t gross laden weight or more | Cl. 3.1.2 / 3.4.3 | 8, 11 | ✓ |
| Growth rate | 6% where nothing better is known | Cl. 3.2.3 | 9 | ✓ |
| Design life | 10 years | Cl. 3.3 | 9 | ✓ |
| Harvesting seasons | N = 365 T + s·n·T·(0.6 t) | Cl. 3.4.1, Fig. 1 | 9 – 11 | ✓ |
| Axle equivalency | (W/Ws)^4, Ws 80 kN single, 148 kN tandem | Cl. 3.4.3 | 12 | ✓ |
| Lane factor | 1 single and intermediate; 0.75 two lane | Cl. 3.4.3 / 3.4.4 | 13, 14 | ✓ |
| VDF | HCV 2.86 laden, 0.31 unladen; MCV 0.34, 0.02 | Cl. 3.4.4 | 13, 14 | ✓ |
| Cumulative ESAL | N = T0 × 365 × [(1+r)^n − 1]/r × L (= T0 × 4811 × L at 6%, 10 years) | Cl. 3.4.4 | 14 | ✓ |
| CVPD only | Appendix A, 25 – 300 CVPD → 19,380 – 6,63,120 ESAL | Cl. 3.4.5, Appendix A | 14, 37 | ✓ |
| Traffic categories | T1 – T9, 10,000 – 20,00,000 ESAL | Cl. 3.5 / 8 (ii) | 14, 15, 31 | **Corrected** (4) |
| Subgrade classes | S1 ≤ 2, S2 3 – 4, S3 5 – 6, S4 7 – 9, S5 10 – 15 | Cl. 4.3 | 19 | ✓ |
| New road CBR | At least 5%; 300 mm replacement considered at CBR 2 | Cl. 4.3 | 19, 20 | ✓ |
| Quick CBR | 75/(1 + 0.728 WPI); 28.091 D60^0.3581 | Appendix B | 38 | ✓ |
| Sub-base minimum | 100 mm; CTSB 7-day UCS 1.7 MPa | Cl. 5.1.1 / 7.1.2 / 7.1.4 | 20, 28, 29 | ✓ |
| GSB | Soaked CBR 20, 15 exceptionally | Cl. 7.1.1 | 28 | ✓ |
| Soil-cement base | 7-day UCS 3 MPa, minimum 100 mm | Cl. 7.2.3 / 7.2.4 | 29 | ✓ |
| Gravel roads | Up to 60,000 ESAL; 1,00,000 above CBR 5 | Cl. 6.1.2 / 8 (iii) | 25, 31, 32 | ✓ |
| Gravel base | Minimum 100 mm, soaked CBR 80; else 75 mm WBM III + 25 mm sub-base | Cl. 6.2 | 26 | ✓ |
| Gravel to sub-base | Table 4, design base 150 – 275 mm, sub-base CBR 15 – 50 | Cl. 6.2, Table 4 | 26 | ✓ |
| Surface gravel | 40 – 50 mm over the gravel base | Cl. 6.3 | 26 | ✓ |
| Surface treatment | By rainfall and T1 – T4 | Cl. 7.3.2, Table 5 | 30 | ✓ |
| Surfacing type | Surface dressing to T4; 20 mm premix carpet from T5 | Cl. 7.3.1 / 7.3.3 | 30, 31 | ✓ |
| Granular catalogue | 45 cells, S1 – S5 × T1 – T9 | Cl. 8, Fig. 4 | 22 | ✓ (5) |
| Cement treated catalogue | 45 cells, S1 – S5 × T1 – T9 | Cl. 8 (vi), Fig. 6 | 33 | ✓ (5) |
| Frost, black-topped | At least 450 mm: 300 sub-base + 150 base | Cl. 8 (x) | 32 | ✓ |
| Frost, gravel roads | S1 – S5 × T1 – T3 gravel base | Cl. 8 (xi) | 32 | ✓ |
| Overlay | Added WBM ≤ 150 mm (2 layers) to T5; ≤ 225 mm (3 layers) to T7 | Cl. 2.2.3 | 7 | ✓ |
| Drainage | Subgrade top ≥ 300 mm above ground, ≥ 600 mm above water table | Cl. 9.1 | 34 | ✓ |
| Worked example | 474 AADT, 16.35 ESAL/day, 78,660 ESAL, T3 × S3: 275 mm gravel or 100 + 100 cement treated | Appendix D | 41, 42 | ✓ |

## IRC:SP:62-2014 — low volume roads, rigid

| Item | App value | Reference | Page | Status |
|---|---|---|---|---|
| Scope | Under 450 CVPD; 3.75 m lane; joints 2.50 – 4.00 m | Cl. 2 | 3 | ✓ |
| Design load | 50 kN dual at 310 mm, 0.8 MPa; tractor wheel 0.5 MPa | Cl. 3.1 / 3.2 | 3 | ✓ |
| Design period | 20 years | Cl. 3.3 | 3 | ✓ |
| Design cases | < 50: load; 50 – 150: load + curling; > 150: fatigue | Cl. 3.4 / 4.3 | 3, 4, 13 | ✓ |
| Repetitions | N = 365 A [(1+r)^n − 1]/r; 10% at 100 kN | Cl. 3.4, Eq. 3.1 / Cl. 4.5 (7) | 4, 14 | ✓ |
| k from CBR | 2 … 50% → 21 … 140 MPa/m; minimum CBR 4 | Cl. 3.5, Table 3.1 | 4 | Note (6) |
| Effective k | Granular +20%; cementitious × 2 | Cl. 3.6.3, Table 3.2 | 6 | ✓ |
| Sub-base | By traffic band, granular or cementitious | Cl. 3.6.2 | 5 | ✓ |
| Flexural strength | 0.7 √fck; 90-day 1.10 × 28-day; M30 and 3.8 MPa minimum | Cl. 3.7, Eq. 3.3 | 6, 7 | ✓ |
| Concrete | E 30,000 MPa, μ 0.15, α 10e-6 /°C | Cl. 3.8 / 3.9 | 7 | ✓ |
| Fatigue | log10 Nf = SR^−2.222 / 0.523 | Cl. 3.10, Eq. 3.5 | 8 | ✓ |
| Edge stress | Westergaard, Eq. 4.1; dual wheel radius Eq. 4.4 – 4.7 | Cl. 4.2.1.1 | 9 – 11 | ✓ |
| Curling | σ = E α t C / 2, t = 0.667 ΔT | Cl. 4.2.1.2 / 4.5 (5), Eq. 4.8 | 11, 13 | Note (7) |
| Non-linear relief | 0.0767 MPa per °C of ΔT/3 | Appendix II, Table II-1 | 41 | ✓ |
| Temperature | Zones I – VI, 150 / 200 / 250 mm | Cl. 4.2.1.2, Table 4.1 | 12 | ✓ |
| Minimum slab | 150 mm | Cl. 4.3 | 13 | ✓ |
| Worked example | 4.34, 4.37, 3.985, 3.93 MPa; 150 mm fails, 160 mm passes | Appendix I | 35, 36 | ✓ |

---

## Corrections and notes

1. **Mix-design modulus (IRC:37 Cl. 9.2, p. 30; Table 11.1, p. 34).** The app
   used an entered mix modulus as it stood. The code takes the smaller of the
   tested value and the Table 9.2 value. The app now does, and says so in the
   step.
2. **IRC:58 citations.** The 5% growth floor is in Cl. 5.5.2.1, the 8% subgrade
   CBR in Cl. 5.7.3.6 and the 150 mm DLC in Cl. 5.7.4.1. The values were right;
   the citations now name these clauses.
3. **IRC:58 Eq. 6 (p. 14).** It is printed with the condition "SR < 0.55"; with
   Eq. 5 covering 0.45 – 0.55, it can only mean SR > 0.55, which the app uses.
4. **SP:72 traffic categories.** The app had eight categories with T8 running
   to 2,000,000 ESAL. The code has nine: T8 to 1,500,000 and T9 to 2,000,000.
   The catalogue was previously entered by hand; both catalogues are now built
   in from Figs. 4 and 6.
5. **SP:72 surfacing text and Fig. 4.** Cl. 5.1.3 names a surface treatment on
   S2 under T2; Fig. 4 shows S2 × T2 as a 275 mm gravel base and S2 × T3 as
   black-topped. The app follows the figure, and Table 5 decides a surface
   treatment on any gravel road.
6. **SP:62 k at CBR 10.** Table 3.1 gives 50 MPa/m, IRC:58 Table 2 gives 55.
   Table 3.2 (60 and 100) is built on 50, so the app uses the SP:62 value in
   SP:62 designs.
7. **SP:62 curling.** The code computes Bradbury's coefficient in its own
   spreadsheet from a regression that is not printed. The app uses Bradbury's
   closed-form coefficient and takes the temperature column of the next listed
   thickness up. Against Appendix I, the combined stresses come out 0.03 –
   0.06 MPa below the code's (4.20 against 4.25; 3.60 against 3.64; 3.83
   against 3.89; 4.12 against 4.15). The fatigue verdicts at 200 and 220 mm
   with 2.5 and 4.0 m joints all agree with the code's; the one verdict that
   differs is 170 mm at 3.75 m on a granular sub-base, which the code finds just
   unsafe (4.25 against 4.22) and the app just safe (4.20).
8. **Earlier notes, still standing.** IRC:37 Example II.4 prints a tandem CFD
   of 3.79 from a stress-ratio slip (3.42 recomputed from its own stresses; the
   app gives 3.53). IRC:37 Example II.5 prints a subgrade strain of 148 µε,
   against 267 µε from the app and from comparable sections; the verdict is
   the same.

9. **IRC:58 Eq. 13 (p. 23).** It is printed as E2 times the modular ratio
   E2/E1 times the transformed section, so E2 enters twice; a transformed-section
   derivation would carry E2 once (51.35 MN·m for the Appendix VII section in
   place of 23.28). The app takes Eq. 13 as printed, which reproduces
   Appendix VII; the printed form gives the DLC less credit and so a thicker
   PQC. An entered bonded PQC is checked for fatigue as the monolithic slab of
   equal stiffness, h = [12 (1 − µ²)(D1 + D2)/E]^(1/3).
10. **IRC:58 tie bars.** Table 6 and Appendix IX round spacing and length to the
   nearest 10 mm; the app does the same and reproduces both. Table 6 lists
   deformed-bar spacings above the 750 mm of Cl. 8.2.4 (830, 900, 1060, 910);
   the app holds them to 750 mm. Appendix IX prints the spacing as 100 × A/As
   and the plain bar perimeter as 7 in its substitutions; the results it gives
   are 1000 × A/As and 37.7 mm, which the app uses. Cl. 8.2.4 speaks of 50 –
   80 mm added to the length; Appendix IX adds 100 mm for paint and 50 mm for
   placement, and Table 6 follows Appendix IX, as does the app. For a bonded
   slab, W is taken on the PQC alone.
11. **IRC:58 drainage layer.** The Appendix VI example rounds I to 0.039 and qi
   to 0.115 on the way and prints K = 319 m/day (160 m/day in 300 mm); carried
   unrounded, the same inputs give 318 and 159 m/day, which the app shows. The
   flow path follows Fig. VI.1, whose gradient comes to √(S² + Sx²). The
   example's Wp counts the earthen shoulder and Wc only the concrete width; the
   app does the same. The 300 m/day of Cl. 6.5.2 is a floor on the specified
   permeability, so the 300 mm case is specified at 300 m/day. Cl. 5.7.3.9 and
   Cl. 6.5.2 give different stabiliser contents (bitumen 1.5 – 2% against
   2 – 2.5%, emulsion 3% against 2.5 – 3%); the app accepts either range. The
   drainage layer sits between the DLC (or cement treated sub-base) and the GSB
   separation layer; a granular sub-base is itself the drainage layer. Under a
   bonded slab the drainage and separation layers together make up the
   200 – 250 mm of Cl. 6.7.2 and the k of Table 3. The time-to-drain route of
   VI-VI (AASHTO 93) is not built; the code's example uses inflow against
   outflow, as the app does.

## How it is kept checked

- `tests/annexII.test.js`, `tests/annexExtra.test.js`, `tests/ctbDamage.test.js`,
  `tests/construction.test.js` — IRC:37 Annex II examples.
- `tests/rigid*.test.js` — IRC:58 Appendix VII, including Option IV (bonded),
  Appendix IX and Table 6 (tie bars).
- `tests/drainage.test.js` — IRC:58 Eq. 9 and the Appendix VI drainage layer
  example.
- `tests/sp72.test.js` — SP:72 Appendix A and D, Table 4, categories.
- `tests/sp62.test.js` — SP:62 Appendix I.

Run `npm test`. Each value above is held once, in `src/data/ircConstants.js`,
`src/data/sp72.js` or `src/data/sp62.js`, with its citation and page.
