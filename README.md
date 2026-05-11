# Hydrocarbon Isomer Explorer

A dependency-free browser app that accepts a hydrocarbon formula and displays constitutional isomers for several hydrocarbon families.

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
- `4-ethyl-2-methyl-5-propylnonane`
- `1-butyl-3-propylbenzene`

The app validates the formula, calculates degree of unsaturation, enumerates the selected family, names each isomer, and draws a simple carbon-skeleton or aromatic-ring diagram.

## Viewer Features

- Switch between atom-label and bond-line structure views.
- Open any compound card in a fullscreen viewer.
- Use Auto mode first; family filters are optional for forcing alkane, alkene, alkyne, or aromatic behavior.

## Current scope

The app gives exact structural-isomer results through `C12` for:

- Acyclic alkanes: `CnH2n+2`
- Acyclic monoalkenes: `CnH2n`
- Acyclic monoalkynes: `CnH2n-2`
- Single benzene-ring alkyl aromatics: `CnH2n-6`

Some formulas can represent more than one broad family. For example, `C5H8` can also describe dienes or rings, but alkyne mode intentionally lists acyclic monoalkynes only. Stereoisomers and conformers are not counted separately.

IUPAC name parsing supports the generated names, larger acyclic hydrocarbons with straight-chain alkyl substituents, and larger alkylbenzene names with straight-chain alkyl substituents. A truly universal IUPAC parser for every organic compound would require a dedicated cheminformatics engine.

## Verify

Run:

```bash
node tests.js
```

The tests compare generated alkane isomer counts against the known sequence from methane through dodecane.
