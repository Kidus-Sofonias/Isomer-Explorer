import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const sandbox = createContext({});
sandbox.self = sandbox;
function load(name) {
  runInContext(readFileSync(name, "utf8"), sandbox);
}

// Load every engine module into the same context so app.js sees the
// populated HydrocarbonEngineAlgorithms registry.
load("chemengine/formula.js");
load("chemengine/family-rules.js");
load("chemengine/graph-model.js");
load("chemengine/families/alkene-alkyne.js");
load("chemengine/families/alkane.js");
load("chemengine/families/alkene.js");
load("chemengine/families/alkyne.js");
load("chemengine/families/alcohol.js");
load("chemengine/families/amine.js");
load("chemengine/families/aromatic.js");
load("chemengine/families/bicyclic.js");
load("chemengine/families/cycloalkane.js");
load("chemengine/families/cycloalkene.js");
load("chemengine/families/diene.js");
load("chemengine/families/fused-aromatic.js");
load("chemengine/families/haloalkane.js");
load("chemengine/families/substituted-alkane.js");
load("chemengine/families/ether.js");
load("chemengine/families/ester.js");
load("chemengine/families/carboxylic-acid.js");
load("chemengine/families/aldehyde.js");
load("chemengine/families/ketone.js");
load("chemengine/families/nitrile.js");
load("chemengine/families/amide.js");
load("chemengine/families/nitro.js");
load("app.js");

const formulaCore = sandbox.HydrocarbonEngineAlgorithms.formula(["F", "Cl", "Br", "I"]);
const familyRules = sandbox.HydrocarbonEngineAlgorithms.familyRules({
  MAX_CARBONS: 12,
  HALOGENS: ["F", "Cl", "Br", "I"]
});
assert.equal(formulaCore.parseFormula("C5H11Br").formula, "C5H11Br");
assert.equal(formulaCore.parseFormula("C\u2082H\u2086O").formula, "C2H6O");
assert.equal(formulaCore.isFormulaInput("C5H12"), true);
assert.equal(familyRules.detectFamily(formulaCore.parseFormula("C14H10")), "fused_aromatic");
assert.equal(familyRules.expectedHydrogenForFamily(8, "diene"), 14);
assert.equal(familyRules.formulaMatchesFamily(formulaCore.parseFormula("C5H11Br"), "haloalkane"), true);

const engine = sandbox.HydrocarbonApp;
assert.ok(engine, "The chemistry engine should expose its API");

for (const familyModule of [
  "alkane",
  "familyRules",
  "formula",
  "graphModel",
  "alkeneAlkyne",
  "alkene",
  "alkyne",
  "alcohol",
  "amine",
  "aromatic",
  "bicyclic",
  "cycloalkane",
  "cycloalkene",
  "diene",
  "fusedAromatic",
  "haloalkane",
  "substitutedAlkane",
  "ether",
  "ester",
  "carboxylicAcid",
  "aldehyde",
  "ketone",
  "nitrile",
  "nitro",
  "amide"
]) {
  assert.equal(typeof sandbox.HydrocarbonEngineAlgorithms[familyModule], "function", `${familyModule} algorithm module should load`);
}

const serviceWorker = readFileSync("service-worker.js", "utf8");
for (const asset of [
  "./molecule-viewer-3d.js",
  "./chemengine/formula.js",
  "./chemengine/family-rules.js",
  "./chemengine/graph-model.js",
  "./chemengine/families/alkane.js",
  "./chemengine/families/alkene-alkyne.js",
  "./chemengine/families/alkene.js",
  "./chemengine/families/alkyne.js",
  "./chemengine/families/alcohol.js",
  "./chemengine/families/amine.js",
  "./chemengine/families/aromatic.js",
  "./chemengine/families/bicyclic.js",
  "./chemengine/families/cycloalkane.js",
  "./chemengine/families/cycloalkene.js",
  "./chemengine/families/diene.js",
  "./chemengine/families/fused-aromatic.js",
  "./chemengine/families/haloalkane.js",
  "./chemengine/families/substituted-alkane.js",
  "./chemengine/families/ether.js",
  "./chemengine/families/ester.js",
  "./chemengine/families/carboxylic-acid.js",
  "./chemengine/families/aldehyde.js",
  "./chemengine/families/ketone.js",
  "./chemengine/families/nitrile.js",
  "./chemengine/families/nitro.js",
  "./chemengine/families/amide.js"
]) {
  assert.ok(serviceWorker.includes(`"${asset}"`), `${asset} should be precached for offline use`);
}

const graphModel = sandbox.HydrocarbonEngineAlgorithms.graphModel([]);
const alcoholGraphAtoms = [
  graphModel.makeAtom("C", "carbon"),
  graphModel.makeAtom("O", "oxygen")
];
const alcoholGraphBonds = [graphModel.makeBond(0, 1)];
const alcoholGraphAdjacency = graphModel.adjacencyFromAtomsBonds(alcoholGraphAtoms, alcoholGraphBonds);
const alcoholGraphReport = graphModel.validateMolecule(alcoholGraphAtoms, alcoholGraphBonds, {
  formula: "CH4O"
});
assert.equal(alcoholGraphReport.ok, true, "Stable atom ids should not interfere with index-based bonds");
assert.equal(alcoholGraphReport.formula, "CH4O", "Implicit oxygen hydrogens should contribute to formula");
assert.equal(graphModel.valenceOkForAtom(alcoholGraphAtoms[0], alcoholGraphBonds, alcoholGraphAdjacency, 0), true);
assert.doesNotThrow(() => graphModel.canonicalAtomSignature(
  alcoholGraphAtoms,
  alcoholGraphBonds,
  alcoholGraphAdjacency
));
assert.equal(graphModel.validateMolecule([
  graphModel.makeAtom("C", "overvalent-carbon", { hydrogens: 5 })
], [], {}).ok, false, "Explicit implicit-hydrogen counts must obey valence");

const ammoniumAtoms = [
  graphModel.makeAtom("N", "nitrogen", { charge: 1 }),
  graphModel.makeAtom("H", "hydrogen-1"),
  graphModel.makeAtom("H", "hydrogen-2"),
  graphModel.makeAtom("H", "hydrogen-3"),
  graphModel.makeAtom("H", "hydrogen-4")
];
const ammoniumBonds = [1, 2, 3, 4].map((hydrogen) => graphModel.makeBond(0, hydrogen));
assert.equal(graphModel.validateMolecule(ammoniumAtoms, ammoniumBonds, {
  formula: "H4N"
}).ok, true, "A positively charged tetravalent nitrogen should be valid");

for (const [formula, family, expectedCount] of [
  ["C4H10O", "ether", 3],
  ["C4H8O2", "ester", 4],
  ["C5H10O2", "ester", 9],
  ["C6H12O2", "ester", 20],
  ["C5H10O2", "carboxylic acid", 4],
  ["C5H10O", "aldehyde", 4],
  ["C7H14O", "aldehyde", 17],
  ["C6H12O", "ketone", 6],
  ["C5H9N", "nitrile", 4],
  ["C4H9NO2", "nitro", 4],
  ["C5H11NO2", "nitro", 8],
  ["C5H11NO", "amide", 4]
]) {
  const analysis = engine.analyzeFormula(formula, family);
  assert.equal(analysis.status, "ok", `${formula} should be supported as ${family}`);
  assert.equal(analysis.isomers.length, expectedCount, `${formula} ${family} count`);
  for (const isomer of analysis.isomers) {
    assert.equal(isomer.formula, formula, `${isomer.name} should conserve ${formula}`);
    assert.ok(isomer.name, `${family} structures should be named`);
  }
}

const nitroModel = engine.molecule3DModel(engine.analyzeFormula("CH3NO2", "nitro").isomers[0]);
const nitroNitrogen = nitroModel.atoms.findIndex((atom) => atom.element === "N");
assert.equal(nitroModel.atoms[nitroNitrogen].charge, 1, "Nitro nitrogen should carry its formal positive charge");
const nitroOxygenBonds = nitroModel.bonds.filter((bond) =>
  (bond.from === nitroNitrogen && nitroModel.atoms[bond.to].element === "O") ||
  (bond.to === nitroNitrogen && nitroModel.atoms[bond.from].element === "O")
);
assert.deepEqual([...nitroOxygenBonds].map((bond) => bond.order).sort(), [1, 2]);
assert.equal(nitroOxygenBonds.some((bond) =>
  nitroModel.atoms[bond.from === nitroNitrogen ? bond.to : bond.from].charge === -1
), true, "The single-bonded nitro oxygen should carry its formal negative charge");

const alkaneCounts = [1, 1, 1, 2, 3, 5, 9, 18, 35, 75, 159, 355];
for (let carbon = 1; carbon <= alkaneCounts.length; carbon += 1) {
  const analysis = engine.analyzeFormula(`C${carbon === 1 ? "" : carbon}H${2 * carbon + 2}`, "alkane");
  assert.equal(analysis.status, "ok", `C${carbon} alkane should be supported`);
  assert.equal(analysis.isomers.length, alkaneCounts[carbon - 1], `C${carbon} alkane count`);
}

for (const [formula, family, expectedCount] of [
  ["C4H6", "diene", 2],
  ["C5H8", "diene", 6],
  ["C6H10", "diene", 16],
  ["C7H12", "diene", 44],
  ["C8H14", "diene", 120],
  ["C9H16", "diene", 328],
  ["C10H18", "diene", 901],
  ["C4H6", "cycloalkene", 3],
  ["C5H8", "cycloalkene", 8],
  ["C6H10", "cycloalkene", 21],
  ["C7H12", "cycloalkene", 55],
  ["C8H14", "cycloalkene", 147],
  ["C9H16", "cycloalkene", 391],
  ["C10H18", "cycloalkene", 1054],
  ["C5H10", "cycloalkane", 5],
  ["C5H8", "bicyclic", 5],
  ["C6H10", "bicyclic", 17],
  ["C7H12", "bicyclic", 56],
  ["C10H8", "fused_aromatic", 1],
  ["C14H10", "fused_aromatic", 2]
]) {
  const analysis = engine.analyzeFormula(formula, family);
  assert.equal(analysis.status, "ok", `${formula} should be supported as ${family}`);
  assert.equal(analysis.isomers.length, expectedCount, `${formula} ${family} count`);
}

const supportedCases = [
  ["CH4", "alkane"],
  ["C4H8", "alkene"],
  ["C4H6", "alkyne"],
  ["C5H10", "cycloalkane"],
  ["C4H6", "cycloalkene"],
  ["C5H8", "cycloalkene"],
  ["C6H10", "cycloalkene"],
  ["C7H12", "cycloalkene"],
  ["C8H14", "cycloalkene"],
  ["C9H16", "cycloalkene"],
  ["C10H18", "cycloalkene"],
  ["C5H8", "bicyclic"],
  ["C6H10", "bicyclic"],
  ["C7H12", "bicyclic"],
  ["C10H8", "fused_aromatic"],
  ["C14H10", "fused_aromatic"],
  ["C4H6", "diene"],
  ["C5H8", "diene"],
  ["C6H10", "diene"],
  ["C7H12", "diene"],
  ["C8H14", "diene"],
  ["C9H16", "diene"],
  ["C10H18", "diene"],
  ["C5H8", "bicyclic"],
  ["C10H8", "fused_aromatic"],
  ["C14H10", "fused_aromatic"],
  ["C7H8", "aromatic"],
  ["C3H7Cl", "haloalkane"],
  ["C3H8O", "alcohol"],
  ["C3H9N", "amine"]
];

for (const [formula, family] of supportedCases) {
  const analysis = engine.analyzeFormula(formula, family);
  assert.equal(analysis.status, "ok", `${formula} should be supported as ${family}`);
  assert.equal(analysis.formula, formula, `${family} should preserve the parsed molecular formula`);
  assert.ok(analysis.isomers.length > 0, `${family} should return at least one structure`);
  for (const isomer of analysis.isomers) {
    const model = engine.molecule3DModel(isomer);
    const modelElements = { C: 0, H: 0, N: 0, Br: 0, Cl: 0, F: 0, I: 0, O: 0 };
    const modelValences = model.atoms.map(() => 0);
    for (const atom of model.atoms) {
      modelElements[atom.element] = (modelElements[atom.element] || 0) + 1;
    }
    for (const bond of model.bonds) {
      assert.ok(model.atoms[bond.from] && model.atoms[bond.to], `${isomer.name} 3D bonds should reference existing atoms`);
      modelValences[bond.from] += bond.order || 1;
      modelValences[bond.to] += bond.order || 1;
    }
    const parsedElements = engine.parseFormula(formula).elements;
    for (const element of Object.keys(parsedElements)) {
      assert.equal(modelElements[element] || 0, parsedElements[element] || 0, `${isomer.name} 3D model should conserve ${element} in ${formula}`);
    }
    for (let atomIndex = 0; atomIndex < model.atoms.length; atomIndex += 1) {
      const element = model.atoms[atomIndex].element;
      const maximumValence = element === "C" ? 4 : element === "O" ? 2 : element === "N" ? 3 : 1;
      assert.ok(modelValences[atomIndex] <= maximumValence, `${isomer.name} ${element} valence should be valid`);
    }
    if (isomer.formula) {
      assert.equal(isomer.formula, formula, `${isomer.name} should conserve ${formula}`);
    } else if (["alkane", "alkene", "alkyne", "diene"].includes(family)) {
      let hydrogen = 0;
      for (let atom = 0; atom < isomer.adjacency.length; atom += 1) {
        let valence = 0;
        for (const neighbor of isomer.adjacency[atom]) {
          const edge = `${Math.min(atom, neighbor)}-${Math.max(atom, neighbor)}`;
          valence += isomer.edgeOrders ? isomer.edgeOrders.get(edge) || 1 : 1;
        }
        hydrogen += 4 - valence;
      }
      const graphFormula = `${analysis.carbon === 1 ? "C" : `C${analysis.carbon}`}${hydrogen === 1 ? "H" : `H${hydrogen}`}`;
      assert.equal(graphFormula, formula, `${isomer.name} graph should conserve ${formula}`);
    } else if (family === "cycloalkane" || family === "cycloalkene") {
      const ringAdjacency = isomer.adjacency.map((neighbors) => neighbors.slice());
      ringAdjacency[isomer.ringBond[0]].push(isomer.ringBond[1]);
      ringAdjacency[isomer.ringBond[1]].push(isomer.ringBond[0]);
      let hydrogen = 0;
      for (let atom = 0; atom < ringAdjacency.length; atom += 1) {
        let valence = 0;
        for (const neighbor of ringAdjacency[atom]) {
          const edge = `${Math.min(atom, neighbor)}-${Math.max(atom, neighbor)}`;
          valence += isomer.edgeOrders ? isomer.edgeOrders.get(edge) || 1 : 1;
        }
        hydrogen += 4 - valence;
      }
      const ringFormula = `${analysis.carbon === 1 ? "C" : `C${analysis.carbon}`}H${hydrogen}`;
      assert.equal(ringFormula, formula, `${isomer.name} ring should conserve ${formula}`);
    } else if (family === "aromatic") {
      const aromaticFormula = `C${analysis.carbon}H${analysis.carbon * 2 - 6}`;
      assert.equal(aromaticFormula, formula, `${isomer.name} aromatic ring should conserve ${formula}`);
    }
    assert.equal(isomer.family, family, `${isomer.name} should have the selected family`);
    assert.ok(!isomer.name.includes("undefined"), `${isomer.name} should be fully named`);
  }
}

const amines = [...engine.analyzeFormula("C3H9N", "amine").isomers].map((isomer) => isomer.name);
assert.deepEqual(amines, ["propan-1-amine", "propan-2-amine"]);
assert.equal(engine.analyzeName("methylamine").status, "ok");
assert.equal(engine.analyzeName("buta-1,3-diene").status, "ok");
assert.equal(engine.analyzeName("cyclobut-1-ene").status, "ok");
assert.equal(engine.analyzeName("naphthalene").status, "ok");
assert.equal(engine.analyzeName("anthracene").status, "ok");
assert.equal(engine.analyzeName("nitromethane").isomers[0].name, "nitromethane");
for (const [name, formula] of [
  ["2,2,3,3-tetramethylbutane", "C8H18"],
  ["2,3-dimethylhexa-1,3-diene", "C8H14"],
  ["1,2,3,3-tetramethylcyclobut-1-ene", "C8H14"],
  ["1,2,4-trimethylbenzene", "C9H12"],
  ["1,2,3,4-tetramethylbenzene", "C10H14"],
  ["bicyclo[2.1.0]pentane", "C5H8"]
]) {
  const analysis = engine.analyzeName(name);
  assert.equal(analysis.status, "ok", `${name} should be supported as an example`);
  assert.equal(analysis.formula, formula, `${name} should have the displayed formula`);
}
for (const formula of ["C10H8", "C14H10"]) {
  const automaticAnalysis = engine.analyzeFormula(formula);
  assert.equal(automaticAnalysis.status, "ok", `${formula} should be detected automatically`);
  assert.equal(automaticAnalysis.family, "fused_aromatic", `${formula} should be identified as a fused aromatic`);
}
assert.equal(engine.analyzeFormula("C15H12", "fused_aromatic").status, "unsupported");

for (const [formula, family] of [
  ["C11H20", "diene"],
  ["C11H20", "cycloalkene"],
  ["C8H14", "bicyclic"],
  ["C4H8", "general_hydrocarbon"],
  ["C2H8N2", "general_heteroatom"]
]) {
  const analysis = engine.analyzeFormula(formula, family);
  assert.equal(analysis.status, "unsupported", `${formula} should not return unverified ${family} structures`);
  assert.ok(analysis.message, "Unsupported families should explain why results are unavailable");
}

for (const name of ["acetone", "ethanoic acid", "diethyl ether"]) {
  const analysis = engine.analyzeName(name);
  assert.equal(analysis.status, "ok", `${name} should now resolve to a structure`);
  assert.ok(analysis.isomers && analysis.isomers.length > 0, `${name} should return at least one structure`);
}

assert.equal(engine.analyzeFormula("C2H4", "cycloalkane").status, "unsupported");
assert.equal(engine.analyzeFormula("C3H4", "cycloalkene").status, "unsupported");
assert.equal(engine.analyzeFormula("C2H8N2").status, "unsupported", "Multiple nitrogen atoms must be included in DBE validation");
assert.throws(() => engine.parseFormula("C2H999999999999999999999999"), /Element counts/);

console.log("Chemistry engine tests passed.");
