import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const sandbox = {};
sandbox.self = sandbox;
runInNewContext(readFileSync(new URL("./chemengine/families/alkane.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/alkene-alkyne.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/alkene.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/alkyne.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/alcohol.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/amine.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/aromatic.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/bicyclic.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/cycloalkane.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/cycloalkene.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/diene.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/fused-aromatic.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/haloalkane.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./chemengine/families/substituted-alkane.js", import.meta.url), "utf8"), sandbox);
runInNewContext(readFileSync(new URL("./app.js", import.meta.url), "utf8"), sandbox);

const engine = sandbox.HydrocarbonApp;
assert.ok(engine, "The chemistry engine should expose its API");
for (const familyModule of [
  "alkane",
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
  "substitutedAlkane"
]) {
  assert.equal(typeof sandbox.HydrocarbonEngineAlgorithms[familyModule], "function", `${familyModule} algorithm module should load`);
}

const serviceWorker = readFileSync(new URL("./service-worker.js", import.meta.url), "utf8");
for (const asset of [
  "./molecule-viewer-3d.js",
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
  "./chemengine/families/substituted-alkane.js"
]) {
  assert.ok(serviceWorker.includes(`"${asset}"`), `${asset} should be precached for offline use`);
}

const alkaneCounts = [1, 1, 1, 2, 3, 5, 9, 18, 35, 75, 159, 355];
for (let carbon = 1; carbon <= alkaneCounts.length; carbon += 1) {
  const analysis = engine.analyzeFormula(`C${carbon === 1 ? "" : carbon}H${2 * carbon + 2}`, "alkane");
  assert.equal(analysis.status, "ok", `C${carbon} alkane should be supported`);
  assert.equal(analysis.isomers.length, alkaneCounts[carbon - 1], `C${carbon} alkane count`);
}

for (const [formula, family, expectedCount] of [
  ["C4H6", "diene", 2],
  ["C5H8", "diene", 6],
  ["C4H6", "cycloalkene", 3],
  ["C5H8", "cycloalkene", 8],
  ["C5H10", "cycloalkane", 5],
  ["C5H8", "bicyclic", 5],
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
  ["C8H14", "cycloalkene"],
  ["C5H8", "bicyclic"],
  ["C10H8", "fused_aromatic"],
  ["C14H10", "fused_aromatic"],
  ["C4H6", "diene"],
  ["C5H8", "diene"],
  ["C8H14", "diene"],
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
  ["C2H4O", "aldehyde"],
  ["C2H4O2", "carboxylic acid"],
  ["C2H3N", "nitrile"],
  ["C9H16", "diene"],
  ["C9H16", "cycloalkene"],
  ["C6H10", "bicyclic"],
  ["C12H18", "bicyclic"],
  ["C4H8", "general_hydrocarbon"],
  ["C2H8N2", "general_heteroatom"]
]) {
  const analysis = engine.analyzeFormula(formula, family);
  assert.equal(analysis.status, "unsupported", `${formula} should not return unverified ${family} structures`);
  assert.ok(analysis.message, "Unsupported families should explain why results are unavailable");
}

for (const name of ["acetone", "ethanoic acid", "diethyl ether"]) {
  const analysis = engine.analyzeName(name);
  assert.equal(analysis.status, "unsupported", `${name} should not return an unverified structure`);
  assert.ok(analysis.message, "Unsupported named families should explain why results are unavailable");
}

assert.equal(engine.analyzeFormula("C2H4", "cycloalkane").status, "unsupported");
assert.equal(engine.analyzeFormula("C3H4", "cycloalkene").status, "unsupported");
assert.equal(engine.analyzeFormula("C2H8N2").status, "unsupported", "Multiple nitrogen atoms must be included in DBE validation");
assert.throws(() => engine.parseFormula("C2H999999999999999999999999"), /Element counts/);

console.log("Chemistry engine tests passed.");
