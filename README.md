# Hydrocarbon Isomer Explorer

A client-side browser app that accepts a hydrocarbon formula and displays constitutional isomers for several hydrocarbon families.

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
- `isobutane`
- `1-bromopentane`
- `1,1-dibromopentane`
- `2-chloro-4-ethyl-3-methylhexane`
- `ethanol`
- `neopentane`
- `neooctane`
- `toluene`
- `4-ethyl-2-methyl-5-propylnonane`
- `1-butyl-3-propylbenzene`

The app validates the formula, calculates degree of unsaturation, enumerates the selected family, names each isomer, recognizes common hydrocarbon aliases, and draws atom-label, zigzag bond-line, aromatic-ring, or interactive 3D diagrams.

## Chemistry engine layout

The chemistry engine's family-specific structure enumerators are in `chemengine/families/`:

- `alkane.js` builds acyclic saturated carbon skeletons.
- `alkene.js` and `alkyne.js` select the family-specific double- and triple-bond algorithms from the shared `alkene-alkyne.js` graph routine.
- `diene.js` enumerates acyclic structures with two double bonds.
- `cycloalkane.js` and `cycloalkene.js` enumerate monocyclic families.
- `bicyclic.js` enumerates the supported C5 bicyclic structures.
- `aromatic.js` enumerates single-ring alkylbenzenes.
- `fused-aromatic.js` builds naphthalene, anthracene, and phenanthrene.
- `haloalkane.js`, `alcohol.js`, and `amine.js` configure their compound-specific attachment rules over the shared `substituted-alkane.js` saturated-substitution algorithm.

Shared chemistry modules are also separated:

- `chemengine/formula.js` normalizes, parses, and formats molecular formulas.
- `chemengine/family-rules.js` owns molecular-formula patterns, family matching, and family detection.

Family modules receive shared graph, canonicalization, and naming helpers from `app.js`. App integration, IUPAC name parsing, and shared graph/naming primitives still remain there; generators, formula handling, and family recognition can now be changed independently. The service worker precaches the engine modules and 3D viewer for offline use.

## Viewer Features

- Switch between atom-label, bond-line, and lightweight interactive 3D structure views.
- Use common names such as isobutane, neopentane, neooctane, toluene, xylene aliases, ethylene, and acetylene.
- Recent successful inputs are saved locally in the browser for quick reuse; no database is needed.
- Switch between warmer light, dark, and system themes. Liquid-glass surfaces are always on.
- Share the explorer through native sharing, social links, copied links, or a QR code.
- Install it as a standalone web app with its own home-screen icon on supported browsers.
- Open any compound card in a fullscreen viewer.
- Use Auto mode first; family filters are optional for forcing alkane, alkene, alkyne, or aromatic behavior.

## Current scope

The app gives exact structural-isomer results through `C12` for:

- Acyclic alkanes: `CnH2n+2`
- Acyclic monoalkenes: `CnH2n`
- Acyclic monoalkynes: `CnH2n-2`
- Saturated monocyclic cycloalkanes: `CnH2n`
- Single benzene-ring alkyl aromatics: `CnH2n-6`
- Saturated haloalkanes with one halogen: `CnH2n+1X`
- Saturated monohydric alcohols: `CnH2n+2O`
- Saturated primary monoamines: `CnH2n+3N`

The following additional hydrocarbon families are enumerated through `C8`:

- Acyclic dienes with exactly two carbon-carbon double bonds: `CnH2n-2`
- Monocyclic cycloalkenes with exactly one double bond: `CnH2n-2`

Additional bounded ring support:

- C5 bicyclic saturated hydrocarbons: bridged, fused, and spiro carbon skeletons (`C5H8`)
- Fused benzenoid aromatics: naphthalene (`C10H8`), anthracene, and phenanthrene (`C14H10`)

Some formulas can represent more than one broad family. For example, `C5H8` can describe alkynes, dienes, and cycloalkenes, so choose the family mode to see the intended subset. Stereoisomers and conformers are not counted separately.

Bicyclic formulas above C5, tricyclic/polycyclic formulas, other fused aromatic systems beyond the listed compounds, and dienes beyond C8 are not enumerated yet. The app reports unsupported results rather than presenting partial counts.

Derivative support is intentionally focused: mono-haloalkane, alcohol, and primary monoamine formulas can be enumerated; saturated haloalkane names with halogen prefixes and straight-chain alkyl branches can be parsed directly. Other functional-group modes are not enumerated reliably yet and return an explicit unsupported result instead of displaying incomplete or formula-mismatched structures.

IUPAC name parsing supports the generated names, larger acyclic hydrocarbons with straight-chain alkyl substituents, saturated haloalkanes such as `1,1-dibromopentane`, and larger alkylbenzene names with straight-chain alkyl substituents. A truly universal IUPAC parser for every organic compound would require a dedicated cheminformatics engine.

## Verify

Run:

```bash
npm test
```

The tests compare generated alkane isomer counts against the known sequence from methane through dodecane, verify known small diene, cycloalkene, cycloalkane, and bicyclic counts, validate fused-aromatic formulas, check 3D atom/valence conservation, and verify unsupported families fail explicitly.

Start the local development server with `npm run dev`. It builds the static app first and serves only `build/` on loopback.
