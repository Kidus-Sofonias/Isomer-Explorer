# Isomer Explorer

A client-side browser app that accepts a molecular formula or a compound name and displays exact constitutional isomers or a resolved structure, driven by a local chemistry engine — no external chemistry API, database, or hosted lookup service is used anywhere. All chemical structure resolution happens inside the app.

Made by Kidus Sofonias.

- GitHub: <https://github.com/Kidus-Sofonias>
- Email: <sofoniaskidus@gmail.com>

## Use

Open `index.html` in a browser and enter formulas such as:

- `CH4`
- `C5H12`
- `C5H10`
- `C5H8`
- `C8H10`
- `C10H14`
- `C5H11Br`
- `C2H5OH`
- `C3H6O` (aldehyde and ketone in one — the app names the alternatives)
- `C4H8O2` (ester and carboxylic acid)
- `C2H5NO` (amide)
- `C3H7NO2` (nitro)
- `C4H7N` (nitrile)

…and names such as:

- `isobutane`, `neopentane`, `toluene`, `xylene`
- `1-bromopentane`, `1,1-dibromopentane`, `2-chloro-4-ethyl-3-methylhexane`
- `ethanol`, `ethyl acetate`, `methyl propanoate`
- `acetone`, `butan-2-one`, `pentan-3-one`
- `propanal`, `acetaldehyde`
- `ethanoic acid` (or `acetic acid`, `formic acid`, `butanoic acid`, ...)
- `butanamide`, `2-methylpropanamide`
- `ethanenitrile`, `2-methylpropanenitrile`
- `1-nitropropane`, `2-methyl-2-nitropropane`
- `diethyl ether`, `dimethyl ether`, `2-methoxy-2-methylpropane`
- `1,2,4-trimethylbenzene`, `1-butyl-3-propylbenzene`, `naphthalene`, `anthracene`

The app validates the formula (valence bounds, unpaired-charge/hydrogen ceiling, unsaturation parity), computes degree of unsaturation, detects or accepts a family, enumerates or resolves the structure, validates every structure it draws, and names each isomer. Results can be shown as atom-label, zigzag bond-line, aromatic-ring, or interactive 3D diagrams; the 3D view and the internal molecule model share the same atoms-and-bonds data, so what you see is what the engine stored.

## Chemistry engine layout

The chemistry engine lives in `chemengine/`:

- `chemengine/graph-model.js` is the formal molecular data model: atoms (element, implicit/explicit hydrogens, charge), bonds (order 1–3, kind including aromatic/coordinate), adjacency construction, implicit-hydrogen inference, element-aware formula recalculation, degree of unsaturation, per-atom valence rules, graph connectivity, whole-molecule validation (`validateMolecule`), and ring analysis (`cycleCount`, `atomsInRings`).
- `chemengine/formula.js` normalizes, parses, formats, and validates molecular formulas.
- `chemengine/family-rules.js` owns formula patterns, family matching, family detection, per-family carbon bounds, and ambiguity detection (`detectFamilyCandidates`).

Family enumerators are in `chemengine/families/`:

- `alkane.js` builds acyclic saturated carbon skeletons.
- `alkene.js` / `alkyne.js` select double- and triple-bond placement from the shared `alkene-alkyne.js` graph routine.
- `diene.js` enumerates acyclic structures with two double bonds.
- `cycloalkane.js` and `cycloalkene.js` enumerate monocyclic families.
- `bicyclic.js` enumerates the supported C5 bicyclic (bridged, fused, spiro) skeletons.
- `aromatic.js` enumerates single-ring alkylbenzenes; `fused-aromatic.js` builds naphthalene, anthracene, and phenanthrene.
- `haloalkane.js`, `alcohol.js`, and `amine.js` configure attachments over the shared `substituted-alkane.js` machinery.
- `ether.js` builds real C–O–C bridge graphs; `ester.js` builds real O-bridged carboxylate graphs with C=O double bonds.
- `carboxylic-acid.js`, `aldehyde.js`, `ketone.js`, `nitrile.js`, `amide.js`, and `nitro.js` enumerate their carbonyl/triple-bond/nitro families over every saturated skeleton.

App integration (`app.js`) wires the modules together, validates every enumerated isomer through the molecule model before display, resolves IUPAC and common names through dedicated parsers, and renders results.

## Structural validation (why results are trustworthy)

Every enumerated isomer is rebuilt as an explicit atoms-and-bonds molecule and must pass `validateMolecule` before it is shown:

- graph fully connected,
- every atom within its element valence (charge-adjusted),
- no duplicate, missing-range, or self bonds,
- implicit formula recomputed from structure matches the queried formula exactly.

If a family generator ever produced an invalid graph, the engine fails closed and reports `unsupported` instead of drawing a wrong structure.

## Result states (honesty by design)

The app distinguishes explicitly between:

- **invalid formula** — violates hydrogen/valence/parity bounds, with suggested corrections;
- **unsupported family / unsupported pattern** — valid but outside the enumerated domain, always explained with a message;
- **ambiguous match** — one formula matching several bounded families (e.g. `C3H6O` = aldehyde + ketone; `C4H10O` = alcohol + ether; `C5H8` = alkyne + cycloalkene + diene + bicyclic): Auto mode picks the primary family and the results label names the alternatives, so you can switch Mode to enumerate each pattern;
- **valid enumerated result** — exact constitutional-isomer list for the selected family.

## Current scope

Exact structural-isomer results through `C12` for:

- Acyclic alkanes `CnH2n+2`
- Acyclic monoalkenes `CnH2n` and monoalkynes `CnH2n-2`
- Saturated monocyclic cycloalkanes `CnH2n`
- Single benzene-ring alkyl aromatics `CnH2n-6`
- Saturated haloalkanes with one halogen `CnH2n+1X`
- Saturated monohydric alcohols `CnH2n+2O` and monoethers `CnH2n+2O`
- Saturated primary monoamines `CnH2n+3N`
- Saturated aldehydes `CnH2nO` and ketones `CnH2nO` (ketones from C3)
- Saturated carboxylic acids `CnH2nO2` and monoesters `CnH2nO2`
- Saturated nitriles `CnH2n-1N` (from C2), nitroalkanes `CnH2n+1NO2`, and primary amides `CnH2n+1NO`

Verified isomer counts follow the known combinatorics of each family — for example C4H8O2 esters = 4, C5H10O2 esters = 9, C6H12O2 esters = 20, C6H12O ketones = 6, C7H14O aldehydes = 17, C4H9NO2 nitroalkanes = 4 — and the test suite pins these sequences.

Additional bounded hydrocarbon families:

- Acyclic dienes with exactly two double bonds `CnH2n-2`, through C10 — verified counts: C4H6 = 2, C5H8 = 6, C6H10 = 16, C7H12 = 44, C8H14 = 120, C9H16 = 328, C10H18 = 901.
- Monocyclic cycloalkenes `CnH2n-2`, through C10 — verified counts: C4H6 = 3, C5H8 = 8, C6H10 = 21, C7H12 = 55, C8H14 = 147, C9H16 = 391, C10H18 = 1054.
- Bicyclic saturated hydrocarbons `CnH2n-2`, through C7 — verified counts: C5H8 = 5, C6H10 = 17, C7H12 = 56.
- Fused benzenoid aromatics: naphthalene `C10H8`, anthracene and phenanthrene `C14H10`

Some formulas match more than one family (alkene/cycloalkane for `CnH2n`; alkyne/diene/cycloalkene/bicyclic for `CnH2n-2`; alcohol/ether; aldehyde/ketone; ester/carboxylic acid). Auto mode picks the primary match and names every alternative; force the intended family in Mode to enumerate each subset. Stereoisomers (cis/trans, stereocentres) are never counted separately.

## Known limits — reported as unsupported, not approximated

- Bicyclic formulas above C7; tricyclic/polycyclic skeletons beyond the listed fused aromatics; fused aromatic systems beyond naphthalene/anthracene/phenanthrene.
- Multi-heteroatom formulas (`C2H8N2`), halogen+heteroatom combinations, and any formula outside one bonded functional group plus a saturated or monocyclic skeleton — the general catch-all modes report unsupported rather than enumerating unbounded combinatorics.
- Unsaturated derivatives (enols, unsaturated acids/esters/aldehydes), diols, dicarbonyls, hydroxy acids, secondary/tertiary amines, N-substituted amides, phenols, and aryl ethers are not enumerated.
- Full IUPAC parsing is available for the generated names plus common derivable patterns (haloalkyl substituents, straight-chain branches, ester/nitrile/amide/nitro/acid/aldehyde/ketone/ether names and frequent common aliases); a universal organic name parser would require a dedicated cheminformatics engine and stays out of scope.
- Nitrile family enumeration applies to saturated monocarbon-chain nitriles; the app is honest about any formula whose nitrile pattern it cannot enumerate.

## Optional backend (accounts, history, saved lists)

No backend is required or included. All chemistry is computed locally in the browser; recently searched compounds are saved in `localStorage` and work offline via the service worker. If you later want cross-device accounts, saved search history, or compound lists, add backend server **only for user persistence** — the search, enumeration, validation, naming, and rendering must stay in `chemengine/`. The app must continue to work without login; any auth should use standard secure session patterns (httpOnly cookies, hashed credentials via a proven password library, no secrets in the repo), with database setup documented separately at that point.

## Verify

Run:

```bash
npm test
```

The test suite verifies:

- generated alkane counts through dodecane against the known sequence;
- known isomer counts for diene, cycloalkene, cycloalkane, bicyclic, fused-aromatic, ether, and every supported functional family (aldehyde, ketone, carboxylic acid, ester, nitrile, nitro, amide);
- canonical-key uniqueness for deduplicated isomer sets;
- molecule-model structural validation: water-style ok cases plus rejection of hypervalent carbon, disconnected graphs, self/duplicate bonds, out-of-range bond orders, unsupported elements, and formula mismatches;
- ring detection: acyclic vs monocyclic vs spiro ring systems and ring-atom membership;
- per-isomer 3D-model element conservation and valence checks;
- name parsing (systematic, common aliases) and explicit unsupported messages for every pattern outside the enumerated domain.

Start the local development server with `npm run dev`. It builds the static app first and serves only `build/` on loopback.
