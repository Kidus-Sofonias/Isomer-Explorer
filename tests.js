const app = require("./app.js");

const expectedCounts = {
  1: 1,
  2: 1,
  3: 1,
  4: 2,
  5: 3,
  6: 5,
  7: 9,
  8: 18,
  9: 35,
  10: 75,
  11: 159,
  12: 355
};

for (const [carbonText, expected] of Object.entries(expectedCounts)) {
  const carbon = Number(carbonText);
  const actual = app.generateAlkaneIsomers(carbon).length;
  if (actual !== expected) {
    throw new Error(`C${carbon} expected ${expected} isomers, got ${actual}`);
  }
}

const c4 = app.analyzeFormula("C4H10").isomers.map((isomer) => isomer.name);
for (const name of ["butane", "2-methylpropane"]) {
  if (!c4.includes(name)) {
    throw new Error(`C4H10 is missing ${name}`);
  }
}

const c6 = app.analyzeFormula("C6H14").isomers.map((isomer) => isomer.name);
for (const name of [
  "hexane",
  "2-methylpentane",
  "3-methylpentane",
  "2,2-dimethylbutane",
  "2,3-dimethylbutane"
]) {
  if (!c6.includes(name)) {
    throw new Error(`C6H14 is missing ${name}`);
  }
}

const c7 = app.analyzeFormula("C7H16").isomers.map((isomer) => isomer.name);
for (const name of [
  "heptane",
  "2-methylhexane",
  "3-methylhexane",
  "3-ethylpentane",
  "2,2,3-trimethylbutane"
]) {
  if (!c7.includes(name)) {
    throw new Error(`C7H16 is missing ${name}`);
  }
}

const c5Alkenes = app.analyzeFormula("C5H10", "alkene").isomers.map((isomer) => isomer.name);
for (const name of [
  "pent-1-ene",
  "pent-2-ene",
  "2-methylbut-1-ene",
  "2-methylbut-2-ene",
  "3-methylbut-1-ene"
]) {
  if (!c5Alkenes.includes(name)) {
    throw new Error(`C5H10 alkene mode is missing ${name}`);
  }
}

const c5Alkynes = app.analyzeFormula("C5H8", "alkyne").isomers.map((isomer) => isomer.name);
for (const name of ["pent-1-yne", "pent-2-yne", "3-methylbut-1-yne"]) {
  if (!c5Alkynes.includes(name)) {
    throw new Error(`C5H8 alkyne mode is missing ${name}`);
  }
}

const c8Aromatics = app.analyzeFormula("C8H10", "aromatic").isomers.map((isomer) => isomer.name);
for (const name of [
  "ethylbenzene",
  "1,2-dimethylbenzene",
  "1,3-dimethylbenzene",
  "1,4-dimethylbenzene"
]) {
  if (!c8Aromatics.includes(name)) {
    throw new Error(`C8H10 aromatic mode is missing ${name}`);
  }
}

const benzene = app.analyzeFormula("C6H6", "auto");
if (benzene.status !== "ok" || benzene.family !== "aromatic" || benzene.isomers[0].name !== "benzene") {
  throw new Error("C6H6 should be recognized as benzene in aromatic mode");
}

const nameLookup = app.analyzeQuery("pent-2-ene", "auto");
if (
  nameLookup.status !== "ok" ||
  nameLookup.source !== "name" ||
  nameLookup.nameOnly !== true ||
  nameLookup.formula !== "C5H10" ||
  nameLookup.isomers.length !== 1 ||
  nameLookup.isomers[0].name !== "pent-2-ene"
) {
  throw new Error("IUPAC name lookup should resolve pent-2-ene as one compound");
}

const aromaticNameLookup = app.analyzeQuery("ethylbenzene", "auto");
if (
  aromaticNameLookup.status !== "ok" ||
  aromaticNameLookup.family !== "aromatic" ||
  aromaticNameLookup.formula !== "C8H10" ||
  aromaticNameLookup.isomers.length !== 1
) {
  throw new Error("IUPAC name lookup should resolve ethylbenzene as C8H10 aromatic");
}

const aliasLookup = app.analyzeQuery("toluene", "auto");
if (
  aliasLookup.status !== "ok" ||
  aliasLookup.matchedName !== "methylbenzene" ||
  aliasLookup.formula !== "C7H8" ||
  aliasLookup.isomers.length !== 1
) {
  throw new Error("Common aromatic aliases should resolve to their supported IUPAC entries");
}

const isobutaneLookup = app.analyzeQuery("isobutane", "auto");
if (
  isobutaneLookup.status !== "ok" ||
  isobutaneLookup.matchedName !== "2-methylpropane" ||
  isobutaneLookup.matchedAlias !== "isobutane" ||
  isobutaneLookup.formula !== "C4H10" ||
  isobutaneLookup.isomers.length !== 1
) {
  throw new Error("Common alkane aliases should resolve to their IUPAC structures");
}

const neooctaneLookup = app.analyzeQuery("neooctane", "auto");
if (
  neooctaneLookup.status !== "ok" ||
  neooctaneLookup.matchedName !== "2,2-dimethylhexane" ||
  neooctaneLookup.formula !== "C8H18" ||
  neooctaneLookup.isomers.length !== 1
) {
  throw new Error("Neo alkane aliases should resolve, including neooctane");
}

const specificDecaneName = app.analyzeQuery("4-ethyl-2,3-dimethylhexane", "auto");
if (
  specificDecaneName.status !== "ok" ||
  specificDecaneName.nameOnly !== true ||
  specificDecaneName.formula !== "C10H22" ||
  specificDecaneName.isomers.length !== 1 ||
  specificDecaneName.isomers[0].name !== "4-ethyl-2,3-dimethylhexane"
) {
  throw new Error("Specific IUPAC alkane names should show one compound, not the full formula isomer list");
}

const secButaneLookup = app.analyzeQuery("sec butane", "auto");
if (secButaneLookup.status !== "unsupported" || !/not a standalone alkane/.test(secButaneLookup.message)) {
  throw new Error("sec-butane should receive friendly naming guidance instead of a generic error");
}

const typoNameLookup = app.analyzeQuery("isobutan", "auto");
if (
  typoNameLookup.status !== "unsupported" ||
  !/does not exist as written/.test(typoNameLookup.message) ||
  !typoNameLookup.suggestions ||
  !typoNameLookup.suggestions.includes("isobutane")
) {
  throw new Error("Invalid names should explain that they do not exist and suggest close valid names");
}

const invalidLocantLookup = app.analyzeQuery("but-6-ene", "auto");
if (
  invalidLocantLookup.status !== "unsupported" ||
  !/multiple-bond locant/.test(invalidLocantLookup.message) ||
  !invalidLocantLookup.suggestions ||
  !invalidLocantLookup.suggestions.includes("but-1-ene")
) {
  throw new Error("Invalid locants should include a specific reason and nearby valid compounds");
}

const invalidFormulaLookup = app.analyzeQuery("C5H13", "auto");
if (
  invalidFormulaLookup.status !== "error" ||
  !/does not exist as written/.test(invalidFormulaLookup.popupTitle) ||
  !invalidFormulaLookup.suggestions ||
  !invalidFormulaLookup.suggestions.includes("C5H12")
) {
  throw new Error("Invalid formulas should suggest nearby valid hydrocarbon formulas");
}

const pentane = app.analyzeFormula("C5H12", "alkane").isomers.find((isomer) => isomer.name === "pentane");
const pentaneBondline = app.buildDiagramSvg(pentane.adjacency, pentane.chain, pentane.edgeOrders, "bondline");
if (!pentaneBondline.includes('class="bondline"') || pentaneBondline.includes("bondline-node")) {
  throw new Error("Bond-line diagrams should render as skeletal line art without carbon node dots");
}
if (!/y1="148" x2="[^"]+" y2="88"/.test(pentaneBondline)) {
  throw new Error("Bond-line diagrams should use a zigzag chain layout");
}

const formulaLookup = app.analyzeQuery("C5H10", "auto");
if (formulaLookup.status !== "ok" || formulaLookup.source === "name" || formulaLookup.family !== "alkene") {
  throw new Error("Formula-looking input should still resolve as a formula");
}

const largeParsedName = app.analyzeQuery("4-ethyl-2-methyl-5-propylnonane", "auto");
if (
  largeParsedName.status !== "ok" ||
  largeParsedName.source !== "parsed-name" ||
  largeParsedName.formula !== "C15H32" ||
  largeParsedName.isomers.length !== 1
) {
  throw new Error("Advanced IUPAC parser should resolve 4-ethyl-2-methyl-5-propylnonane as C15H32");
}

const parsedAlkene = app.analyzeQuery("4-ethyl-2-methylnon-3-ene", "auto");
if (parsedAlkene.status !== "ok" || parsedAlkene.family !== "alkene" || parsedAlkene.formula !== "C12H24") {
  throw new Error("Advanced IUPAC parser should resolve branched acyclic alkenes");
}

const parsedAromatic = app.analyzeQuery("1-butyl-3-propylbenzene", "auto");
if (parsedAromatic.status !== "ok" || parsedAromatic.family !== "aromatic" || parsedAromatic.formula !== "C13H20") {
  throw new Error("Advanced IUPAC parser should resolve larger alkylbenzene names");
}

const bromoFormula = app.analyzeQuery("C5H11Br", "auto");
if (
  bromoFormula.status !== "ok" ||
  bromoFormula.family !== "haloalkane" ||
  bromoFormula.formula !== "C5H11Br" ||
  !bromoFormula.isomers.some((isomer) => isomer.name === "1-bromopentane") ||
  !bromoFormula.isomers.some((isomer) => isomer.name === "3-bromopentane")
) {
  throw new Error("Haloalkane formulas should enumerate bromoalkane derivatives");
}

const namedBromide = app.analyzeQuery("1-bromopentane", "auto");
if (
  namedBromide.status !== "ok" ||
  namedBromide.family !== "haloalkane" ||
  namedBromide.formula !== "C5H11Br" ||
  namedBromide.isomers.length !== 1
) {
  throw new Error("Simple haloalkane names should parse to one derivative structure");
}

const namedDibromide = app.analyzeQuery("1,1-dibromopentane", "auto");
if (
  namedDibromide.status !== "ok" ||
  namedDibromide.family !== "haloalkane" ||
  namedDibromide.formula !== "C5H10Br2" ||
  namedDibromide.isomers.length !== 1 ||
  namedDibromide.isomers[0].attachments.length !== 2
) {
  throw new Error("Polyhaloalkane names with repeated locants should parse to one derivative structure");
}

const branchedChloroalkane = app.analyzeQuery("2-Chloro-4-ethyl-3-methylhexane", "auto");
if (
  branchedChloroalkane.status !== "ok" ||
  branchedChloroalkane.family !== "haloalkane" ||
  branchedChloroalkane.formula !== "C9H19Cl" ||
  branchedChloroalkane.isomers.length !== 1 ||
  branchedChloroalkane.isomers[0].adjacency.length !== 9 ||
  branchedChloroalkane.isomers[0].attachments.length !== 1
) {
  throw new Error("Branched haloalkane names should parse alkyl and halogen prefixes together");
}

const alcoholFormula = app.analyzeQuery("C2H5OH", "auto");
if (
  alcoholFormula.status !== "ok" ||
  alcoholFormula.family !== "alcohol" ||
  alcoholFormula.formula !== "C2H6O" ||
  alcoholFormula.isomers[0].name !== "ethanol"
) {
  throw new Error("Alcohol group formulas such as C2H5OH should resolve to alcohol structures");
}

const butanolFormula = app.analyzeQuery("C4H10O", "auto");
if (
  butanolFormula.status !== "ok" ||
  butanolFormula.family !== "alcohol" ||
  butanolFormula.isomers.length !== 4 ||
  !butanolFormula.isomers.some((isomer) => isomer.name === "butan-2-ol")
) {
  throw new Error("Alcohol formulas should enumerate saturated alcohol isomers");
}

const bromoDiagram = app.buildDiagramSvg(
  namedBromide.isomers[0].adjacency,
  namedBromide.isomers[0].chain,
  namedBromide.isomers[0].edgeOrders,
  "atom",
  namedBromide.isomers[0].attachments
);
if (!bromoDiagram.includes(">Br<") || !bromoDiagram.includes("hetero-br")) {
  throw new Error("Derivative diagrams should render hetero atom labels");
}

const dibromoDiagram = app.buildDiagramSvg(
  namedDibromide.isomers[0].adjacency,
  namedDibromide.isomers[0].chain,
  namedDibromide.isomers[0].edgeOrders,
  "atom",
  namedDibromide.isomers[0].attachments
);
if ((dibromoDiagram.match(/>Br</g) || []).length !== 2) {
  throw new Error("Polyhaloalkane diagrams should render each halogen attachment");
}

const bromoModel = app.molecule3DModel(namedBromide.isomers[0]);
if (!bromoModel.atoms.some((atom) => atom.element === "Br") || !bromoModel.bonds.length) {
  throw new Error("3D molecule models should include derivative hetero atoms and bonds");
}

console.log("All tests passed.");
