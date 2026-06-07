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
- Single benzene-ring alkyl aromatics: `CnH2n-6`
- Saturated haloalkanes with one halogen: `CnH2n+1X`
- Saturated monohydric alcohols: `CnH2n+2O`

Some formulas can represent more than one broad family. For example, `C5H8` can also describe dienes or rings, but alkyne mode intentionally lists acyclic monoalkynes only. Stereoisomers and conformers are not counted separately.

Derivative support is intentionally focused: mono-haloalkane and alcohol formulas can be enumerated; saturated haloalkane names with halogen prefixes and straight-chain alkyl branches can be parsed directly. Ethers and broader multi-functional derivatives are outside the current scope.

IUPAC name parsing supports the generated names, larger acyclic hydrocarbons with straight-chain alkyl substituents, saturated haloalkanes such as `1,1-dibromopentane`, and larger alkylbenzene names with straight-chain alkyl substituents. A truly universal IUPAC parser for every organic compound would require a dedicated cheminformatics engine.

## Verify

Run:

```bash
node tests.js
```

The tests compare generated alkane isomer counts against the known sequence from methane through dodecane.
