(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root.HydrocarbonEngineAlgorithms);
  } else {
    root.HydrocarbonApp = factory(root.HydrocarbonEngineAlgorithms);
  }

})(typeof self !== "undefined" ? self : this, function (algorithmModules) {
  "use strict";    if (!algorithmModules ||
      typeof algorithmModules.alkane !== "function" ||
      typeof algorithmModules.alkeneAlkyne !== "function" ||
      typeof algorithmModules.alkene !== "function" ||
      typeof algorithmModules.alkyne !== "function" ||
      typeof algorithmModules.alcohol !== "function" ||
      typeof algorithmModules.amine !== "function" ||
      typeof algorithmModules.aromatic !== "function" ||
      typeof algorithmModules.bicyclic !== "function" ||
      typeof algorithmModules.cycloalkane !== "function" ||
      typeof algorithmModules.cycloalkene !== "function" ||
      typeof algorithmModules.diene !== "function" ||
      typeof algorithmModules.fusedAromatic !== "function" ||
      typeof algorithmModules.familyRules !== "function" ||
      typeof algorithmModules.haloalkane !== "function" ||
      typeof algorithmModules.formula !== "function" ||
      typeof algorithmModules.substitutedAlkane !== "function" ||
      typeof algorithmModules.ether !== "function" ||
      typeof algorithmModules.ester !== "function" ||
      typeof algorithmModules.carboxylicAcid !== "function" ||
      typeof algorithmModules.aldehyde !== "function" ||
      typeof algorithmModules.ketone !== "function" ||
      typeof algorithmModules.nitrile !== "function" ||
      typeof algorithmModules.amide !== "function" ||
      typeof algorithmModules.nitro !== "function") {
    throw new Error("Chemistry family algorithms were not loaded before the application.");
  }

  var MAX_CARBONS = 12;
  var MAX_CACHE_SIZE = 500;
  var plantedCache = new Map();
  var rootCache = new Map();
  var aromaticCache = new Map();
  var nameIndexCache = null;  // Families whose generators we have verified against known counts and
  // formulas. Every one of these builds real hetero-atom graphs (ether
  // bridges, carbonyls, nitrile triples, nitro units) and passes the shared
  // molecule-model validation gate (see validateEnumeratedIsomers), so each
  // enumerated structure is checked element-by-element for formula, valence,
  // and connectivity before it is ever displayed or named. Families left out
  // (the general_hydrocarbon / general_heteroatom catch-alls) stay gated:
  // their combinatorics are unbounded, so we report unsupported instead of
  // presenting unverified structures.
  var ENUMERATED_FAMILIES = {
    alkane: true,
    alkene: true,
    alkyne: true,
    cycloalkane: true,
    cycloalkene: true,
    diene: true,
    bicyclic: true,
    fused_aromatic: true,
    aromatic: true,
    haloalkane: true,
    alcohol: true,
    amine: true,
    ether: true,
    ester: true,
    "carboxylic acid": true,
    aldehyde: true,
    ketone: true,
    nitrile: true,
    nitro: true,
    amide: true
  };

  function pruneCache(cache) {
    if (cache.size > MAX_CACHE_SIZE) {
      var keysToDelete = [];
      cache.forEach(function (_, key) {
        keysToDelete.push(key);
        if (keysToDelete.length >= cache.size - MAX_CACHE_SIZE) {
          return;
        }
      });
      keysToDelete.forEach(function (key) {
        cache.delete(key);
      });
    }
  }

  var FAMILY_INFO = {
    alkane: {
      label: "Alkane",
      description: "Saturated acyclic hydrocarbons with only single carbon-carbon bonds.",
      pattern: "CnH2n+2"
    },
    alkene: {
      label: "Alkene",
      description: "Acyclic monoalkenes with one carbon-carbon double bond. Cis/trans stereoisomers are not counted separately.",
      pattern: "CnH2n"
    },
    alkyne: {
      label: "Alkyne",
      description: "Acyclic monoalkynes with one carbon-carbon triple bond.",
      pattern: "CnH2n-2"
    },
    cycloalkane: {
      label: "Cycloalkane",
      description: "Saturated monocyclic hydrocarbons with only single carbon-carbon bonds.",
      pattern: "CnH2n"
    },
    aromatic: {
      label: "Aromatic",
      description: "Single benzene-ring alkyl aromatics. Positional isomers around the ring are counted.",
      pattern: "CnH2n-6"
    },
    haloalkane: {
      label: "Haloalkane",
      description: "Saturated alkyl halides with one F, Cl, Br, or I substituent.",
      pattern: "CnH2n+1X"
    },
    alcohol: {
      label: "Alcohol",
      description: "Saturated monohydric alcohols with one OH group. Ether isomers are not included.",
      pattern: "CnH2n+2O"
    },
    ester: {
      label: "Ester",
      description: "Saturated monoesters with one carboxylate group (-COOR). Positional isomers vary the carbon skeleton.",
      pattern: "CnH2nO2"
    },
    ether: {
      label: "Ether",
      description: "Saturated monoethers with one C-O-C linkage. Positional isomers vary the chain and oxygen position.",
      pattern: "CnH2n+2O"
    },
    "carboxylic acid": {
      label: "Carboxylic Acid",
      description: "Saturated monocarboxylic acids with one -COOH group.",
      pattern: "CnH2nO2"
    },
    aldehyde: {
      label: "Aldehyde",
      description: "Saturated monoaldehydes with one -CHO group at the end of a chain.",
      pattern: "CnH2nO"
    },
    ketone: {
      label: "Ketone",
      description: "Saturated monoketones with one C=O group within a chain.",
      pattern: "CnH2nO"
    },
    amine: {
      label: "Amine",
      description: "Saturated primary monoamines with one -NH2 group.",
      pattern: "CnH2n+3N"
    },
    cycloalkene: {
      label: "Cycloalkene",
      description: "Monocyclic hydrocarbons with one ring and one carbon-carbon double bond; stereoisomers are not counted separately. Enumeration covers C4–C10.",
      pattern: "CnH2n-2"
    },
    diene: {
      label: "Diene",
      description: "Acyclic hydrocarbons with exactly two carbon-carbon double bonds; stereoisomers are not counted separately. Enumeration covers C4–C10.",
      pattern: "CnH2n-2"
    },
    bicyclic: {
      label: "Bicyclic",
      description: "Saturated carbon-only skeletons with exactly two rings, including bridged, fused, and spiro arrangements. Enumeration covers C5–C7; beyond that, the combinatorics grow faster than the interactive budget, so the app reports unsupported to stay honest and responsive.",
      pattern: "CnH2n-2"
    },
    fused_aromatic: {
      label: "Fused Aromatic",
      description: "Fused benzenoid ring systems: naphthalene, anthracene, and phenanthrene.",
      pattern: "Selected fused-ring aromatic structures"
    },
    nitrile: {
      label: "Nitrile",
      description: "Saturated nitriles with one -C\u2261N group.",
      pattern: "CnH2n-1N"
    },
    nitro: {
      label: "Nitro",
      description: "Saturated nitroalkanes with one -NO2 group.",
      pattern: "CnH2n+1NO2"
    },
    amide: {
      label: "Amide",
      description: "Saturated monocarboxamides with one -CONH2 group.",
      pattern: "CnH2n+1NO"
    },
    general_hydrocarbon: {
      label: "Hydrocarbon",
      description: "Generic hydrocarbon with rings and/or multiple bonds not matching standard families.",
      pattern: "CnHm"
    },
    general_heteroatom: {
      label: "Heterocompound",
      description: "Generic organic compound with heteroatoms not matching standard functional families.",
      pattern: "CnHmOxNyXz"
    }
  };

  var HALOGENS = ["F", "Cl", "Br", "I"];
  var familyRules = algorithmModules.familyRules({
    MAX_CARBONS: MAX_CARBONS,
    HALOGENS: HALOGENS
  });
  var expectedHydrogenForFamily = familyRules.expectedHydrogenForFamily;
  var familyMinimumCarbon = familyRules.familyMinimumCarbon;
  var familyMaximumCarbon = familyRules.familyMaximumCarbon;
  var halogenElements = familyRules.halogenElements;
  var hasOnlyCarbonHydrogen = familyRules.hasOnlyCarbonHydrogen;
  var formulaMatchesFamily = familyRules.formulaMatchesFamily;
  var detectFamily = familyRules.detectFamily;
  var detectFamilyCandidates = familyRules.detectFamilyCandidates;
  var formulaElementsForFamily = familyRules.formulaElementsForFamily;
  var HALOGEN_PREFIXES = {
    F: "fluoro",
    Cl: "chloro",
    Br: "bromo",
    I: "iodo"
  };
  var HALOGEN_BY_PREFIX = {
    fluoro: "F",
    chloro: "Cl",
    bromo: "Br",
    iodo: "I"
  };

  var BENZENE_SUBSTITUENT_GROUPS = {
    fluoro: { code: "fluoro", size: 0, name: "fluoro", sortKey: "fluoro", label: "F", extraElements: { F: 1 }, extraHydrogens: 0 },
    chloro: { code: "chloro", size: 0, name: "chloro", sortKey: "chloro", label: "Cl", extraElements: { Cl: 1 }, extraHydrogens: 0 },
    bromo: { code: "bromo", size: 0, name: "bromo", sortKey: "bromo", label: "Br", extraElements: { Br: 1 }, extraHydrogens: 0 },
    iodo: { code: "iodo", size: 0, name: "iodo", sortKey: "iodo", label: "I", extraElements: { I: 1 }, extraHydrogens: 0 },
    hydroxy: { code: "hydroxy", size: 0, name: "hydroxy", sortKey: "hydroxy", label: "OH", extraElements: { O: 1 }, extraHydrogens: 1 },
    amino: { code: "amino", size: 0, name: "amino", sortKey: "amino", label: "NH\u2082", extraElements: { N: 1 }, extraHydrogens: 2 },
    carboxy: { code: "carboxy", size: 1, name: "carboxy", sortKey: "carboxy", label: "COOH", extraElements: { O: 2 }, extraHydrogens: 1 },
    formyl: { code: "formyl", size: 1, name: "formyl", sortKey: "formyl", label: "CHO", extraElements: { O: 1 }, extraHydrogens: 1 },
    acetyl: { code: "acetyl", size: 2, name: "acetyl", sortKey: "acetyl", label: "COCH\u2083", extraElements: { O: 1 }, extraHydrogens: 3 },
    methoxy: { code: "methoxy", size: 1, name: "methoxy", sortKey: "methoxy", label: "OCH\u2083", extraElements: { O: 1 }, extraHydrogens: 3 },
    nitro: { code: "nitro", size: 0, name: "nitro", sortKey: "nitro", label: "NO\u2082", extraElements: { N: 1, O: 2 }, extraHydrogens: 0 }
  };

  var ORTHO_META_PARA_MAP = {
    o: 2,
    ortho: 2,
    m: 3,
    meta: 3,
    p: 4,
    para: 4
  };

  var STEMS = [
    "",
    "meth",
    "eth",
    "prop",
    "but",
    "pent",
    "hex",
    "hept",
    "oct",
    "non",
    "dec",
    "undec",
    "dodec"
  ];

  var EXTENDED_STEMS = {
    meth: 1,
    eth: 2,
    prop: 3,
    but: 4,
    pent: 5,
    hex: 6,
    hept: 7,
    oct: 8,
    non: 9,
    dec: 10,
    undec: 11,
    dodec: 12,
    tridec: 13,
    tetradec: 14,
    pentadec: 15,
    hexadec: 16,
    heptadec: 17,
    octadec: 18,
    nonadec: 19,
    eicos: 20
  };

  var EXTENDED_STEMS_REVERSE = Object.fromEntries(Object.entries(EXTENDED_STEMS).map(function (_ref) {
    var k = _ref[0];
    var v = _ref[1];
    return [v, k];
  }));

  var ALKYL_LENGTHS = {
    methyl: 1,
    ethyl: 2,
    propyl: 3,
    butyl: 4,
    pentyl: 5,
    hexyl: 6,
    heptyl: 7,
    octyl: 8,
    nonyl: 9,
    decyl: 10,
    undecyl: 11,
    dodecyl: 12
  };

  var BRANCHED_SUBSTITUENT_INFO = {
    isopropyl: { carbons: 3, sortKey: "isopropyl" },
    isobutyl: { carbons: 4, sortKey: "isobutyl" },
    "sec-butyl": { carbons: 4, sortKey: "sec-butyl" },
    "tert-butyl": { carbons: 4, sortKey: "tert-butyl" },
    neopentyl: { carbons: 5, sortKey: "neopentyl" }
  };

  var ALL_BRANCHES_PATTERN = "isopropyl|isobutyl|sec\\u2011butyl|tert\\u2011butyl|neopentyl";

  var MULTIPLIER_COUNTS = {
    di: 2,
    tri: 3,
    tetra: 4,
    penta: 5,
    hexa: 6,
    hepta: 7,
    octa: 8,
    nona: 9,
    deca: 10
  };

  var ALKANE_NAMES = [
    "",
    "methane",
    "ethane",
    "propane",
    "butane",
    "pentane",
    "hexane",
    "heptane",
    "octane",
    "nonane",
    "decane",
    "undecane",
    "dodecane"
  ];

  var ALKYL_NAMES = [
    "",
    "methyl",
    "ethyl",
    "propyl",
    "butyl",
    "pentyl",
    "hexyl",
    "heptyl",
    "octyl",
    "nonyl",
    "decyl",
    "undecyl",
    "dodecyl"
  ];

  var COMMON_NAME_ALIASES = {
    butane: ["n-butane", "normal butane"],
    "2-methylpropane": ["isobutane", "i-butane"],
    pentane: ["n-pentane", "normal pentane"],
    "2-methylbutane": ["isopentane", "i-pentane"],
    "2,2-dimethylpropane": ["neopentane", "neo-pentane"],
    hexane: ["n-hexane", "normal hexane"],
    "2-methylpentane": ["isohexane", "i-hexane"],
    "2,2-dimethylbutane": ["neohexane", "neo-hexane"],
    heptane: ["n-heptane", "normal heptane"],
    "2-methylhexane": ["isoheptane", "i-heptane"],
    "2,2-dimethylpentane": ["neoheptane", "neo-heptane"],
    octane: ["n-octane", "normal octane"],
    "2,2,4-trimethylpentane": ["isooctane", "iso-octane"],
    "2,2-dimethylhexane": ["neooctane", "neo-octane"],
    nonane: ["n-nonane", "normal nonane"],
    decane: ["n-decane", "normal decane"],
    undecane: ["n-undecane", "normal undecane"],
    dodecane: ["n-dodecane", "normal dodecane"],
    methylbenzene: ["toluene"],
    "1,2-dimethylbenzene": ["o-xylene", "ortho-xylene"],
    "1,3-dimethylbenzene": ["m-xylene", "meta-xylene"],
    "1,4-dimethylbenzene": ["p-xylene", "para-xylene"],
    "(1-methylethyl)benzene": ["isopropylbenzene", "cumene"],
    ethene: ["ethylene"],
    ethyne: ["acetylene"]
  };

  var FRIENDLY_NAME_GUIDANCE = {
    secbutane: {
      title: "sec-butane is a naming trap",
      message:
        "sec- is normally used for a butyl substituent attachment point, not a standalone alkane. For C4H10, use butane/n-butane for the straight chain or isobutane for the branched isomer.",
      hints: ["Try butane", "Try n-butane", "Try isobutane"]
    },
    secondarybutane: {
      title: "secondary butane is not a standard input",
      message:
        "People use secondary to describe a carbon environment. The displayable C4H10 names here are butane/n-butane and isobutane.",
      hints: ["Try butane", "Try isobutane"]
    },
    tertbutane: {
      title: "tert-butane is not a standalone alkane",
      message:
        "tert- is used for tert-butyl groups and related substituent names. For a C4 hydrocarbon, try butane or isobutane.",
      hints: ["Try butane", "Try isobutane"]
    }
  };

  var SIMPLE_MULTIPLIERS = [
    "",
    "",
    "di",
    "tri",
    "tetra",
    "penta",
    "hexa",
    "hepta",
    "octa",
    "nona",
    "deca"
  ];

  var COMPLEX_MULTIPLIERS = [
    "",
    "",
    "bis",
    "tris",
    "tetrakis",
    "pentakis",
    "hexakis",
    "heptakis",
    "octakis",
    "nonakis",
    "decakis"
  ];

  function normalizeName(input) {
    return String(input || "")
      .trim()
      .toLowerCase()
      .replace(/[‐‑‒–—]/g, "-")
      .replace(/\s+/g, "");
  }

  function looseNameKey(input) {
    return normalizeName(input).replace(/[(),-]/g, "");
  }

  var formulaCore = algorithmModules.formula(HALOGENS);
  var normalizeFormula = formulaCore.normalizeFormula;
  var isFormulaInput = formulaCore.isFormulaInput;
  var formatFormula = formulaCore.formatFormula;
  var formatMolecularFormula = formulaCore.formatMolecularFormula;
  var parseFormula = formulaCore.parseFormula;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function edgeKey(a, b) {
    return a < b ? a + "-" + b : b + "-" + a;
  }

  function getBondOrder(edgeOrders, a, b) {
    if (!edgeOrders) {
      return 1;
    }
    return edgeOrders.get(edgeKey(a, b)) || 1;
  }

  function weightedValence(adjacency, atom, edgeOrders) {
    var valence = 0;
    for (var i = 0; i < adjacency[atom].length; i += 1) {
      valence += getBondOrder(edgeOrders, atom, adjacency[atom][i]);
    }
    return valence;
  }

  function childPool(totalSize) {
    var pool = [];
    for (var size = 1; size <= totalSize; size += 1) {
      var forms = plantedForms(size);
      for (var i = 0; i < forms.length; i += 1) {
        pool.push({ code: forms[i], size: size });
      }
    }
    pool.sort(function (a, b) {
      return compareStrings(a.code, b.code) || a.size - b.size;
    });
    return pool;
  }

  function generateChildMultisets(totalSize, maxChildren) {
    if (totalSize === 0) {
      return [[]];
    }

    var pool = childPool(totalSize);
    var results = [];

    function walk(startIndex, remaining, chosen) {
      if (remaining === 0) {
        results.push(chosen.slice());
        return;
      }
      if (chosen.length >= maxChildren) {
        return;
      }

      for (var i = startIndex; i < pool.length; i += 1) {
        var item = pool[i];
        if (item.size > remaining) {
          continue;
        }
        chosen.push(item.code);
        walk(i, remaining - item.size, chosen);
        chosen.pop();
      }
    }

    walk(0, totalSize, []);
    return results;
  }

  function plantedForms(size) {
    if (plantedCache.has(size)) {
      return plantedCache.get(size);
    }

    var forms = new Set();
    var children = generateChildMultisets(size - 1, 3);
    for (var i = 0; i < children.length; i += 1) {
      forms.add("(" + children[i].join("") + ")");
    }

    var result = Array.from(forms).sort(compareStrings);
    plantedCache.set(size, result);
    return result;
  }

  function rootForms(size) {
    if (rootCache.has(size)) {
      return rootCache.get(size);
    }

    var forms = new Set();
    var children = generateChildMultisets(size - 1, 4);
    for (var i = 0; i < children.length; i += 1) {
      forms.add("(" + children[i].join("") + ")");
    }

    var result = Array.from(forms).sort(compareStrings);
    rootCache.set(size, result);
    return result;
  }

  function parseRootedTree(code) {
    var adjacency = [];

    function addNode() {
      adjacency.push([]);
      return adjacency.length - 1;
    }

    function parseAt(index, parent) {
      if (code[index] !== "(") {
        throw new Error("Invalid rooted tree code.");
      }

      var node = addNode();
      if (parent !== null) {
        adjacency[node].push(parent);
        adjacency[parent].push(node);
      }

      index += 1;
      while (code[index] === "(") {
        var parsed = parseAt(index, node);
        index = parsed.index;
      }

      if (code[index] !== ")") {
        throw new Error("Invalid rooted tree code.");
      }

      return { index: index + 1, node: node };
    }

    var parsed = parseAt(0, null);
    if (parsed.index !== code.length) {
      throw new Error("Invalid rooted tree code.");
    }
    return adjacency;
  }

  function rootedCanonical(adjacency, node, parent) {
    var childCodes = [];
    for (var i = 0; i < adjacency[node].length; i += 1) {
      var next = adjacency[node][i];
      if (next !== parent) {
        childCodes.push(rootedCanonical(adjacency, next, node));
      }
    }
    childCodes.sort(compareStrings);
    return "(" + childCodes.join("") + ")";
  }

  function treeCenters(adjacency) {
    var n = adjacency.length;
    if (n <= 2) {
      return Array.from({ length: n }, function (_, index) {
        return index;
      });
    }

    var degree = adjacency.map(function (neighbors) {
      return neighbors.length;
    });
    var leaves = [];
    for (var i = 0; i < n; i += 1) {
      if (degree[i] <= 1) {
        leaves.push(i);
      }
    }

    var remaining = n;
    while (remaining > 2) {
      if (leaves.length === 0) {
        // Graph has a cycle (all degrees >= 2). Fall back to all nodes as centers.
        return Array.from({ length: n }, function (_, index) {
          return index;
        });
      }
      var nextLeaves = [];
      remaining -= leaves.length;
      for (var l = 0; l < leaves.length; l += 1) {
        var leaf = leaves[l];
        degree[leaf] = 0;
        for (var j = 0; j < adjacency[leaf].length; j += 1) {
          var neighbor = adjacency[leaf][j];
          if (degree[neighbor] > 0) {
            degree[neighbor] -= 1;
            if (degree[neighbor] === 1) {
              nextLeaves.push(neighbor);
            }
          }
        }
      }
      leaves = nextLeaves;
    }

    return leaves;
  }

  function freeCanonical(adjacency) {
    var centers = treeCenters(adjacency);
    if (centers.length === 1) {
      return rootedCanonical(adjacency, centers[0], -1);
    }

    var left = rootedCanonical(adjacency, centers[0], centers[1]);
    var right = rootedCanonical(adjacency, centers[1], centers[0]);
    return "(" + [left, right].sort(compareStrings).join("") + ")";
  }

  var generateAlkaneIsomers = algorithmModules.alkane({
    MAX_CARBONS: MAX_CARBONS,
    rootForms: rootForms,
    parseRootedTree: parseRootedTree,
    freeCanonical: freeCanonical
  });

  function rootedCanonicalWeighted(adjacency, node, parent, edgeOrders, visited) {
    if (!visited) visited = new Set();
    if (visited.has(node)) return "";
    visited.add(node);
    var childCodes = [];
    for (var i = 0; i < adjacency[node].length; i += 1) {
      var next = adjacency[node][i];
      if (next !== parent) {
        childCodes.push(getBondOrder(edgeOrders, node, next) + rootedCanonicalWeighted(adjacency, next, node, edgeOrders));
      }
    }
    childCodes.sort(compareStrings);
    return "(" + childCodes.join("") + ")";
  }

  function freeCanonicalWeighted(adjacency, edgeOrders) {
    var codes = [];
    for (var i = 0; i < adjacency.length; i += 1) {
      codes.push(rootedCanonicalWeighted(adjacency, i, -1, edgeOrders));
    }
    codes.sort(compareStrings);
    return codes[0];
  }

  function canonicalGraphCode(adjacency, edgeOrders) {
    var classes = new Map();
    for (var atom = 0; atom < adjacency.length; atom += 1) {
      var signature = adjacency[atom].length + ":" + weightedValence(adjacency, atom, edgeOrders);
      if (!classes.has(signature)) classes.set(signature, []);
      classes.get(signature).push(atom);
    }
    var groups = Array.from(classes.entries()).sort(function (left, right) {
      return compareStrings(left[0], right[0]);
    }).map(function (entry) {
      return entry[1];
    });
    var best = null;
    var ordering = [];

    function encode() {
      var pieces = [];
      for (var i = 0; i < ordering.length; i += 1) {
        for (var j = i + 1; j < ordering.length; j += 1) {
          pieces.push(adjacency[ordering[i]].indexOf(ordering[j]) === -1
            ? "0"
            : String(getBondOrder(edgeOrders, ordering[i], ordering[j])));
        }
      }
      var candidate = pieces.join("");
      if (best === null || candidate < best) best = candidate;
    }

    function permutations(group, start, emit) {
      if (start === group.length) {
        emit(group);
        return;
      }
      for (var i = start; i < group.length; i += 1) {
        var swap = group[start];
        group[start] = group[i];
        group[i] = swap;
        permutations(group, start + 1, emit);
        swap = group[start];
        group[start] = group[i];
        group[i] = swap;
      }
    }

    function buildOrder(groupIndex) {
      if (groupIndex === groups.length) {
        encode();
        return;
      }
      permutations(groups[groupIndex].slice(), 0, function (permutation) {
        ordering.push.apply(ordering, permutation);
        buildOrder(groupIndex + 1);
        ordering.length -= permutation.length;
      });
    }

    buildOrder(0);
    return adjacency.length + ":" + best;
  }

  function canPlaceMultipleBond(adjacency, a, b, bondOrder) {
    var edgeOrders = new Map();
    edgeOrders.set(edgeKey(a, b), bondOrder);
    return weightedValence(adjacency, a, edgeOrders) <= 4 && weightedValence(adjacency, b, edgeOrders) <= 4;
  }

  function adjacencyWithRingBond(adjacency, ringBond) {
    var cyclic = cloneAdjacency(adjacency);
    cyclic[ringBond[0]].push(ringBond[1]);
    cyclic[ringBond[1]].push(ringBond[0]);
    return cyclic;
  }

  function orderedCycle(adjacency, cycleNodes, start, next) {
    var cycleSet = new Set(cycleNodes);
    var path = [start, next];
    var previous = start;
    var current = next;
    while (path.length <= cycleNodes.length) {
      var candidates = adjacency[current].filter(function (neighbor) {
        return cycleSet.has(neighbor) && neighbor !== previous;
      });
      if (!candidates.length) return [];
      var following = candidates[0];
      if (following === start) {
        return path.length === cycleNodes.length ? path : [];
      }
      if (path.indexOf(following) !== -1) return [];
      path.push(following);
      previous = current;
      current = following;
    }
    return [];
  }

  function canonicalUnicyclicWeighted(adjacency, edgeOrders) {
    var cycleNodes = findRingNodes(adjacency);
    if (cycleNodes.length < 3) return "";

    var candidates = [];
    for (var i = 0; i < cycleNodes.length; i += 1) {
      var start = cycleNodes[i];
      var ringNeighbors = adjacency[start].filter(function (neighbor) {
        return cycleNodes.indexOf(neighbor) !== -1;
      });
      for (var j = 0; j < ringNeighbors.length; j += 1) {
        var cycle = orderedCycle(adjacency, cycleNodes, start, ringNeighbors[j]);
        if (!cycle.length) continue;
        var signature = cycle.map(function (node, index) {
          var previous = cycle[(index + cycle.length - 1) % cycle.length];
          var next = cycle[(index + 1) % cycle.length];
          var branches = adjacency[node].filter(function (neighbor) {
            return neighbor !== previous && neighbor !== next;
          }).map(function (neighbor) {
            return rootedCanonicalWeighted(adjacency, neighbor, node, edgeOrders);
          }).sort(compareStrings);
          return [
            branches,
            getBondOrder(edgeOrders, node, next)
          ];
        });
        candidates.push(JSON.stringify(signature));
      }
    }
    candidates.sort(compareStrings);
    return candidates[0] || "";
  }

  function cycleNameCandidate(adjacency, cycle, edgeOrders, unsaturated) {
    var cycleSet = new Set(cycle);
    var substituents = [];
    var memo = new Map();
    for (var i = 0; i < cycle.length; i += 1) {
      var atom = cycle[i];
      for (var j = 0; j < adjacency[atom].length; j += 1) {
        var neighbor = adjacency[atom][j];
        if (!cycleSet.has(neighbor)) {
          var named = nameSubstituent(adjacency, neighbor, atom, memo);
          substituents.push({
            locant: i + 1,
            name: named.name,
            sortKey: named.sortKey
          });
        }
      }
    }

    var locants = substituents.map(function (sub) { return sub.locant; }).sort(function (a, b) { return a - b; });
    var alphabeticalLocants = substituents.slice().sort(function (a, b) {
      return compareStrings(a.sortKey, b.sortKey) || compareStrings(a.name, b.name) || a.locant - b.locant;
    }).map(function (sub) { return sub.locant; });
    var stem = EXTENDED_STEMS_REVERSE[cycle.length] || String(cycle.length);
    var parent = unsaturated ? "cyclo" + stem + "-1-ene" : "cyclo" + stem + "ane";
    var prefix = !unsaturated && substituents.length === 1
      ? substituents[0].name
      : formatSubstituentGroups(substituents);

    return {
      name: prefix ? prefix + parent : parent,
      locants: locants,
      alphabeticalLocants: alphabeticalLocants,
      substituents: substituents
    };
  }

  function compareCycleNameCandidates(a, b) {
    return compareNumberArrays(a.locants, b.locants) ||
      compareNumberArrays(a.alphabeticalLocants, b.alphabeticalLocants) ||
      compareStrings(a.name, b.name);
  }

  function nameCycloalkaneGraph(adjacency) {
    var cycleNodes = findRingNodes(adjacency);
    var candidates = [];
    for (var i = 0; i < cycleNodes.length; i += 1) {
      var start = cycleNodes[i];
      var neighbors = adjacency[start].filter(function (neighbor) {
        return cycleNodes.indexOf(neighbor) !== -1;
      });
      for (var j = 0; j < neighbors.length; j += 1) {
        var cycle = orderedCycle(adjacency, cycleNodes, start, neighbors[j]);
        if (cycle.length) candidates.push(cycleNameCandidate(adjacency, cycle, null, false));
      }
    }
    candidates.sort(compareCycleNameCandidates);
    return candidates[0];
  }

  function nameCycloalkeneGraph(adjacency, edgeOrders) {
    var cycleNodes = findRingNodes(adjacency);
    var candidates = [];
    for (var i = 0; i < cycleNodes.length; i += 1) {
      var start = cycleNodes[i];
      var neighbors = adjacency[start].filter(function (neighbor) {
        return cycleNodes.indexOf(neighbor) !== -1 &&
          getBondOrder(edgeOrders, start, neighbor) === 2;
      });
      for (var j = 0; j < neighbors.length; j += 1) {
        var cycle = orderedCycle(adjacency, cycleNodes, start, neighbors[j]);
        if (cycle.length) candidates.push(cycleNameCandidate(adjacency, cycle, edgeOrders, true));
      }
    }
    candidates.sort(compareCycleNameCandidates);
    return candidates[0];
  }

  var generateCycloalkaneIsomers = algorithmModules.cycloalkane({
    MAX_CARBONS: MAX_CARBONS,
    generateAlkaneIsomers: generateAlkaneIsomers,
    edgeKey: edgeKey,
    adjacencyWithRingBond: adjacencyWithRingBond,
    canonicalUnicyclicWeighted: canonicalUnicyclicWeighted,
    cloneAdjacency: cloneAdjacency
  });

  var generateCycloalkeneIsomers = algorithmModules.cycloalkene({
    generateCycloalkaneIsomers: generateCycloalkaneIsomers,
    adjacencyWithRingBond: adjacencyWithRingBond,
    findRingNodes: findRingNodes,
    cloneEdgeOrders: cloneEdgeOrders,
    edgeKey: edgeKey,
    weightedValence: weightedValence,
    canonicalUnicyclicWeighted: canonicalUnicyclicWeighted,
    nameCycloalkeneGraph: nameCycloalkeneGraph,
    cloneAdjacency: cloneAdjacency,
    compareStrings: compareStrings
  });

  function simplePathsWithin(adjacency, start, end, allowed) {
    var paths = [];
    function walk(node, path) {
      if (node === end) {
        paths.push(path.slice());
        return;
      }
      for (var i = 0; i < adjacency[node].length; i += 1) {
        var next = adjacency[node][i];
        if (!allowed.has(next) || path.indexOf(next) !== -1) continue;
        path.push(next);
        walk(next, path);
        path.pop();
      }
    }
    walk(start, [start]);
    return paths;
  }

  function bicyclicName(adjacency) {
    var core = findRingNodes(adjacency);
    var coreSet = new Set(core);
    var candidates = [];
    var memo = new Map();
    if (core.length === 4 && adjacency.length === 5) {
      var substituent = -1;
      var attachmentAtom = -1;
      for (var atom = 0; atom < adjacency.length; atom += 1) {
        if (coreSet.has(atom)) continue;
        var coreNeighbors = adjacency[atom].filter(function (neighbor) { return coreSet.has(neighbor); });
        if (coreNeighbors.length === 1) {
          substituent = atom;
          attachmentAtom = coreNeighbors[0];
          break;
        }
      }
      if (substituent !== -1) {
        var bridgeDegree = adjacency[attachmentAtom].filter(function (neighbor) {
          return coreSet.has(neighbor);
        }).length;
        return (bridgeDegree === 3 ? "1" : "2") + "-methylbicyclo[1.1.0]butane";
      }
    }

    var spiroCenters = core.filter(function (atom) {
      return adjacency[atom].filter(function (neighbor) { return coreSet.has(neighbor); }).length === 4;
    });
    if (spiroCenters.length === 1) {
      var spiroCenter = spiroCenters[0];
      var remaining = new Set(core.filter(function (atom) { return atom !== spiroCenter; }));
      var ringLengths = [];
      while (remaining.size) {
        var seed = remaining.values().next().value;
        var component = [];
        var stack = [seed];
        remaining.delete(seed);
        while (stack.length) {
          var node = stack.pop();
          component.push(node);
          for (var si = 0; si < adjacency[node].length; si += 1) {
            var next = adjacency[node][si];
            if (next !== spiroCenter && remaining.has(next)) {
              remaining.delete(next);
              stack.push(next);
            }
          }
        }
        ringLengths.push(component.length);
      }
      if (ringLengths.length === 2) {
        ringLengths.sort(function (a, b) { return b - a; });
        var spiroStem = EXTENDED_STEMS_REVERSE[core.length] || String(core.length);
        return "spiro[" + ringLengths.join(".") + "]" + spiroStem + "ane";
      }
    }

    function makeName(locants, bridgeLengths) {
      var substituents = [];
      for (var node = 0; node < adjacency.length; node += 1) {
        if (!coreSet.has(node)) continue;
        for (var ni = 0; ni < adjacency[node].length; ni += 1) {
          var neighbor = adjacency[node][ni];
          if (coreSet.has(neighbor)) continue;
          var named = nameSubstituent(adjacency, neighbor, node, memo);
          substituents.push({
            locant: locants.get(node),
            name: named.name,
            sortKey: named.sortKey
          });
        }
      }
      var bridge = bridgeLengths.slice().sort(function (a, b) { return b - a; });
      var stem = EXTENDED_STEMS_REVERSE[core.length] || String(core.length);
      var parent = "bicyclo[" + bridge.join(".") + "]" + stem + "ane";
      var prefix = formatSubstituentGroups(substituents);
      return {
        name: prefix ? prefix + parent : parent,
        locants: substituents.map(function (sub) { return sub.locant; }).sort(function (a, b) { return a - b; })
      };
    }

    for (var a = 0; a < core.length; a += 1) {
      for (var b = a + 1; b < core.length; b += 1) {
        var paths = simplePathsWithin(adjacency, core[a], core[b], coreSet);
        for (var p1 = 0; p1 < paths.length; p1 += 1) {
          for (var p2 = p1 + 1; p2 < paths.length; p2 += 1) {
            var internal2 = new Set(paths[p2].slice(1, -1));
            if (paths[p1].slice(1, -1).some(function (node) { return internal2.has(node); })) continue;
            for (var p3 = p2 + 1; p3 < paths.length; p3 += 1) {
              var internal3 = new Set(paths[p3].slice(1, -1));
              if (paths[p1].slice(1, -1).some(function (node) { return internal3.has(node); })) continue;
              if (paths[p2].slice(1, -1).some(function (node) { return internal3.has(node); })) continue;
              var covered = new Set(paths[p1].concat(paths[p2], paths[p3]));
              if (covered.size !== core.length) continue;

              var orderedPaths = [paths[p1], paths[p2], paths[p3]].sort(function (left, right) {
                return right.length - left.length;
              });
              var longest = orderedPaths[0];
              var second = orderedPaths[1];
              var shortest = orderedPaths[2];
              for (var reverse = 0; reverse < 2; reverse += 1) {
                var primary = reverse ? longest.slice().reverse() : longest.slice();
                var headA = primary[0];
                var headB = primary[primary.length - 1];
                var secondPath = second[0] === headA ? second.slice().reverse() : second.slice();
                var shortPath = shortest[0] === headA ? shortest.slice() : shortest.slice().reverse();
                var locants = new Map();
                for (var pi = 0; pi < primary.length; pi += 1) locants.set(primary[pi], pi + 1);
                var number = primary.length;
                for (var si = 1; si < secondPath.length - 1; si += 1) {
                  number += 1;
                  locants.set(secondPath[si], number);
                }
                for (var ti = 1; ti < shortPath.length - 1; ti += 1) {
                  number += 1;
                  locants.set(shortPath[ti], number);
                }
                var bridgeLengths = [longest.length - 2, second.length - 2, shortest.length - 2];
                candidates.push(makeName(locants, bridgeLengths));
              }
            }
          }
        }
      }
    }

    candidates.sort(function (left, right) {
      return compareNumberArrays(left.locants, right.locants) || compareStrings(left.name, right.name);
    });
    return candidates[0] ? candidates[0].name : "bicyclo hydrocarbon";
  }

  function graphLayout(adjacency) {
    var positions = [];
    var radius = Math.max(65, adjacency.length * 13);
    for (var i = 0; i < adjacency.length; i += 1) {
      var angle = -Math.PI / 2 + i * Math.PI * 2 / adjacency.length;
      positions.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    return positions;
  }

  var generateBicyclicIsomers = algorithmModules.bicyclic({
    generateAlkaneIsomers: generateAlkaneIsomers,
    adjacencyWithRingBond: adjacencyWithRingBond,
    canonicalGraphCode: canonicalGraphCode,
    formulaFromGraph: formulaFromGraph,
    formatFormula: formatFormula,
    bicyclicName: bicyclicName,
    graphLayout: graphLayout,
    compareStrings: compareStrings
  });

  var fusedAromaticIsomers = algorithmModules.fusedAromatic({
    edgeKey: edgeKey,
    formulaFromGraph: formulaFromGraph
  });

  var generateUnsaturatedAcyclicByBondOrder = algorithmModules.alkeneAlkyne({
    MAX_CARBONS: MAX_CARBONS,
    generateAlkaneIsomers: generateAlkaneIsomers,
    canPlaceMultipleBond: canPlaceMultipleBond,
    edgeKey: edgeKey,
    freeCanonicalWeighted: freeCanonicalWeighted
  });
  var generateAlkeneIsomers = algorithmModules.alkene(generateUnsaturatedAcyclicByBondOrder);
  var generateAlkyneIsomers = algorithmModules.alkyne(generateUnsaturatedAcyclicByBondOrder);

  function allLongestChainsContainingEdges(adjacency, edges) {
    var longest = 0;
    var chains = [];
    for (var start = 0; start < adjacency.length; start += 1) {
      for (var end = start + 1; end < adjacency.length; end += 1) {
        var path = findPath(adjacency, start, end, null);
        if (!edges.every(function (edge) { return chainContainsEdge(path, edge); })) continue;
        if (path.length > longest) {
          longest = path.length;
          chains = [path];
        } else if (path.length === longest) {
          chains.push(path);
        }
      }
    }
    return chains;
  }

  function buildDieneNameCandidate(adjacency, chain, doubleBonds, memo) {
    var locants = doubleBonds.map(function (edge) {
      return multipleBondLocant(chain, edge);
    }).sort(function (a, b) { return a - b; });
    var substituents = getSubstituentsForChain(adjacency, chain, memo, null);
    var parent = (EXTENDED_STEMS_REVERSE[chain.length] || STEMS[chain.length] || String(chain.length)) +
      "a-" + locants.join(",") + "-diene";
    var prefix = formatSubstituentGroups(substituents);
    return {
      name: prefix ? prefix + parent : parent,
      chain: chain,
      substituents: substituents,
      locants: locants,
      substituentLocants: substituents.map(function (sub) { return sub.locant; }).sort(function (a, b) { return a - b; })
    };
  }

  function compareDieneNameCandidates(a, b) {
    return compareNumberArrays(a.locants, b.locants) ||
      compareNumberArrays(a.substituentLocants, b.substituentLocants) ||
      compareStrings(a.name, b.name);
  }

  var generateDieneIsomers = algorithmModules.diene({
    generateAlkaneIsomers: generateAlkaneIsomers,
    edgeKey: edgeKey,
    weightedValence: weightedValence,
    allLongestChainsContainingEdges: allLongestChainsContainingEdges,
    buildDieneNameCandidate: buildDieneNameCandidate,
    compareDieneNameCandidates: compareDieneNameCandidates,
    freeCanonicalWeighted: freeCanonicalWeighted,
    cloneAdjacency: cloneAdjacency,
    compareStrings: compareStrings
  });

  function findPath(adjacency, start, target, blocked) {
    var stack = [{ node: start, parent: -1, path: [start] }];
    while (stack.length) {
      var current = stack.pop();
      if (current.node === target) {
        return current.path;
      }
      for (var i = 0; i < adjacency[current.node].length; i += 1) {
        var next = adjacency[current.node][i];
        if (next !== current.parent && next !== blocked) {
          stack.push({
            node: next,
            parent: current.node,
            path: current.path.concat(next)
          });
        }
      }
    }
    return null;
  }

  function collectComponent(adjacency, root, blocked) {
    var nodes = [];
    var stack = [{ node: root, parent: blocked }];
    while (stack.length) {
      var current = stack.pop();
      nodes.push(current.node);
      for (var i = 0; i < adjacency[current.node].length; i += 1) {
        var next = adjacency[current.node][i];
        if (next !== current.parent) {
          stack.push({ node: next, parent: current.node });
        }
      }
    }
    return nodes;
  }

  function allLongestChains(adjacency) {
    if (adjacency.length === 1) {
      return [[0]];
    }

    var longest = 0;
    var chains = [];

    for (var start = 0; start < adjacency.length; start += 1) {
      for (var end = start + 1; end < adjacency.length; end += 1) {
        var path = findPath(adjacency, start, end, null);
        if (path.length > longest) {
          longest = path.length;
          chains = [path];
        } else if (path.length === longest) {
          chains.push(path);
        }
      }
    }

    return chains;
  }

  function compareNumberArrays(a, b) {
    var length = Math.max(a.length, b.length);
    for (var i = 0; i < length; i += 1) {
      if (a[i] === undefined) {
        return -1;
      }
      if (b[i] === undefined) {
        return 1;
      }
      if (a[i] !== b[i]) {
        return a[i] - b[i];
      }
    }
    return 0;
  }

  function substituentSortKey(name) {
    return name.toLowerCase().replace(/^[0-9,]+-/, "").replace(/[()]/g, "");
  }

  function isComplexSubstituent(name) {
    return /[-,]/.test(name);
  }

  function multiplier(count, complex) {
    var list = complex ? COMPLEX_MULTIPLIERS : SIMPLE_MULTIPLIERS;
    return list[count] || (complex ? count + "kis" : count + "-");
  }

  function formatSubstituentGroups(substituents) {
    if (!substituents.length) {
      return "";
    }

    var groups = new Map();
    for (var i = 0; i < substituents.length; i += 1) {
      var sub = substituents[i];
      if (!groups.has(sub.name)) {
        groups.set(sub.name, {
          name: sub.name,
          sortKey: sub.sortKey,
          locants: []
        });
      }
      groups.get(sub.name).locants.push(sub.locant);
    }

    var ordered = Array.from(groups.values()).sort(function (a, b) {
      return compareStrings(a.sortKey, b.sortKey) || compareStrings(a.name, b.name);
    });

    var pieces = [];
    for (var g = 0; g < ordered.length; g += 1) {
      var group = ordered[g];
      group.locants.sort(function (a, b) {
        return a - b;
      });
      var count = group.locants.length;
      var complex = isComplexSubstituent(group.name);
      var locants = group.locants.join(",");

      if (count === 1) {
        pieces.push(locants + "-" + (complex ? "(" + group.name + ")" : group.name));
      } else if (complex) {
        pieces.push(locants + "-" + multiplier(count, true) + "(" + group.name + ")");
      } else {
        pieces.push(locants + "-" + multiplier(count, false) + group.name);
      }
    }

    return pieces.join("-");
  }

  function getSubstituentsForChain(adjacency, chain, memo, allowedSet) {
    var chainSet = new Set(chain);
    var substituents = [];

    for (var i = 0; i < chain.length; i += 1) {
      var atom = chain[i];
      var locant = i + 1;
      for (var j = 0; j < adjacency[atom].length; j += 1) {
        var next = adjacency[atom][j];
        if (!chainSet.has(next) && (!allowedSet || allowedSet.has(next))) {
          var named = nameSubstituent(adjacency, next, atom, memo);
          substituents.push({
            locant: locant,
            name: named.name,
            sortKey: named.sortKey,
            carbonCount: named.carbonCount
          });
        }
      }
    }

    return substituents;
  }

  function compareNameCandidates(a, b) {
    if (a.substituentCount !== b.substituentCount) {
      return b.substituentCount - a.substituentCount;
    }

    var locantCompare = compareNumberArrays(a.locants, b.locants);
    if (locantCompare) {
      return locantCompare;
    }

    var alphaCompare = compareNumberArrays(a.alphabeticalLocants, b.alphabeticalLocants);
    if (alphaCompare) {
      return alphaCompare;
    }

    return compareStrings(a.name, b.name);
  }

  function buildNameCandidate(adjacency, chain, memo, parentNames, allowedSet) {
    var substituents = getSubstituentsForChain(adjacency, chain, memo, allowedSet);
    var prefix = formatSubstituentGroups(substituents);
    var parentName = parentNames[chain.length];
    var name = prefix ? prefix + parentName : parentName;
    var locants = substituents.map(function (sub) {
      return sub.locant;
    }).sort(function (a, b) {
      return a - b;
    });
    var alphabeticalLocants = substituents.slice().sort(function (a, b) {
      return compareStrings(a.sortKey, b.sortKey) || compareStrings(a.name, b.name) || a.locant - b.locant;
    }).map(function (sub) {
      return sub.locant;
    });

    return {
      name: name,
      chain: chain,
      substituents: substituents,
      substituentCount: substituents.length,
      locants: locants,
      alphabeticalLocants: alphabeticalLocants
    };
  }

  function nameSubstituent(adjacency, root, parent, memo) {
    var key = root + ":" + parent;
    if (memo.has(key)) {
      return memo.get(key);
    }

    var component = collectComponent(adjacency, root, parent);
    var componentSet = new Set(component);
    if (component.length === 1) {
      var methyl = { name: "methyl", sortKey: "methyl", carbonCount: 1 };
      memo.set(key, methyl);
      return methyl;
    }

    var longest = 0;
    var paths = [];
    for (var i = 0; i < component.length; i += 1) {
      var path = findPath(adjacency, root, component[i], parent);
      if (path.length > longest) {
        longest = path.length;
        paths = [path];
      } else if (path.length === longest) {
        paths.push(path);
      }
    }

    var candidates = paths.map(function (path) {
      return buildNameCandidate(adjacency, path, memo, ALKYL_NAMES, componentSet);
    }).sort(compareNameCandidates);

    var best = {
      name: candidates[0].name,
      sortKey: substituentSortKey(candidates[0].name),
      carbonCount: component.length
    };
    memo.set(key, best);
    return best;
  }

  function nameAlkane(adjacency) {
    var memo = new Map();
    var chains = allLongestChains(adjacency);
    var candidates = [];

    for (var i = 0; i < chains.length; i += 1) {
      candidates.push(buildNameCandidate(adjacency, chains[i], memo, ALKANE_NAMES, null));
      if (chains[i].length > 1) {
        candidates.push(buildNameCandidate(adjacency, chains[i].slice().reverse(), memo, ALKANE_NAMES, null));
      }
    }

    candidates.sort(compareNameCandidates);
    return candidates[0];
  }

  // Longest chain that still contains `anchor`. The principal chain of an
  // alkoxyalkane parent (and of an alkoxy group) must include the carbon that
  // carries the C-O bond, so the plain longest chain is not always valid.
  function longestPathContainingNode(adjacency, anchor) {
    var nodeCount = adjacency.length;
    if (nodeCount <= 1) {
      return [anchor];
    }

    // Collect, for every branch leaving the anchor, all of the deepest paths.
    var branchPaths = [];
    for (var b = 0; b < adjacency[anchor].length; b += 1) {
      var neighbor = adjacency[anchor][b];
      var deepest = 1;
      var found = [];
      var stack = [{ node: neighbor, parent: anchor, depth: 1, path: [anchor, neighbor] }];
      while (stack.length) {
        var current = stack.pop();
        if (current.depth > deepest) {
          deepest = current.depth;
          found = [current.path];
        } else if (current.depth === deepest) {
          found.push(current.path);
        }
        for (var n = 0; n < adjacency[current.node].length; n += 1) {
          var next = adjacency[current.node][n];
          if (next === current.parent) continue;
          stack.push({
            node: next,
            parent: current.node,
            depth: current.depth + 1,
            path: current.path.concat([next])
          });
        }
      }
      if (found.length) {
        branchPaths.push(found);
      }
    }

    if (!branchPaths.length) {
      return [anchor];
    }
    if (branchPaths.length === 1) {
      return branchPaths[0][0];
    }

    var bestLength = 0;
    var bestPaths = [];
    for (var i = 0; i < branchPaths.length; i += 1) {
      for (var j = i + 1; j < branchPaths.length; j += 1) {
        for (var p = 0; p < branchPaths[i].length; p += 1) {
          for (var q = 0; q < branchPaths[j].length; q += 1) {
            // Each branch path starts at the anchor; join them across it.
            var joined = branchPaths[i][p].slice().reverse().concat(branchPaths[j][q].slice(1));
            if (joined.length > bestLength) {
              bestLength = joined.length;
              bestPaths = [joined];
            } else if (joined.length === bestLength) {
              bestPaths.push(joined);
            }
          }
        }
      }
    }
    if (bestPaths.length) {
      return bestPaths[0];
    }
    var longestBranch = branchPaths[0][0];
    for (var k = 1; k < branchPaths.length; k += 1) {
      if (branchPaths[k][0].length > longestBranch.length) longestBranch = branchPaths[k][0];
    }
    return longestBranch;
  }

  // Like nameAlkane, but the returned chain always contains `anchor` and is
  // ordered so the anchor gets the lowest possible locant. Used for both sides
  // of an ether so the alkoxy locants are stable.
  function nameAlkaneAtAnchor(adjacency, anchor) {
    var memo = new Map();
    var chain = longestPathContainingNode(adjacency, anchor);
    var candidates = [buildNameCandidate(adjacency, chain, memo, ALKANE_NAMES, null)];
    if (chain.length > 1) {
      candidates.push(buildNameCandidate(adjacency, chain.slice().reverse(), memo, ALKANE_NAMES, null));
    }
    candidates.sort(function (a, b) {
      var aAnchor = a.chain.indexOf(anchor);
      var bAnchor = b.chain.indexOf(anchor);
      if (aAnchor !== bAnchor) {
        return aAnchor - bAnchor;
      }
      return compareNameCandidates(a, b);
    });
    var chosen = candidates[0];
    chosen.anchorLocant = chosen.chain.indexOf(anchor) + 1;
    return chosen;
  }

  function chainContainsEdge(chain, edge) {
    for (var i = 0; i < chain.length - 1; i += 1) {
      if (
        (chain[i] === edge[0] && chain[i + 1] === edge[1]) ||
        (chain[i] === edge[1] && chain[i + 1] === edge[0])
      ) {
        return true;
      }
    }
    return false;
  }

  function allLongestChainsContainingEdge(adjacency, edge) {
    var longest = 0;
    var chains = [];

    for (var start = 0; start < adjacency.length; start += 1) {
      for (var end = start + 1; end < adjacency.length; end += 1) {
        var path = findPath(adjacency, start, end, null);
        if (!chainContainsEdge(path, edge)) {
          continue;
        }
        if (path.length > longest) {
          longest = path.length;
          chains = [path];
        } else if (path.length === longest) {
          chains.push(path);
        }
      }
    }

    return chains;
  }

  function multipleBondLocant(chain, edge) {
    for (var i = 0; i < chain.length - 1; i += 1) {
      if (
        (chain[i] === edge[0] && chain[i + 1] === edge[1]) ||
        (chain[i] === edge[1] && chain[i + 1] === edge[0])
      ) {
        return i + 1;
      }
    }
    return Infinity;
  }

  function unsaturatedParentName(length, locant, bondOrder) {
    var suffix = bondOrder === 2 ? "ene" : "yne";
    if (length === 2) {
      return STEMS[length] + suffix;
    }
    return STEMS[length] + "-" + locant + "-" + suffix;
  }

  function compareUnsaturatedNameCandidates(a, b) {
    if (a.multipleBondLocant !== b.multipleBondLocant) {
      return a.multipleBondLocant - b.multipleBondLocant;
    }
    if (a.substituentCount !== b.substituentCount) {
      return b.substituentCount - a.substituentCount;
    }

    var locantCompare = compareNumberArrays(a.locants, b.locants);
    if (locantCompare) {
      return locantCompare;
    }

    var alphaCompare = compareNumberArrays(a.alphabeticalLocants, b.alphabeticalLocants);
    if (alphaCompare) {
      return alphaCompare;
    }

    return compareStrings(a.name, b.name);
  }

  function buildUnsaturatedNameCandidate(adjacency, chain, edge, bondOrder, memo) {
    var locant = multipleBondLocant(chain, edge);
    var substituents = getSubstituentsForChain(adjacency, chain, memo, null);
    var prefix = formatSubstituentGroups(substituents);
    var parentName = unsaturatedParentName(chain.length, locant, bondOrder);
    var locants = substituents.map(function (sub) {
      return sub.locant;
    }).sort(function (a, b) {
      return a - b;
    });
    var alphabeticalLocants = substituents.slice().sort(function (a, b) {
      return compareStrings(a.sortKey, b.sortKey) || compareStrings(a.name, b.name) || a.locant - b.locant;
    }).map(function (sub) {
      return sub.locant;
    });

    return {
      name: prefix ? prefix + parentName : parentName,
      chain: chain,
      substituents: substituents,
      substituentCount: substituents.length,
      locants: locants,
      alphabeticalLocants: alphabeticalLocants,
      multipleBondLocant: locant
    };
  }

  function nameUnsaturatedAcyclic(adjacency, edge, bondOrder) {
    var memo = new Map();
    var chains = allLongestChainsContainingEdge(adjacency, edge);
    var candidates = [];

    for (var i = 0; i < chains.length; i += 1) {
      candidates.push(buildUnsaturatedNameCandidate(adjacency, chains[i], edge, bondOrder, memo));
      candidates.push(buildUnsaturatedNameCandidate(adjacency, chains[i].slice().reverse(), edge, bondOrder, memo));
    }

    candidates.sort(compareUnsaturatedNameCandidates);
    return candidates[0];
  }

  function nameRootedAlkylCode(code) {
    var adjacency = parseRootedTree(code);
    return nameSubstituent(adjacency, 0, -1, new Map());
  }

  function aromaticAlkylOptions(maxSize) {
    var options = [];
    for (var size = 1; size <= maxSize; size += 1) {
      var forms = plantedForms(size);
      for (var i = 0; i < forms.length; i += 1) {
        var named = nameRootedAlkylCode(forms[i]);
        options.push({
          code: forms[i],
          size: size,
          name: named.name,
          sortKey: named.sortKey,
          label: shortSubstituentLabel(named.name)
        });
      }
    }
    options.sort(function (a, b) {
      return a.size - b.size || compareStrings(a.code, b.code);
    });
    return options;
  }

  function transformRingSequence(sequence, offset, reflected) {
    var transformed = [];
    for (var i = 0; i < 6; i += 1) {
      var index = reflected ? (offset - i + 6) % 6 : (offset + i) % 6;
      transformed.push(sequence[index]);
    }
    return transformed;
  }

  function ringSequenceToken(sequence) {
    return sequence.map(function (item) {
      return item ? item.code : ".";
    }).join("|");
  }

  function canonicalRingToken(sequence) {
    var tokens = [];
    for (var offset = 0; offset < 6; offset += 1) {
      tokens.push(ringSequenceToken(transformRingSequence(sequence, offset, false)));
      tokens.push(ringSequenceToken(transformRingSequence(sequence, offset, true)));
    }
    tokens.sort(compareStrings);
    return tokens[0];
  }

  function displaySubstituentName(name) {
    return isComplexSubstituent(name) ? "(" + name + ")" : name;
  }

  function compareRingNameCandidates(a, b) {
    var locantCompare = compareNumberArrays(a.locants, b.locants);
    if (locantCompare) {
      return locantCompare;
    }

    var alphaCompare = compareNumberArrays(a.alphabeticalLocants, b.alphabeticalLocants);
    if (alphaCompare) {
      return alphaCompare;
    }

    return compareStrings(a.name, b.name);
  }

  function buildRingNameCandidate(sequence) {
    var substituents = [];
    for (var i = 0; i < sequence.length; i += 1) {
      if (sequence[i]) {
        substituents.push({
          locant: i + 1,
          name: sequence[i].name,
          sortKey: sequence[i].sortKey,
          carbonCount: sequence[i].size
        });
      }
    }

    if (!substituents.length) {
      return {
        name: "benzene",
        locants: [],
        alphabeticalLocants: [],
        substituents: substituents,
        sequence: sequence
      };
    }

    if (substituents.length === 1) {
      return {
        name: displaySubstituentName(substituents[0].name) + "benzene",
        locants: [1],
        alphabeticalLocants: [1],
        substituents: substituents,
        sequence: sequence
      };
    }

    var locants = substituents.map(function (sub) {
      return sub.locant;
    }).sort(function (a, b) {
      return a - b;
    });
    var alphabeticalLocants = substituents.slice().sort(function (a, b) {
      return compareStrings(a.sortKey, b.sortKey) || compareStrings(a.name, b.name) || a.locant - b.locant;
    }).map(function (sub) {
      return sub.locant;
    });

    return {
      name: formatSubstituentGroups(substituents) + "benzene",
      locants: locants,
      alphabeticalLocants: alphabeticalLocants,
      substituents: substituents,
      sequence: sequence
    };
  }

  function nameAromaticRing(sequence) {
    var candidates = [];
    var hasSubstituent = sequence.some(Boolean);

    for (var offset = 0; offset < 6; offset += 1) {
      var normal = transformRingSequence(sequence, offset, false);
      var reflected = transformRingSequence(sequence, offset, true);
      if (!hasSubstituent || normal[0]) {
        candidates.push(buildRingNameCandidate(normal));
      }
      if (!hasSubstituent || reflected[0]) {
        candidates.push(buildRingNameCandidate(reflected));
      }
    }

    candidates.sort(compareRingNameCandidates);
    return candidates[0];
  }

  var generateAromaticIsomers = algorithmModules.aromatic({
    MAX_CARBONS: MAX_CARBONS,
    aromaticCache: aromaticCache,
    aromaticAlkylOptions: aromaticAlkylOptions,
    nameAromaticRing: nameAromaticRing,
    canonicalRingToken: canonicalRingToken,
    compareStrings: compareStrings
  });

  function shortSubstituentLabel(name) {
    var labels = {
      methyl: "Me",
      ethyl: "Et",
      propyl: "Pr",
      butyl: "Bu",
      pentyl: "Pe",
      hexyl: "Hx"
    };
    return labels[name] || "R";
  }

  function atomLabel(adjacency, atom, edgeOrders, attachments, elements) {
    // Non-carbon nodes (the ether oxygen, for example) are real atoms in the
    // adjacency, so they are labelled by their element instead of by H counts.
    if (elements && elements[atom] && elements[atom] !== "C") {
      return elements[atom];
    }
    attachments = attachments || [];
    var hydrogens = 4 - weightedValence(adjacency, atom, edgeOrders) - attachmentCountForAtom(attachments, atom);
    if (hydrogens <= 0) {
      return "C";
    }
    if (hydrogens === 1) {
      return "CH";
    }
    return "CH" + hydrogens;
  }

  function layoutBranch(adjacency, node, parent, coords, x, y, direction, depth, chainSet) {
    coords.set(node, { x: x, y: y });
    var children = adjacency[node].filter(function (next) {
      // A bridging atom (the ether oxygen) also touches the parent chain on
      // its other side; never pull those atoms out of their chain positions.
      return next !== parent && !(chainSet && chainSet.has(next));
    });
    for (var i = 0; i < children.length; i += 1) {
      var offset = (i - (children.length - 1) / 2) * 48;
      layoutBranch(
        adjacency,
        children[i],
        node,
        coords,
        x + offset,
        y + direction * (62 + depth * 8),
        direction,
        depth + 1,
        chainSet
      );
    }
  }

  function layoutBondLineBranch(adjacency, node, parent, coords, x, y, direction, depth, chainSet) {
    coords.set(node, { x: x, y: y });
    var children = adjacency[node].filter(function (next) {
      return next !== parent && !(chainSet && chainSet.has(next));
    });
    for (var i = 0; i < children.length; i += 1) {
      var centerOffset = (i - (children.length - 1) / 2) * 30;
      var swing = depth % 2 === 0 ? -44 : 44;
      layoutBondLineBranch(
        adjacency,
        children[i],
        node,
        coords,
        x + swing + centerOffset,
        y + direction * 52,
        direction,
        depth + 1,
        chainSet
      );
    }
  }

  function bondLineMarkup(a, b, order) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var offsetX = (-dy / length) * 5;
    var offsetY = (dx / length) * 5;
    var offsets = order === 3 ? [-1, 0, 1] : order === 2 ? [-0.7, 0.7] : [0];

    return offsets.map(function (offset) {
      var ox = offsetX * offset;
      var oy = offsetY * offset;
      return (
        '<line class="bond" x1="' +
        (a.x + ox) +
        '" y1="' +
        (a.y + oy) +
        '" x2="' +
        (b.x + ox) +
        '" y2="' +
        (b.y + oy) +
        '"></line>'
      );
    }).join("");
  }

  function buildDiagramSvg(adjacency, chain, edgeOrders, viewMode, attachments, elements) {
    var isBondLine = viewMode === "bondline";
    var coords = new Map();
    var spacing = isBondLine ? 68 : 76;
    var baseY = isBondLine ? 118 : 130;
    var zigzag = isBondLine ? 30 : 0;
    var chainSet = new Set(chain);

    for (var i = 0; i < chain.length; i += 1) {
      var chainY = isBondLine && chain.length > 1 ? baseY + (i % 2 === 0 ? zigzag : -zigzag) : baseY;
      coords.set(chain[i], { x: 46 + i * spacing, y: chainY });
    }

    for (var c = 0; c < chain.length; c += 1) {
      var atom = chain[c];
      var branches = adjacency[atom].filter(function (next) {
        return !chainSet.has(next);
      });
      for (var b = 0; b < branches.length; b += 1) {
        var parentPoint = coords.get(atom);
        var direction = isBondLine
          ? parentPoint.y <= baseY ? -1 : 1
          : (c + b) % 2 === 0 ? -1 : 1;
        var offset = (b - (branches.length - 1) / 2) * (isBondLine ? 30 : 40);
        if (isBondLine) {
          layoutBondLineBranch(
            adjacency,
            branches[b],
            atom,
            coords,
            parentPoint.x + offset + (direction > 0 ? 38 : -38),
            parentPoint.y + direction * 58,
            direction,
            1,
            chainSet
          );
        } else {
          layoutBranch(
            adjacency,
            branches[b],
            atom,
            coords,
            parentPoint.x + offset,
            baseY + direction * 64,
            direction,
            1,
            chainSet
          );
        }
      }
    }

    var attachmentTotals = new Map();
    var attachmentSeen = new Map();
    for (var at = 0; at < (attachments || []).length; at += 1) {
      var attachmentAtom = attachments[at].atom;
      attachmentTotals.set(attachmentAtom, (attachmentTotals.get(attachmentAtom) || 0) + 1);
    }

    var attachmentCoords = [];
    for (var ac = 0; ac < (attachments || []).length; ac += 1) {
      var attachment = attachments[ac];
      var parentPointForAttachment = coords.get(attachment.atom);
      if (!parentPointForAttachment) {
        continue;
      }
      var attachmentIndex = attachmentSeen.get(attachment.atom) || 0;
      var attachmentTotal = attachmentTotals.get(attachment.atom) || 1;
      attachmentSeen.set(attachment.atom, attachmentIndex + 1);
      var chainPosition = chain.indexOf(attachment.atom);
      var attachmentDirection = chainPosition === -1
        ? -1
        : chainPosition % 2 === 0 ? -1 : 1;
      var spread = attachmentIndex - (attachmentTotal - 1) / 2;
      var attachPoint = {
        x: parentPointForAttachment.x + (isBondLine ? 34 : 0) + spread * (isBondLine ? 28 : 36),
        y: parentPointForAttachment.y + attachmentDirection * ((isBondLine ? 54 : 66) + Math.abs(spread) * 8)
      };
      attachmentCoords.push({
        attachment: attachment,
        parent: parentPointForAttachment,
        point: attachPoint
      });
    }

    var values = Array.from(coords.values()).concat(attachmentCoords.map(function (item) { return item.point; }));
    var minX = Math.min.apply(null, values.map(function (point) { return point.x; })) - 42;
    var maxX = Math.max.apply(null, values.map(function (point) { return point.x; })) + 42;
    var minY = Math.min.apply(null, values.map(function (point) { return point.y; })) - 38;
    var maxY = Math.max.apply(null, values.map(function (point) { return point.y; })) + 38;
    var width = Math.max(240, maxX - minX);
    var height = Math.max(170, maxY - minY);

    var edges = [];
    for (var n = 0; n < adjacency.length; n += 1) {
      for (var e = 0; e < adjacency[n].length; e += 1) {
        var neighbor = adjacency[n][e];
        if (neighbor > n) {
          var a = coords.get(n);
          var d = coords.get(neighbor);
          edges.push(bondLineMarkup(a, d, getBondOrder(edgeOrders, n, neighbor)));
        }
      }
    }
    for (var ae = 0; ae < attachmentCoords.length; ae += 1) {
      edges.push(bondLineMarkup(
        attachmentCoords[ae].parent,
        attachmentCoords[ae].point,
        attachmentCoords[ae].attachment.bondOrder || 1
      ));
    }

    var nodes = [];
    for (var atom = 0; atom < adjacency.length; atom += 1) {
      var point = coords.get(atom);
      if (isBondLine) {
        // Bond-line views skip the CHn circles, but real hetero atoms (the
        // ether oxygen) still need their element label at the vertex.
        if (elements && elements[atom] && elements[atom] !== "C") {
          nodes.push(
            '<text class="bondline-substituent" x="' + point.x + '" y="' + point.y + '">' + elements[atom] + "</text>"
          );
        }
        continue;
      } else {
        var nodeElement = elements && elements[atom] ? elements[atom] : "C";
        var isHeteroNode = nodeElement !== "C";
        nodes.push(
          '<g><circle class="atom' +
          (isHeteroNode ? " hetero-atom hetero-" + nodeElement.toLowerCase() : "") +
          '" cx="' + point.x + '" cy="' + point.y + '" r="22"></circle>' +
          '<text class="atom-label" x="' + point.x + '" y="' + point.y + '">' + atomLabel(adjacency, atom, edgeOrders, attachments, elements) + "</text></g>"
        );
      }
    }
    for (var an = 0; an < attachmentCoords.length; an += 1) {
      var item = attachmentCoords[an];
      var label = escapeHtml(item.attachment.label);
      if (isBondLine) {
        nodes.push(
          '<text class="bondline-substituent" x="' + item.point.x + '" y="' + item.point.y + '">' + label + "</text>"
        );
      } else {
        nodes.push(
          '<g><circle class="atom hetero-atom hetero-' + item.attachment.element.toLowerCase() + '" cx="' + item.point.x + '" cy="' + item.point.y + '" r="22"></circle>' +
          '<text class="atom-label" x="' + item.point.x + '" y="' + item.point.y + '">' + label + "</text></g>"
        );
      }
    }

    return (
      '<svg class="' +
      (isBondLine ? "bondline" : "atom-view") +
      '" role="img" aria-label="' +
      (isBondLine ? "bond-line structure diagram" : "carbon skeleton diagram") +
      '" viewBox="' +
      minX +
      " " +
      minY +
      " " +
      width +
      " " +
      height +
      '">' +
      edges.join("") +
      nodes.join("") +
      "</svg>"
    );
  }

  function buildCycloalkaneDiagramSvg(isomer, viewMode) {
    var isBondLine = viewMode === "bondline";
    var adjacency = isomer.ringBond
      ? adjacencyWithRingBond(isomer.adjacency || [[]], isomer.ringBond)
      : isomer.adjacency || [[]];
    var edgeOrders = isomer.edgeOrders || null;
    var cycleNodes = findRingNodes(adjacency);
    var firstNeighbor = adjacency[cycleNodes[0]].filter(function (neighbor) {
      return cycleNodes.indexOf(neighbor) !== -1;
    })[0];
    var cycle = orderedCycle(adjacency, cycleNodes, cycleNodes[0], firstNeighbor);
    var centerX = 210;
    var centerY = 170;
    var radius = cycle.length <= 3 ? 46 : cycle.length <= 6 ? 68 : 78;
    var positions = new Map();
    var cycleSet = new Set(cycle);
    var visited = new Set(cycle);

    for (var i = 0; i < cycle.length; i += 1) {
      var angle = (-90 + i * (360 / cycle.length)) * Math.PI / 180;
      positions.set(cycle[i], {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    }

    function placeBranch(atom, parent, origin, direction, depth) {
      var point = {
        x: origin.x + Math.cos(direction) * 48,
        y: origin.y + Math.sin(direction) * 48
      };
      positions.set(atom, point);
      visited.add(atom);
      var children = adjacency[atom].filter(function (neighbor) {
        return neighbor !== parent && !cycleSet.has(neighbor) && !visited.has(neighbor);
      });
      for (var child = 0; child < children.length; child += 1) {
        var offset = children.length === 1 ? (depth % 2 ? 0.55 : -0.55) : (child - (children.length - 1) / 2) * 0.8;
        placeBranch(children[child], atom, point, direction + offset, depth + 1);
      }
    }

    for (var ringIndex = 0; ringIndex < cycle.length; ringIndex += 1) {
      var ringAtom = cycle[ringIndex];
      var roots = adjacency[ringAtom].filter(function (neighbor) {
        return !cycleSet.has(neighbor) && !visited.has(neighbor);
      });
      var ringPoint = positions.get(ringAtom);
      var outward = Math.atan2(ringPoint.y - centerY, ringPoint.x - centerX);
      for (var rootIndex = 0; rootIndex < roots.length; rootIndex += 1) {
        var branchOffset = (rootIndex - (roots.length - 1) / 2) * 0.8;
        placeBranch(roots[rootIndex], ringAtom, ringPoint, outward + branchOffset, 0);
      }
    }

    var parts = ['<svg class="' + (isBondLine ? "bondline" : "atom-view") + '" role="img" aria-label="' + escapeHtml(isomer.name || "cyclic hydrocarbon") + ' structure" viewBox="0 0 420 340">'];
    for (var atom = 0; atom < adjacency.length; atom += 1) {
      for (var neighborIndex = 0; neighborIndex < adjacency[atom].length; neighborIndex += 1) {
        var neighbor = adjacency[atom][neighborIndex];
        if (neighbor <= atom) continue;
        var order = getBondOrder(edgeOrders, atom, neighbor);
        parts.push(bondLineMarkup(positions.get(atom), positions.get(neighbor), order));
      }
    }
    if (!isBondLine) {
      for (var labelIndex = 0; labelIndex < adjacency.length; labelIndex += 1) {
        var hydrogens = 4 - weightedValence(adjacency, labelIndex, edgeOrders) - attachmentCountForAtom(isomer.attachments, labelIndex);
        var label = hydrogens <= 0 ? "C" : hydrogens === 1 ? "CH" : "CH" + hydrogens;
        var point = positions.get(labelIndex);
        parts.push('<g><circle class="atom" cx="' + point.x + '" cy="' + point.y + '" r="20"></circle><text class="atom-label" x="' + point.x + '" y="' + point.y + '">' + label + "</text></g>");
      }
    }
    parts.push("</svg>");
    return parts.join("");
  }

  function buildGraphDiagramSvg(isomer, viewMode) {
    var adjacency = isomer.adjacency || [];
    var coordinates = isomer.coordinates || graphLayout(adjacency);
    var width = 420;
    var height = 300;
    var margin = 38;
    var minX = Math.min.apply(null, coordinates.map(function (point) { return point.x; }));
    var maxX = Math.max.apply(null, coordinates.map(function (point) { return point.x; }));
    var minY = Math.min.apply(null, coordinates.map(function (point) { return point.y; }));
    var maxY = Math.max.apply(null, coordinates.map(function (point) { return point.y; }));
    var spanX = Math.max(maxX - minX, 1);
    var spanY = Math.max(maxY - minY, 1);
    var scale = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanY);
    var centerX = (minX + maxX) / 2;
    var centerY = (minY + maxY) / 2;
    var points = coordinates.map(function (point) {
      return {
        x: width / 2 + (point.x - centerX) * scale,
        y: height / 2 + (point.y - centerY) * scale
      };
    });
    var bondline = viewMode === "bondline";
    var parts = [
      '<svg class="' + (bondline ? "bondline" : "atom-view") + '" role="img" aria-label="' +
      escapeHtml((isomer.name || "Hydrocarbon") + " structure") + '" viewBox="0 0 ' + width + " " + height + '">'
    ];
    for (var atom = 0; atom < adjacency.length; atom += 1) {
      for (var ni = 0; ni < adjacency[atom].length; ni += 1) {
        var neighbor = adjacency[atom][ni];
        if (neighbor <= atom) continue;
        parts.push(bondLineMarkup(points[atom], points[neighbor], getBondOrder(isomer.edgeOrders, atom, neighbor)));
      }
    }
    if (!bondline) {
      for (var labelIndex = 0; labelIndex < adjacency.length; labelIndex += 1) {
        var hydrogens = 4 - weightedValence(adjacency, labelIndex, isomer.edgeOrders);
        var label = hydrogens <= 0 ? "C" : hydrogens === 1 ? "CH" : "CH" + hydrogens;
        parts.push(
          '<g><circle class="atom" cx="' + points[labelIndex].x + '" cy="' + points[labelIndex].y +
          '" r="17"></circle><text class="atom-label" x="' + points[labelIndex].x + '" y="' +
          points[labelIndex].y + '">' + label + "</text></g>"
        );
      }
    }
    parts.push("</svg>");
    return parts.join("");
  }

  function buildAromaticDiagramSvg(isomer, viewMode) {
    var isBondLine = viewMode === "bondline";
    var center = { x: 190, y: 138 };
    var radius = 58;
    var substituentRadius = 108;
    var sequence = isomer.sequence || [null, null, null, null, null, null];
    var ring = [];
    var substituentPoints = [];

    for (var i = 0; i < 6; i += 1) {
      var angle = (-90 + i * 60) * Math.PI / 180;
      ring.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      });
      substituentPoints.push({
        x: center.x + Math.cos(angle) * substituentRadius,
        y: center.y + Math.sin(angle) * substituentRadius
      });
    }

    var parts = [
      '<svg class="' +
      (isBondLine ? "bondline" : "atom-view") +
      '" role="img" aria-label="' +
      (isBondLine ? "aromatic bond-line diagram" : "aromatic ring diagram") +
      '" viewBox="0 0 380 280">'
    ];

    for (var edge = 0; edge < 6; edge += 1) {
      parts.push(bondLineMarkup(ring[edge], ring[(edge + 1) % 6], 1));
    }
    parts.push('<circle class="aromatic-circle" cx="' + center.x + '" cy="' + center.y + '" r="31"></circle>');

    var allSvgPoints = [];
    for (var pi = 0; pi < 6; pi += 1) { allSvgPoints.push(ring[pi]); }

    for (var atom = 0; atom < 6; atom += 1) {
      if (sequence[atom]) {
        var subSize = sequence[atom].size || 0;
        var isAlkylChain = subSize > 0 && !sequence[atom].extraElements;

        if (isAlkylChain) {
          // Draw zigzag carbon chain extending outward from ring
          var dx = ring[atom].x - center.x;
          var dy = ring[atom].y - center.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          var ux = dx / dist;
          var uy = dy / dist;
          var perpX = -uy;
          var perpY = ux;

          var prevPt = ring[atom];
          var bondLen = isBondLine ? 28 : 32;
          var zigzagAmt = isBondLine ? 8 : 12;

          for (var ci = 0; ci < subSize; ci += 1) {
            var zig = (ci % 2 === 0 ? 1 : -1) * zigzagAmt;
            var nx = prevPt.x + ux * bondLen + perpX * zig;
            var ny = prevPt.y + uy * bondLen + perpY * zig;

            parts.push(bondLineMarkup(prevPt, { x: nx, y: ny }, 1));
            allSvgPoints.push({ x: nx, y: ny });

            if (!isBondLine) {
              var chainLabel = ci === subSize - 1 ? "CH\u2083" : "CH\u2082";
              parts.push(
                '<g><circle class="atom" cx="' + nx + '" cy="' + ny + '" r="16"></circle>' +
                '<text class="atom-label" x="' + nx + '" y="' + ny + '">' + chainLabel + "</text></g>"
              );
            }

            prevPt = { x: nx, y: ny };
          }
        } else {
          // Draw single label for heteroatoms (F, Cl, Br, OH, NH2, etc.)
          parts.push(bondLineMarkup(ring[atom], substituentPoints[atom], 1));
          allSvgPoints.push(substituentPoints[atom]);
          if (isBondLine) {
            parts.push(
              '<text class="bondline-substituent" x="' +
              substituentPoints[atom].x +
              '" y="' +
              substituentPoints[atom].y +
              '">' +
              escapeHtml(sequence[atom].label) +
              "</text>"
            );
          } else {
            parts.push(
              '<g><circle class="atom substituent-atom" cx="' +
              substituentPoints[atom].x +
              '" cy="' +
              substituentPoints[atom].y +
              '" r="19"></circle><text class="atom-label" x="' +
              substituentPoints[atom].x +
              '" y="' +
              substituentPoints[atom].y +
              '">' +
              escapeHtml(sequence[atom].label) +
              "</text></g>"
            );
          }
        }
      }
    }

    if (!isBondLine) {
      for (var ringAtom = 0; ringAtom < 6; ringAtom += 1) {
        parts.push(
          '<g><circle class="atom" cx="' +
          ring[ringAtom].x +
          '" cy="' +
          ring[ringAtom].y +
          '" r="20"></circle><text class="atom-label" x="' +
          ring[ringAtom].x +
          '" y="' +
          ring[ringAtom].y +
          '">' +
          (sequence[ringAtom] ? "C" : "CH") +
          "</text></g>"
        );
      }
    }

    parts.push("</svg>");
    return parts.join("");
  }

  function unsupportedFormulaHints(parsed, family) {
    if (parsed.carbon > MAX_CARBONS && family !== "fused_aromatic") {
      return ["Use a supported IUPAC name for one structure", "Try C12H26 or smaller", "Keep Auto mode on"];
    }
    if (family && FAMILY_INFO[family]) {
      return ["Switch back to Auto", "Check the family formula " + FAMILY_INFO[family].pattern];
    }
    return ["Try Auto mode", "Try CnH2n+2 for alkanes", "Try a name like isobutane"];
  }

  function formulaSuggestions(parsed, family) {
    if (!parsed || !parsed.carbon) {
      return [];
    }

    var families = family && family !== "auto" && FAMILY_INFO[family]
      ? [family]
      : parsed.halogen
      ? ["haloalkane"]
      : parsed.oxygen && (parsed.elements.N || 0) > 0
      ? ["alcohol", "ether", "aldehyde", "ketone", "ester", "carboxylic acid", "amide", "nitro", "nitrile"]
      : parsed.oxygen
      ? ["alcohol", "ether", "aldehyde", "ketone", "ester", "carboxylic acid"]
      : (parsed.elements.N || 0) > 0
      ? ["amine", "nitrile", "amide", "nitro"]
      : ["alkane", "alkene", "alkyne", "aromatic", "cycloalkane", "cycloalkene", "diene"];
    var ranked = [];
    var seen = new Set();

    for (var i = 0; i < families.length; i += 1) {
      var candidateFamily = families[i];
      if (parsed.carbon < familyMinimumCarbon(candidateFamily)) {
        continue;
      }
      var hydrogen = expectedHydrogenForFamily(parsed.carbon, candidateFamily);
      if (!hydrogen || hydrogen < 1) {
        continue;
      }
      var halogen = candidateFamily === "haloalkane" ? halogenElements(parsed)[0] || "Br" : null;
      var elements = formulaElementsForFamily(parsed.carbon, hydrogen, candidateFamily, halogen);
      var formula = formatMolecularFormula(elements);
      if (seen.has(formula)) {
        continue;
      }
      seen.add(formula);
      ranked.push({
        formula: formula,
        distance: Math.abs(hydrogen - parsed.hydrogen),
        family: candidateFamily
      });
    }

    if (parsed.carbon > MAX_CARBONS && family !== "fused_aromatic") {
      var fallback = formatFormula(MAX_CARBONS, expectedHydrogenForFamily(MAX_CARBONS, "alkane"));
      if (!seen.has(fallback)) {
        ranked.push({ formula: fallback, distance: parsed.carbon - MAX_CARBONS + 1, family: "alkane" });
      }
    }

    ranked.sort(function (a, b) {
      return a.distance - b.distance || compareStrings(a.family, b.family) || compareStrings(a.formula, b.formula);
    });

    return ranked.slice(0, 4).map(function (item) {
      return item.formula;
    });
  }

  function unsupportedFormula(parsed, dbe, family, message, candidates) {
    var suggestions = formulaSuggestions(parsed, family);
    return {
      status: "unsupported",
      formula: parsed.formula,
      carbon: parsed.carbon,
      hydrogen: parsed.hydrogen,
      dbe: dbe,
      family: family,
      familyLabel: family && FAMILY_INFO[family] ? FAMILY_INFO[family].label : "Hydrocarbon",
      candidates: candidates || [],
      popupTitle: parsed.carbon > MAX_CARBONS ? "That formula is valid, but too large here" : "That formula does not exist as written",
      suggestions: suggestions,
      suggestionLabel: suggestions.length ? "Did you mean one of these formulas?" : "",
      hints: unsupportedFormulaHints(parsed, family),
      message: message
    };
  }

  function unsupportedFamily(parsed, dbe, family, candidates) {
    return {
      status: "unsupported",
      formula: parsed.formula,
      carbon: parsed.carbon,
      hydrogen: parsed.hydrogen,
      dbe: dbe,
      family: family,
      familyLabel: FAMILY_INFO[family].label,
      candidates: candidates || [],
      popupTitle: "This compound family is not supported yet",
      hints: ["Try a supported family mode", "Keep Auto mode on to identify supported structures"],
      message: "The formula is valid for " + FAMILY_INFO[family].label.toLowerCase() +
        ", but this app does not yet enumerate that family reliably."
    };
  }

  function unsupportedNamedFamily(name, analysis) {
    return {
      status: "unsupported",
      formula: analysis.formula,
      family: analysis.family,
      familyLabel: analysis.familyLabel || FAMILY_INFO[analysis.family].label,
      popupTitle: "This compound family is not supported yet",
      hints: ["Try a supported example from the carousel", "Keep Auto mode on to identify supported structures"],
      message: '"' + name + '" is recognized as a ' + FAMILY_INFO[analysis.family].label.toLowerCase() +
        ", but this app does not yet enumerate that family reliably."
    };
  }

  // Structural-correctness gate. Every enumerated isomer is rebuilt as an
  // explicit atoms+bonds molecule (the same model the 3D viewer renders) and
  // validated for connectivity, valence, and formula agreement with the
  // query. A family whose generator emits an invalid graph fails closed:
  // the formula reports unsupported instead of showing a wrong structure.
  function validateEnumeratedIsomers(family, isomers, parsed) {
    for (var i = 0; i < isomers.length; i += 1) {
      var model = molecule3DModel(isomers[i]);
      var atoms = model.atoms.map(function (atom, atomIndex) {
        return {
          // Numeric id: the model's bonds address atoms by array index, and
          // the hydrogen inference in graph-model matches bonds by that id.
          element: atom.element,
          id: atomIndex,
          label: atom.label,
          hydrogens: null,
          charge: atom.charge == null ? null : atom.charge
        };
      });
      var report = graphModel.validateMolecule(atoms, model.bonds, {
        formula: parsed.formula
      });
      if (!report.ok) {
        return report.problems[0];
      }
    }
    return null;
  }

  // Ambiguity helper for Auto mode: when one formula matches several
  // bounded families the label text names the alternatives instead of
  // silently flattening the formula to one family.
  function familyAmbiguityNote(family, candidates) {
    if (!candidates || candidates.length < 2) {
      return null;
    }
    var otherLabels = candidates
      .filter(function (candidate) { return candidate !== family && FAMILY_INFO[candidate]; })
      .map(function (candidate) { return FAMILY_INFO[candidate].label; });
    if (!otherLabels.length) {
      return null;
    }
    return " \u00b7 also matches " + otherLabels.join(", ") +
      (otherLabels.length === 1 ? " \u2014 pick that family in Mode to enumerate it" :
        " \u2014 pick a family in Mode to enumerate each pattern");
  }

  function analyzeFormula(input, selectedFamily) {
    var parsed;
    try {
      parsed = parseFormula(input);
    } catch (error) {
      return { status: "error", message: error.message };
    }

    var maxHydrogen = parsed.carbon * 2 + 2;
    var dbeNumerator = maxHydrogen - parsed.hydrogen - (parsed.halogen || 0) + (parsed.elements.N || 0);

    if (dbeNumerator < 0) {
      var saturatedSuggestions = formulaSuggestions(parsed, selectedFamily);
      return {
        status: "error",
        formula: parsed.formula,
        popupTitle: "That formula does not exist as written",
        suggestions: saturatedSuggestions,
        suggestionLabel: saturatedSuggestions.length ? "Did you mean one of these formulas?" : "",
        message: parsed.formula + " has more hydrogens than a valid neutral compound can hold."
      };
    }

    if (dbeNumerator % 2 !== 0) {
      var neutralSuggestions = formulaSuggestions(parsed, selectedFamily);
      return {
        status: "error",
        formula: parsed.formula,
        popupTitle: "That formula does not exist as written",
        suggestions: neutralSuggestions,
        suggestionLabel: neutralSuggestions.length ? "Did you mean one of these formulas?" : "",
        message: parsed.formula + " gives a half-integer unsaturation value, so it is not a valid neutral hydrocarbon formula."
      };
    }

    var dbe = dbeNumerator / 2;
    var family = selectedFamily && selectedFamily !== "auto" ? selectedFamily : detectFamily(parsed);
    var familyCandidates = selectedFamily && selectedFamily !== "auto" ? [] : detectFamilyCandidates(parsed);

    if (!family || !FAMILY_INFO[family]) {
      return unsupportedFormula(
        parsed,
        dbe,
        null,
        parsed.formula +
          " does not match the built-in alkane, alkene, alkyne, or single-ring aromatic formulas.",
        familyCandidates
      );
    }

    if (parsed.carbon < familyMinimumCarbon(family)) {
      return unsupportedFormula(
        parsed,
        dbe,
        family,
        FAMILY_INFO[family].label + " mode needs at least C" + familyMinimumCarbon(family) + ".",
        familyCandidates
      );
    }

    if (!formulaMatchesFamily(parsed, family)) {
      return unsupportedFormula(
        parsed,
        dbe,
        family,
        parsed.formula + " does not match " + FAMILY_INFO[family].label.toLowerCase() + " formula " + FAMILY_INFO[family].pattern + ".",
        familyCandidates
      );
    }

    if (parsed.carbon > MAX_CARBONS && family !== "fused_aromatic") {
      return unsupportedFormula(
        parsed,
        dbe,
        family,
        "This app currently enumerates each family up to C" +
          MAX_CARBONS +
          ". Larger formulas grow quickly and need a heavier cheminformatics backend.",
        familyCandidates
      );
    }

    if (parsed.carbon > familyMaximumCarbon(family)) {
      return unsupportedFormula(
        parsed,
        dbe,
        family,
        FAMILY_INFO[family].label + " enumeration is currently bounded to C" +
          familyMaximumCarbon(family) + " to keep results exact and responsive.",
        familyCandidates
      );
    }

    if (!ENUMERATED_FAMILIES[family]) {
      return unsupportedFamily(parsed, dbe, family, familyCandidates);
    }

    var isomers = [];

    if (family === "alkane") {
      isomers = generateAlkaneIsomers(parsed.carbon).map(function (isomer) {
        var naming = nameAlkane(isomer.adjacency);
        return {
          family: family,
          canonical: isomer.canonical,
          adjacency: isomer.adjacency,
          edgeOrders: null,
          name: naming.name,
          commonNames: nameAliases(naming.name),
          chain: naming.chain,
          substituents: naming.substituents
        };
      });
    } else if (family === "alkene" || family === "alkyne") {
      var bondOrder = family === "alkene" ? 2 : 3;
      var unsaturatedIsomers = family === "alkene"
        ? generateAlkeneIsomers(parsed.carbon)
        : generateAlkyneIsomers(parsed.carbon);
      isomers = unsaturatedIsomers.map(function (isomer) {
        var naming = nameUnsaturatedAcyclic(isomer.adjacency, isomer.multipleBond, bondOrder);
        return {
          family: family,
          canonical: isomer.canonical,
          adjacency: isomer.adjacency,
          edgeOrders: isomer.edgeOrders,
          multipleBond: isomer.multipleBond,
          bondOrder: bondOrder,
          name: naming.name,
          commonNames: nameAliases(naming.name),
          chain: naming.chain,
          substituents: naming.substituents
        };
      });
      // Classify unsaturated isomers: chain (different carbon skeleton) vs positional (same skeleton, different bond position)
      // Compare each isomer's skeleton to the linear (straight-chain) skeleton.
      // Isomers on the straight-chain skeleton are "positional"; isomers on branched skeletons are "chain".
      var linearAdj = linearAdjacency(parsed.carbon);
      var linearCanon = freeCanonical(linearAdj);
      for (var ui = 0; ui < isomers.length; ui += 1) {
        var skelCanon = freeCanonical(isomers[ui].adjacency);
        isomers[ui].isomerType = skelCanon === linearCanon ? "positional" : "chain";
        // For alkenes: check if geometric isomerism is possible (each C=C carbon has two different groups)
        if (family === "alkene" && isomers[ui].multipleBond) {
          var mb = isomers[ui].multipleBond;
          var adj = isomers[ui].adjacency;
          if (adj[mb[0]] && adj[mb[1]]) {
            var neighbors0 = adj[mb[0]].slice();
            var neighbors1 = adj[mb[1]].slice();
            neighbors0.splice(neighbors0.indexOf(mb[1]), 1);
            neighbors1.splice(neighbors1.indexOf(mb[0]), 1);
            if (neighbors0.length >= 1 && neighbors1.length >= 1) {
              isomers[ui].hasGeometric = true;
              isomers[ui].geoType = "cis";
            }
          }
        }
      }
    } else if (family === "cycloalkane") {
      isomers = generateCycloalkaneIsomers(parsed.carbon).map(function (isomer) {
        var cyclicAdjacency = adjacencyWithRingBond(isomer.adjacency, isomer.ringBond);
        var naming = nameCycloalkaneGraph(cyclicAdjacency);
        return {
          family: family,
          canonical: isomer.canonical,
          adjacency: isomer.adjacency,
          edgeOrders: isomer.edgeOrders,
          ringBond: isomer.ringBond,
          name: naming.name,
          commonNames: [],
          chain: null,
          substituents: naming.substituents
        };
      });
    } else if (family === "aromatic") {
      isomers = generateAromaticIsomers(parsed.carbon).map(function (isomer) {
        return {
          family: family,
          canonical: isomer.canonical,
          name: isomer.name,
          commonNames: nameAliases(isomer.name),
          sequence: isomer.sequence,
          substituents: isomer.substituents
        };
      });
    } else if (family === "haloalkane") {
      var halogen = halogenElements(parsed)[0];
      isomers = generateHaloalkaneIsomers(parsed.carbon, halogen);
    } else if (family === "alcohol") {
      isomers = generateAlcoholIsomers(parsed.carbon);
    } else if (family === "amine") {
      isomers = generateAmineIsomers(parsed.carbon);
    } else if (family === "ether") {
      isomers = generateEtherIsomers(parsed.carbon, parsed.oxygen);
    } else if (family === "ester") {
      isomers = generateEsterIsomers(parsed.carbon);
    } else if (family === "carboxylic acid") {
      isomers = generateCarboxylicAcidIsomers(parsed.carbon);
    } else if (family === "aldehyde") {
      isomers = generateAldehydeIsomers(parsed.carbon);
    } else if (family === "ketone") {
      isomers = generateKetoneIsomers(parsed.carbon);
    } else if (family === "cycloalkene") {
      isomers = generateCycloalkeneIsomers(parsed.carbon);
    } else if (family === "diene") {
      isomers = generateDieneIsomers(parsed.carbon);
    } else if (family === "bicyclic") {
      isomers = generateBicyclicIsomers(parsed.carbon);
    } else if (family === "fused_aromatic") {
      isomers = fusedAromaticIsomers(parsed.carbon);
    } else if (family === "nitrile") {
      isomers = generateNitrileIsomers(parsed.carbon);
    } else if (family === "nitro") {
      isomers = generateNitroIsomers(parsed.carbon);
    } else if (family === "amide") {
      isomers = generateAmideIsomers(parsed.carbon);
    } else if (family === "general_hydrocarbon") {
      isomers = generateGeneralHeteroatomIsomers(parsed.carbon, [], parsed.dbe || 0);
    } else if (family === "general_heteroatom") {
      var he = [];
      if (parsed.oxygen > 0) he.push({ element: "O", label: "O", kind: "hetero", hydrogens: 0 });
      if ((parsed.elements.N || 0) > 0) he.push({ element: "N", label: "N", kind: "hetero", hydrogens: 0 });
      if ((parsed.elements.F || 0) > 0) he.push({ element: "F", label: "F", kind: "hetero", hydrogens: 0 });
      if ((parsed.elements.Cl || 0) > 0) he.push({ element: "Cl", label: "Cl", kind: "hetero", hydrogens: 0 });
      if ((parsed.elements.Br || 0) > 0) he.push({ element: "Br", label: "Br", kind: "hetero", hydrogens: 0 });
      if ((parsed.elements.I || 0) > 0) he.push({ element: "I", label: "I", kind: "hetero", hydrogens: 0 });
      isomers = generateGeneralHeteroatomIsomers(parsed.carbon, he, parsed.dbe || 0);
    }

    isomers.sort(function (a, b) {
      return compareStrings(a.name, b.name);
    });

    if (!isomers.length || isomers.some(function (isomer) {
      return isomer.formula && isomer.formula !== parsed.formula;
    })) {
      return unsupportedFamily(parsed, dbe, family, familyCandidates);
    }

    var validationProblem = validateEnumeratedIsomers(family, isomers, parsed);
    if (validationProblem) {
      return unsupportedFamily(parsed, dbe, family, familyCandidates);
    }

    return {
      status: "ok",
      family: family,
      familyLabel: FAMILY_INFO[family].label,
      familyPattern: FAMILY_INFO[family].pattern,
      scope: FAMILY_INFO[family].description,
      candidates: familyCandidates,
      ambiguityNote: familyCandidates.length > 1 ? familyAmbiguityNote(family, familyCandidates) : null,
      formula: parsed.formula,
      elements: parsed.elements,
      carbon: parsed.carbon,
      hydrogen: parsed.hydrogen,
      dbe: dbe,
      isomers: isomers
    };
  }

  function addNameIndexEntry(index, isomer, analysis, aliases) {
    var baseEntry = {
      name: isomer.name,
      commonNames: aliases || [],
      formula: analysis.formula,
      family: analysis.family,
      familyLabel: analysis.familyLabel,
      canonical: isomer.canonical
    };
    var names = [{ value: isomer.name, common: false }].concat((aliases || []).map(function (alias) {
      return { value: alias, common: true };
    }));

    for (var i = 0; i < names.length; i += 1) {
      var strict = normalizeName(names[i].value);
      var loose = looseNameKey(names[i].value);
      var entry = Object.assign({}, baseEntry, {
        matchedInputName: names[i].value,
        matchedAlias: names[i].common ? names[i].value : null
      });
      if (strict && !index.strict.has(strict)) {
        index.strict.set(strict, entry);
      }
      if (loose && !index.loose.has(loose)) {
        index.loose.set(loose, entry);
      }
    }
  }

  function nameAliases(name) {
    return COMMON_NAME_ALIASES[name] || [];
  }

  function buildLinearBranch(adjacency, attachAtom, length) {
    var first = null;
    var previous = attachAtom;
    for (var i = 0; i < length; i += 1) {
      var node = adjacency.length;
      adjacency.push([]);
      adjacency[previous].push(node);
      adjacency[node].push(previous);
      if (first === null) {
        first = node;
      }
      previous = node;
    }
    return first;
  }

  function buildBranchedSubstituent(adjacency, attachAtom, type) {
    if (type === "isopropyl") {
      var c1 = buildLinearBranch(adjacency, attachAtom, 1);
      buildLinearBranch(adjacency, c1, 1);
      buildLinearBranch(adjacency, c1, 1);
    } else if (type === "isobutyl") {
      var c1 = buildLinearBranch(adjacency, attachAtom, 1);
      var c2 = buildLinearBranch(adjacency, c1, 1);
      buildLinearBranch(adjacency, c2, 1);
      buildLinearBranch(adjacency, c2, 1);
    } else if (type === "sec-butyl") {
      var c1 = buildLinearBranch(adjacency, attachAtom, 1);
      buildLinearBranch(adjacency, c1, 1);
      var c3 = buildLinearBranch(adjacency, c1, 1);
      buildLinearBranch(adjacency, c3, 1);
    } else if (type === "tert-butyl") {
      var c1 = buildLinearBranch(adjacency, attachAtom, 1);
      buildLinearBranch(adjacency, c1, 1);
      buildLinearBranch(adjacency, c1, 1);
      buildLinearBranch(adjacency, c1, 1);
    } else if (type === "neopentyl") {
      var c1 = buildLinearBranch(adjacency, attachAtom, 1);
      var c2 = buildLinearBranch(adjacency, c1, 1);
      buildLinearBranch(adjacency, c2, 1);
      buildLinearBranch(adjacency, c2, 1);
      buildLinearBranch(adjacency, c2, 1);
    }
  }

  var COMMON_COMPOUND_ALIASES = {
    "isopropyl bromide": "2-bromopropane",
    "isopropyl chloride": "2-chloropropane",
    "isopropyl fluoride": "2-fluoropropane",
    "isopropyl iodide": "2-iodopropane",
    "tert-butyl bromide": "2-bromo-2-methylpropane",
    "tert-butyl chloride": "2-chloro-2-methylpropane",
    "tert-butyl fluoride": "2-fluoro-2-methylpropane",
    "tert-butyl iodide": "2-iodo-2-methylpropane",
    "isobutyl bromide": "1-bromo-2-methylpropane",
    "isobutyl chloride": "1-chloro-2-methylpropane",
    "isobutyl fluoride": "1-fluoro-2-methylpropane",
    "isobutyl iodide": "1-iodo-2-methylpropane",
    "sec-butyl bromide": "2-bromobutane",
    "sec-butyl chloride": "2-chlorobutane",
    "sec-butyl fluoride": "2-fluorobutane",
    "sec-butyl iodide": "2-iodobutane",
    "neopentyl bromide": "1-bromo-2,2-dimethylpropane",
    "neopentyl chloride": "1-chloro-2,2-dimethylpropane",
    "neopentyl fluoride": "1-fluoro-2,2-dimethylpropane",
    "neopentyl iodide": "1-iodo-2,2-dimethylpropane",
    "vinyl chloride": "chloroethene",
    "vinyl bromide": "bromoethene",
    "allyl bromide": "3-bromoprop-1-ene",
    "allyl chloride": "3-chloroprop-1-ene",
    "benzyl chloride": "(chloromethyl)benzene",
    "benzyl bromide": "(bromomethyl)benzene",
    "phenylmethanol": "benzenemethanol",
    "vinylbenzene": "ethenylbenzene",
    "isopropyl alcohol": "propan-2-ol",
    "tert-butyl alcohol": "2-methylpropan-2-ol",
    "isobutyl alcohol": "2-methylpropan-1-ol",
    "sec-butyl alcohol": "butan-2-ol",
    "neopentyl alcohol": "2,2-dimethylpropan-1-ol",
    "ethyl alcohol": "ethanol",
    "methyl alcohol": "methanol",
    "propyl alcohol": "propan-1-ol",
    "butyl alcohol": "butan-1-ol",
    "acetic acid": "ethanoic acid",
    "formic acid": "methanoic acid",
    "propionic acid": "propanoic acid",
    "butyric acid": "butanoic acid",
    "valeric acid": "pentanoic acid",
    "caproic acid": "hexanoic acid",
    "formaldehyde": "methanal",
    "acetaldehyde": "ethanal",
    "propionaldehyde": "propanal",
    "butyraldehyde": "butanal",
    "acetone": "propan-2-one",
    "acetophenone": "1-phenylethan-1-one",
    "diethyl ether": "ethoxyethane",
    "dimethyl ether": "methoxymethane",
    "methyl tert-butyl ether": "2-methoxy-2-methylpropane",
    "methylamine": "methanamine",
    "ethylamine": "ethanamine",
    "propylamine": "propan-1-amine",
    "isopropylamine": "propan-2-amine",
    "aniline": "benzenamine",
    "phenol": "hydroxybenzene",
    "benzoic acid": "benzoicacid",
    "benzaldehyde": "formylbenzene",
    "styrene": "vinylbenzene",
    "anisole": "methoxybenzene",
    "pyridine": "azine",
    "furan": "furan",
    "pyrrole": "pyrrole",
    "thiophene": "thiophene",
    "imidazole": "imidazole",
    "naphthalene": "naphthalene",
    "cresol": "methylphenol",
    "o-cresol": "2-methylphenol",
    "m-cresol": "3-methylphenol",
    "p-cresol": "4-methylphenol",
    "benzyl alcohol": "phenylmethanol",
    "catechol": "benzene-1,2-diol",
    "resorcinol": "benzene-1,3-diol",
    "hydroquinone": "benzene-1,4-diol"
  };

  function formulaFromGraph(adjacency, edgeOrders) {
    var hydrogens = 0;
    for (var atom = 0; atom < adjacency.length; atom += 1) {
      var carbonHydrogens = 4 - weightedValence(adjacency, atom, edgeOrders);
      if (carbonHydrogens < 0) {
        throw new Error("The name creates a carbon with too many bonds.");
      }
      hydrogens += carbonHydrogens;
    }
    return formatFormula(adjacency.length, hydrogens);
  }

  function attachmentCountForAtom(attachments, atom) {
    if (!attachments) {
      return 0;
    }
    // Attachments consume as many bonds as their bond order: a C=O group
    // (bondOrder 2) leaves the carbonyl carbon with no leftover hydrogens.
    var count = 0;
    for (var i = 0; i < attachments.length; i += 1) {
      if (attachments[i].atom === atom) {
        count += attachments[i].bondOrder || 1;
      }
    }
    return count;
  }

  function formulaFromDerivativeGraph(adjacency, attachments, edgeOrders) {
    var elements = { C: adjacency.length, H: 0, O: 0, F: 0, Cl: 0, Br: 0, I: 0, N: 0 };
    for (var atom = 0; atom < adjacency.length; atom += 1) {
      var carbonHydrogens = 4 - weightedValence(adjacency, atom, edgeOrders) - attachmentCountForAtom(attachments, atom);
      if (carbonHydrogens < 0) {
        throw new Error("The name creates a carbon with too many bonds.");
      }
      elements.H += carbonHydrogens;
    }
    for (var i = 0; i < (attachments || []).length; i += 1) {
      var attachment = attachments[i];
      elements[attachment.element] = (elements[attachment.element] || 0) + 1;
      // Groups such as -NO2 or -CN carry extra atoms of their own.
      if (attachment.extraElements) {
        for (var extra in attachment.extraElements) {
          elements[extra] = (elements[extra] || 0) + attachment.extraElements[extra];
        }
      }
      if (attachment.carbons) {
        elements.C += attachment.carbons;
      }
      elements.H += attachment.hydrogens || 0;
    }
    return {
      formula: formatMolecularFormula(elements),
      elements: elements,
      hydrogen: elements.H
    };
  }

  function rootedCanonicalLabeled(adjacency, labels, node, parent) {
    var childCodes = [];
    for (var i = 0; i < adjacency[node].length; i += 1) {
      var next = adjacency[node][i];
      if (next !== parent) {
        childCodes.push(rootedCanonicalLabeled(adjacency, labels, next, node));
      }
    }
    childCodes.sort(compareStrings);
    return labels[node] + "(" + childCodes.join("") + ")";
  }

  function freeCanonicalLabeled(adjacency, labels) {
    var codes = [];
    for (var i = 0; i < adjacency.length; i += 1) {
      codes.push(rootedCanonicalLabeled(adjacency, labels, i, -1));
    }
    codes.sort(compareStrings);
    return codes[0];
  }

  function derivativeCanonicalWithAttachments(adjacency, attachments) {
    var extended = adjacency.map(function (neighbors) {
      return neighbors.slice();
    });
    var labels = adjacency.map(function () {
      return "C";
    });
    for (var i = 0; i < (attachments || []).length; i += 1) {
      var attachment = attachments[i];
      var hetero = extended.length;
      extended.push([attachment.atom]);
      extended[attachment.atom].push(hetero);
      labels.push(attachment.label);
      if (attachment.hydrogens) {
        var hydrogen = extended.length;
        extended.push([hetero]);
        extended[hetero].push(hydrogen);
        labels.push("H");
      }
    }
    return freeCanonicalLabeled(extended, labels);
  }

  function derivativeCanonical(adjacency, atom, attachment) {
    return derivativeCanonicalWithAttachments(adjacency, [{
      atom: atom,
      element: attachment.element,
      label: attachment.label,
      kind: attachment.kind,
      hydrogens: attachment.hydrogens || 0
    }]);
  }

  function cloneAdjacency(adjacency) {
    return adjacency.map(function (neighbors) {
      return neighbors.slice();
    });
  }

  function cloneEdgeOrders(edgeOrders) {
    return edgeOrders ? new Map(edgeOrders) : null;
  }

  function straightChainDerivativeName(carbonCount, locant, attachment) {
    if (attachment.kind === "alcohol") {
      if (carbonCount === 1) {
        return "methanol";
      }
      if (carbonCount === 2) {
        return "ethanol";
      }
      return ALKANE_NAMES[carbonCount].replace(/e$/, "") + "-" + locant + "-ol";
    }
    return locant + "-" + HALOGEN_PREFIXES[attachment.element] + ALKANE_NAMES[carbonCount];
  }

  function alcoholParentName(chainLength, locant) {
    if (chainLength === 1) {
      return "methanol";
    }
    if (chainLength === 2) {
      return "ethanol";
    }
    return ALKANE_NAMES[chainLength].replace(/e$/, "") + "-" + locant + "-ol";
  }

  function amineParentName(chainLength, locant) {
    if (chainLength === 1) {
      return "methanamine";
    }
    if (chainLength === 2) {
      return "ethanamine";
    }
    return ALKANE_NAMES[chainLength].replace(/e$/, "") + "-" + locant + "-amine";
  }

  function compareDerivativeNameCandidates(a, b) {
    if (a.functionalLocant !== b.functionalLocant) {
      return a.functionalLocant - b.functionalLocant;
    }
    if (a.substituentCount !== b.substituentCount) {
      return b.substituentCount - a.substituentCount;
    }
    var locantCompare = compareNumberArrays(a.locants, b.locants);
    if (locantCompare) {
      return locantCompare;
    }
    return compareStrings(a.name, b.name);
  }

  function buildDerivativeNameCandidate(adjacency, chain, atom, attachment, memo) {
    var locant = chain.indexOf(atom) + 1;
    var substituents = getSubstituentsForChain(adjacency, chain, memo, null);
    var groups = substituents.slice();
    var name;

    if (attachment.kind === "alcohol") {
      var prefix = formatSubstituentGroups(substituents);
      name = (prefix ? prefix : "") + alcoholParentName(chain.length, locant);
    } else if (attachment.kind === "amine") {
      var aminePrefix = formatSubstituentGroups(substituents);
      name = (aminePrefix ? aminePrefix : "") + amineParentName(chain.length, locant);
    } else {
      groups.push({
        locant: locant,
        name: HALOGEN_PREFIXES[attachment.element],
        sortKey: HALOGEN_PREFIXES[attachment.element],
        carbonCount: 0
      });
      name = formatSubstituentGroups(groups) + ALKANE_NAMES[chain.length];
    }

    var locants = groups.map(function (sub) {
      return sub.locant;
    }).sort(function (a, b) {
      return a - b;
    });

    return {
      name: name,
      chain: chain,
      substituents: substituents,
      substituentCount: substituents.length,
      functionalLocant: locant,
      locants: locants
    };
  }

  function derivativeName(adjacency, atom, attachment) {
    var memo = new Map();
    var chains = allLongestChains(adjacency).filter(function (chain) {
      return chain.indexOf(atom) !== -1;
    });
    var candidates = [];

    for (var i = 0; i < chains.length; i += 1) {
      candidates.push(buildDerivativeNameCandidate(adjacency, chains[i], atom, attachment, memo));
      if (chains[i].length > 1) {
        candidates.push(buildDerivativeNameCandidate(adjacency, chains[i].slice().reverse(), atom, attachment, memo));
      }
    }

    candidates.sort(compareDerivativeNameCandidates);
    return candidates[0] ? candidates[0].name : attachment.label + " derivative of " + nameAlkane(adjacency).name;
  }

  // Shared IUPAC naming for suffix-style functional families. The principal
  // chain must contain the functional carbon, and each family has its own
  // spelling rule ("butanal", "butan-2-one", "butanoic acid", ...). Both the
  // generators in chemengine/families and the name parsers in this file call
  // it, so generated names and parsed names always round-trip.
  var FUNCTIONAL_GROUP_SUFFIXES = {
    aldehyde: function (stem, locant) { return stem.replace(/ane$/, "anal"); },
    ketone: function (stem, locant) { return stem.replace(/ane$/, "an-" + locant + "-one"); },
    "carboxylic acid": function (stem, locant) { return stem.replace(/e$/, "oic acid"); },
    nitrile: function (stem, locant) { return stem + "nitrile"; },
    amide: function (stem, locant) { return stem.replace(/e$/, "amide"); },
    amine: function (stem, locant) {
      if (locant === 1 && stem === "methane") return "methanamine";
      return stem.replace(/ane$/, "an-" + locant + "-amine");
    }
  };

  function buildFunctionalNameCandidate(adjacency, chain, anchor, kind, memo, extraGroups) {
    var locant = chain.indexOf(anchor) + 1;
    var substituents = getSubstituentsForChain(adjacency, chain, memo, null);
    var prefixGroups = substituents.concat(extraGroups || []);
    var stemName = ALKANE_NAMES[chain.length];
    var name;

    if (kind === "nitro") {
      if (stemName === "methane" && locant === 1 && !prefixGroups.length) {
        name = "nitromethane";
      } else {
        var groups = prefixGroups.slice();
        groups.push({
          locant: locant,
          name: "nitro",
          sortKey: "nitro",
          carbonCount: 0
        });
        name = formatSubstituentGroups(groups) + stemName;
      }
    } else {
      var prefix = formatSubstituentGroups(prefixGroups);
      name = prefix + FUNCTIONAL_GROUP_SUFFIXES[kind](stemName, locant);
    }

    var locants = prefixGroups.map(function (sub) {
      return sub.locant;
    }).sort(function (a, b) {
      return a - b;
    });

    return {
      name: name,
      chain: chain,
      substituents: substituents,
      substituentCount: prefixGroups.length,
      functionalLocant: locant,
      locants: locants
    };
  }

  function functionalGroupCandidates(adjacency, anchor, kind, extraGroups) {
    var memo = new Map();
    var chains = allLongestChains(adjacency).filter(function (chain) {
      return chain.indexOf(anchor) !== -1;
    });
    if (!chains.length) {
      chains = [longestPathContainingNode(adjacency, anchor)];
    }

    var anchorsAtChainEnd = kind === "aldehyde" || kind === "carboxylic acid" ||
      kind === "nitrile" || kind === "amide";

    function collect(source) {
      var collected = [];
      for (var i = 0; i < source.length; i += 1) {
        var orientations = [source[i]];
        if (source[i].length > 1) {
          orientations.push(source[i].slice().reverse());
        }
        for (var o = 0; o < orientations.length; o += 1) {
          var chain = orientations[o];
          var locant = chain.indexOf(anchor) + 1;
          // Suffix groups that define C1 must sit at the chain end; a ketone
          // carbonyl can never be terminal.
          if (anchorsAtChainEnd && locant !== 1) continue;
          if (kind === "ketone" && (locant < 2 || locant > chain.length - 1)) continue;
          collected.push(buildFunctionalNameCandidate(adjacency, chain, anchor, kind, memo, extraGroups));
        }
      }
      return collected;
    }

    var candidates = collect(chains);
    if (!candidates.length) {
      candidates = collect([longestPathContainingNode(adjacency, anchor)]);
    }
    candidates.sort(compareDerivativeNameCandidates);
    return candidates;
  }

  function functionalGroupName(adjacency, anchor, kind) {
    var best = functionalGroupBest(adjacency, anchor, kind);
    if (best) {
      return best.name;
    }
    return nameAlkane(adjacency).name + " " + kind + " derivative";
  }

  function functionalGroupBest(adjacency, anchor, kind, extraGroups) {
    var candidates = functionalGroupCandidates(adjacency, anchor, kind, extraGroups);
    return candidates[0] || null;
  }

    function findRingNodes(adjacency) {
    // Find which nodes belong to a cycle using a simple degree-peeling (Kahn-like) approach.
    var degree = adjacency.map(function (neighbors) {
      return neighbors.length;
    });
    var queue = [];
    for (var fi = 0; fi < degree.length; fi += 1) {
      if (degree[fi] <= 1) queue.push(fi);
    }
    while (queue.length > 0) {
      var node = queue.shift();
      for (var fi2 = 0; fi2 < adjacency[node].length; fi2 += 1) {
        var neighbor = adjacency[node][fi2];
        degree[neighbor] -= 1;
        if (degree[neighbor] === 1) queue.push(neighbor);
      }
    }
    // Remaining nodes with degree > 1 are in cycles
    var result = [];
    for (var fi3 = 0; fi3 < degree.length; fi3 += 1) {
      if (degree[fi3] > 1) result.push(fi3);
    }
    if (result.length === 0) {
      // For a monocyclic graph all nodes have degree >= 2, so all are ring nodes
      for (var fi4 = 0; fi4 < degree.length; fi4 += 1) {
        if (degree[fi4] >= 2) result.push(fi4);
      }
    }
    return result;
  }

  function cycloalkaneName(adjacency) {
    // Name based on carbon count in the ring
    var carbonCount = adjacency.length;
    var stem = EXTENDED_STEMS_REVERSE[carbonCount];
    if (!stem) stem = carbonCount + "";
    return "cyclo" + stem + "ane";
  }

  function cycloalkeneName(adjacency, doubleBond) {
    var carbonCount = adjacency.length;
    var stem = (typeof EXTENDED_STEMS_REVERSE !== "undefined" && EXTENDED_STEMS_REVERSE) ? EXTENDED_STEMS_REVERSE[carbonCount] : null;
    if (!stem) stem = carbonCount + "";
    var locant = Math.min(doubleBond[0], doubleBond[1]) + 1;
    return "cyclo" + stem + "-" + locant + "-ene";
  }

  function dieneName(adjacency, doubleBonds) {
    var carbonCount = adjacency.length;
    var stem = (typeof EXTENDED_STEMS_REVERSE !== "undefined" && EXTENDED_STEMS_REVERSE) ? EXTENDED_STEMS_REVERSE[carbonCount] : null;
    if (!stem) stem = carbonCount + "";
    var locants = doubleBonds.map(function (bond) {
      return Math.min(bond[0], bond[1]) + 1;
    });
    locants.sort(function (a, b) { return a - b; });
    return stem + "-" + locants.join(",") + "-diene";
  }

  function generalHydrocarbonName(adjacency, edgeOrders) {
    var carbonCount = adjacency.length;
    var stem = (typeof EXTENDED_STEMS_REVERSE !== "undefined" && EXTENDED_STEMS_REVERSE) ? EXTENDED_STEMS_REVERSE[carbonCount] : null;
    if (!stem) stem = carbonCount + "";
    var dbe = 0;
    var dbeFromRings = findRingNodes(adjacency).length > 0 ? 1 : 0;
    if (dbeFromRings > 0) {
      var degreeSum = 0;
      for (var gi = 0; gi < adjacency.length; gi += 1) {
        degreeSum += adjacency[gi].length;
      }
      dbe = degreeSum / 2 - adjacency.length + 1;
    }
    var multipleBondCount = countMultipleBonds(edgeOrders);
    dbe += multipleBondCount;
    if (dbe === 0) return stem + "ane";
    if (dbe === 1 && multipleBondCount === 1) {
      if (dbeFromRings > 0) return "cyclo" + stem + "ane";
      return stem + "ene";
    }
    if (dbe === 2 && multipleBondCount === 2) {
      return stem + "diene";
    }
    if (dbe >= 1 && multipleBondCount === 0) {
      var ringCount = dbe;
      if (ringCount === 1) return "cyclo" + stem + "ane";
      return stem + " (" + ringCount + "-ring hydrocarbon)";
    }
return stem + " (DBE=" + dbe + ")";
  }

    function generateGeneralHeteroatomIsomers(carbonCount, hetAtoms, dbe) {
    if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
      throw new Error("Carbon count must be between 1 and " + MAX_CARBONS + ".");
    }

    // Flatten hetAtoms into individual attachment specs
    var attachments = [];
    for (var hi = 0; hi < hetAtoms.length; hi += 1) {
      var ha = hetAtoms[hi];
      attachments.push({
        element: ha.element,
        label: ha.label || ha.element,
        kind: ha.kind || "hetero",
        hydrogens: ha.hydrogens || 0
      });
    }

    // If no heteroatoms, generate general hydrocarbon isomers
    if (attachments.length === 0) {
      return generateGeneralHydrocarbonIsomers(carbonCount, dbe || 0);
    }

    var seen = new Map();
    var skeletons = generateAlkaneIsomers(carbonCount);

    for (var si = 0; si < skeletons.length; si += 1) {
      var adjacency = skeletons[si].adjacency;

      // Use backtracking to place all attachments on distinct atoms
      var walk = function walkImpl(pos, atomPositions) {
        if (pos === attachments.length) {
          var atts = [];
          for (var ai = 0; ai < attachments.length; ai += 1) {
            var atomIndex = atomPositions[ai];
            if (weightedValence(adjacency, atomIndex, null) + attachmentCountForAtom(atts, atomIndex) >= 4) {
              return;
            }
            atts.push({
              atom: atomIndex,
              element: attachments[ai].element,
              label: attachments[ai].label,
              kind: attachments[ai].kind,
              hydrogens: attachments[ai].hydrogens
            });
          }

          var canonical = derivativeCanonicalWithAttachments(adjacency, atts);
          if (!seen.has(canonical)) {
            var formulaInfo = formulaFromDerivativeGraph(adjacency, atts, null);
            var parentName = nameAlkane(adjacency).name;
            var labelParts = [];
            for (var li = 0; li < atts.length; li += 1) {
              var lbl = atts[li].label;
              var posi = atts[li].atom + 1;
              labelParts.push(posi + "-" + lbl);
            }
            var displayName = labelParts.join(",") + " " + parentName;

            seen.set(canonical, {
              family: "general_heteroatom",
              canonical: canonical,
              adjacency: cloneAdjacency(adjacency),
              edgeOrders: null,
              attachments: atts,
              name: displayName,
              commonNames: [],
              chain: nameAlkane(adjacency).chain,
              substituents: nameAlkane(adjacency).substituents,
              formula: formulaInfo.formula
            });
          }
          return;
        }
        var start = pos === 0 ? 0 : atomPositions[pos - 1] + 1;
        for (var ai2 = start; ai2 < adjacency.length; ai2 += 1) {
          atomPositions[pos] = ai2;
          walk(pos + 1, atomPositions);
        }
      }

      walk(0, []);
    }

    return Array.from(seen.values()).sort(function (a, b) {
      return compareStrings(a.name, b.name);
    });
  }

  function generateGeneralHydrocarbonIsomers(carbonCount, targetDbe) {
    if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
      throw new Error("Carbon count must be between 1 and " + MAX_CARBONS + ".");
    }

    var cacheKey = carbonCount + ":" + targetDbe;
    if (GENERAL_HYDROCARBON_CACHE.data[cacheKey]) {
      return GENERAL_HYDROCARBON_CACHE.data[cacheKey];
    }

    var seen = new Map();
    var skeletons = generateAlkaneIsomers(carbonCount);

    for (var si = 0; si < skeletons.length; si += 1) {
      var adjacency = skeletons[si].adjacency;

      var edges = [];
      for (var a = 0; a < adjacency.length; a += 1) {
        for (var b = a + 1; b < adjacency.length; b += 1) {
          if (adjacency[a].indexOf(b) !== -1) {
            edges.push([a, b]);
          }
        }
      }

      var possibleEdges = [];
      for (var a2 = 0; a2 < adjacency.length; a2 += 1) {
        for (var b2 = a2 + 1; b2 < adjacency.length; b2 += 1) {
          if (adjacency[a2].indexOf(b2) === -1) {
            possibleEdges.push([a2, b2]);
          }
        }
      }

      if (targetDbe <= edges.length) {
        generateMultipleBondCombinations(adjacency, edges, targetDbe, seen);
      }

      if (targetDbe > 0 && possibleEdges.length > 0) {
        generateRingCombinations(adjacency, possibleEdges, targetDbe, seen);
      }
    }

    var result = Array.from(seen.values()).sort(function (a, b) {
      return compareStrings(a.name, b.name);
    });

    GENERAL_HYDROCARBON_CACHE.data[cacheKey] = result;
    return result;
  }

  function generateMultipleBondCombinations(adjacency, edges, targetCount, seen) {
    function recurse(idx, edgeOrders) {
      if (idx === edges.length) {
        if (countMultipleBonds(edgeOrders) === targetCount) {
          var isValid = true;
          for (var vi = 0; vi < adjacency.length; vi += 1) {
            if (weightedValence(adjacency, vi, edgeOrders) > 4) {
              isValid = false;
              break;
            }
          }
          if (isValid) {
            var canonical = freeCanonicalWeighted(adjacency, edgeOrders);
            if (!seen.has(canonical)) {
              seen.set(canonical, {
                family: "general_hydrocarbon",
                canonical: canonical,
                adjacency: cloneAdjacency(adjacency),
                edgeOrders: cloneEdgeOrders(edgeOrders),
                name: generalHydrocarbonName(adjacency, edgeOrders),
                commonNames: [],
                chain: null,
                substituents: []
              });
            }
          }
        }
        return;
      }
      // Option 1: skip this edge (single bond)
      recurse(idx + 1, edgeOrders);
      // Option 2: make this edge a double bond
      var edgeOrders2 = cloneEdgeOrders(edgeOrders);
      if (!edgeOrders2) edgeOrders2 = new Map();
      edgeOrders2.set(edgeKey(edges[idx][0], edges[idx][1]), 2);
      recurse(idx + 1, edgeOrders2);
    }
    recurse(0, null);
  }

  function generateRingCombinations(adjacency, possibleEdges, targetDbe, seen) {
    function recurse(idx, adj, edgeOrders) {
      if (idx === possibleEdges.length) {
        // Check if graph is now cyclic
        var ringNodes = findRingNodes(adj);
        if (ringNodes.length > 0) {
          var canonical = freeCanonicalWeighted(adj, edgeOrders);
          if (!seen.has(canonical)) {
            seen.set(canonical, {
              family: "general_hydrocarbon",
              canonical: canonical,
              adjacency: cloneAdjacency(adj),
              edgeOrders: cloneEdgeOrders(edgeOrders),
              name: generalHydrocarbonName(adj, edgeOrders),
              commonNames: [],
              chain: null,
              substituents: []
            });
          }
        }
        return;
      }
      // Skip this edge (don't add a ring)
      recurse(idx + 1, adj, edgeOrders);
      // Add this edge (form a ring)
      var edge = possibleEdges[idx];
      var newAdj = cloneAdjacency(adj);
      newAdj[edge[0]].push(edge[1]);
      newAdj[edge[1]].push(edge[0]);
      var newOrders = cloneEdgeOrders(edgeOrders);
      recurse(idx + 1, newAdj, newOrders);
    }
    recurse(0, cloneAdjacency(adjacency), null);
  }

  var generateMonosubstitutedAlkaneIsomers = algorithmModules.substitutedAlkane({
    MAX_CARBONS: MAX_CARBONS,
    generateAlkaneIsomers: generateAlkaneIsomers,
    weightedValence: weightedValence,
    derivativeCanonical: derivativeCanonical,
    formulaFromDerivativeGraph: formulaFromDerivativeGraph,
    cloneAdjacency: cloneAdjacency,
    derivativeName: derivativeName,
    nameAlkane: nameAlkane,
    compareStrings: compareStrings
  });
  var generateHaloalkaneIsomers = algorithmModules.haloalkane(generateMonosubstitutedAlkaneIsomers);
  var generateAlcoholIsomers = algorithmModules.alcohol(generateMonosubstitutedAlkaneIsomers);
  var generateAmineIsomers = algorithmModules.amine(generateMonosubstitutedAlkaneIsomers);

  // Shared molecule model (atoms, bonds, order, valence, rings). Every
  // enumerated isomer is re-validated against this model before display so
  // the drawn structure cannot drift from the engine's accounting.
  var graphModel = algorithmModules.graphModel(HALOGENS);

  var etherAlgorithmHelpers = {
    MAX_CARBONS: MAX_CARBONS,
    generateAlkaneIsomers: generateAlkaneIsomers,
    weightedValence: weightedValence,
    derivativeCanonical: derivativeCanonical,
    derivativeCanonicalWithAttachments: derivativeCanonicalWithAttachments,
    formulaFromDerivativeGraph: formulaFromDerivativeGraph,
    cloneAdjacency: cloneAdjacency,
    derivativeName: derivativeName,
    functionalGroupName: functionalGroupName,
    functionalGroupBest: functionalGroupBest,
    nameAlkane: nameAlkane,
    nameAlkaneAtAnchor: nameAlkaneAtAnchor,
    compareStrings: compareStrings,
    formatMolecularFormula: formatMolecularFormula,
    allLongestChains: allLongestChains
  };
  var generateEtherIsomers = algorithmModules.ether(etherAlgorithmHelpers);
  // The ester builds carbon+oxygen graphs through the same helpers the ether
  // exposes (canonical key, element-aware formula), so share them after the
  // ether module has created them.
  etherAlgorithmHelpers.etherCanonicalKey = generateEtherIsomers.canonicalKey;
  etherAlgorithmHelpers.etherFormulaForGraph = generateEtherIsomers.formulaForGraph;
  etherAlgorithmHelpers.etherAlkylFragment = generateEtherIsomers.alkylFragment;
  var generateEsterIsomers = algorithmModules.ester(etherAlgorithmHelpers);
  var generateCarboxylicAcidIsomers = algorithmModules.carboxylicAcid(etherAlgorithmHelpers);
  var generateAldehydeIsomers = algorithmModules.aldehyde(etherAlgorithmHelpers);
  var generateKetoneIsomers = algorithmModules.ketone(etherAlgorithmHelpers);
  var generateNitrileIsomers = algorithmModules.nitrile(etherAlgorithmHelpers);
  var generateAmideIsomers = algorithmModules.amide(etherAlgorithmHelpers);
  var generateNitroIsomers = algorithmModules.nitro(etherAlgorithmHelpers);

  function linearAdjacency(carbonCount) {
    var adjacency = [];
    for (var atom = 0; atom < carbonCount; atom += 1) {
      adjacency.push([]);
      if (atom > 0) {
        adjacency[atom - 1].push(atom);
        adjacency[atom].push(atom - 1);
      }
    }
    return adjacency;
  }

  function derivativeAnalysisFromLinearName(original, carbonCount, locant, attachment) {
    if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
      throw new Error("Carbon count must be between 1 and " + MAX_CARBONS + ".");
    }
    if (!Number.isInteger(locant) || locant < 1 || locant > carbonCount) {
      throw new Error("The functional-group locant must be inside the parent chain.");
    }

    var adjacency = linearAdjacency(carbonCount);
    var atom = locant - 1;
    var attachments = [{
      atom: atom,
      element: attachment.element,
      label: attachment.label,
      kind: attachment.kind,
      hydrogens: attachment.hydrogens || 0
    }];
    var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
    var family = attachment.kind === "alcohol" ? "alcohol" : "haloalkane";
    var canonical = derivativeCanonical(adjacency, atom, attachment);
    var name = straightChainDerivativeName(carbonCount, Math.min(locant, carbonCount - locant + 1), attachment);

    return {
      status: "ok",
      family: family,
      familyLabel: FAMILY_INFO[family].label,
      familyPattern: FAMILY_INFO[family].pattern,
      scope: "Parsed as a simple saturated hydrocarbon derivative with one functional group.",
      source: "parsed-name",
      queryName: original,
      matchedName: name,
      formula: formulaInfo.formula,
      elements: formulaInfo.elements,
      carbon: carbonCount,
      hydrogen: formulaInfo.hydrogen,
      dbe: 0,
      parsedOnly: true,
      isomers: [{
        family: family,
        canonical: "parsed:" + canonical,
        name: name,
        commonNames: [],
        adjacency: adjacency,
        edgeOrders: null,
        attachments: attachments,
        chain: Array.from({ length: carbonCount }, function (_, index) {
          return index;
        }),
        substituents: []
      }]
    };
  }

  function parseDerivativeName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var haloMatch = name.match(/^(\d+)-?(fluoro|chloro|bromo|iodo)(meth|eth|prop|but|pent|hex|hept|oct|non|dec|undec|dodec)ane$/);
    if (haloMatch) {
      var haloByPrefix = {
        fluoro: "F",
        chloro: "Cl",
        bromo: "Br",
        iodo: "I"
      };
      return derivativeAnalysisFromLinearName(original, EXTENDED_STEMS[haloMatch[3]], Number(haloMatch[1]), {
        kind: "haloalkane",
        element: haloByPrefix[haloMatch[2]],
        label: haloByPrefix[haloMatch[2]],
        hydrogens: 0
      });
    }

    var simpleHaloMatch = name.match(/^(fluoro|chloro|bromo|iodo)(meth|eth|prop|but|pent|hex|hept|oct|non|dec|undec|dodec)ane$/);
    if (simpleHaloMatch) {
      var simpleHaloByPrefix = {
        fluoro: "F",
        chloro: "Cl",
        bromo: "Br",
        iodo: "I"
      };
      return derivativeAnalysisFromLinearName(original, EXTENDED_STEMS[simpleHaloMatch[2]], 1, {
        kind: "haloalkane",
        element: simpleHaloByPrefix[simpleHaloMatch[1]],
        label: simpleHaloByPrefix[simpleHaloMatch[1]],
        hydrogens: 0
      });
    }

    if (name === "methanol") {
      return derivativeAnalysisFromLinearName(original, 1, 1, { kind: "alcohol", element: "O", label: "OH", hydrogens: 1 });
    }
    if (name === "ethanol") {
      return derivativeAnalysisFromLinearName(original, 2, 1, { kind: "alcohol", element: "O", label: "OH", hydrogens: 1 });
    }

    var defaultAlcoholMatch = name.match(/^(prop|but|pent|hex|hept|oct|non|dec|undec|dodec)anol$/);
    if (defaultAlcoholMatch) {
      return derivativeAnalysisFromLinearName(original, EXTENDED_STEMS[defaultAlcoholMatch[1]], 1, {
        kind: "alcohol",
        element: "O",
        label: "OH",
        hydrogens: 1
      });
    }

    var alcoholMatch =
      name.match(/^(meth|eth|prop|but|pent|hex|hept|oct|non|dec|undec|dodec)an-?(\d+)-?ol$/) ||
      name.match(/^(\d+)-?(meth|eth|prop|but|pent|hex|hept|oct|non|dec|undec|dodec)anol$/);
    if (alcoholMatch) {
      var locant;
      var stem;
      if (/^\d/.test(alcoholMatch[0])) {
        locant = Number(alcoholMatch[1]);
        stem = alcoholMatch[2];
      } else {
        stem = alcoholMatch[1];
        locant = Number(alcoholMatch[2]);
      }
      return derivativeAnalysisFromLinearName(original, EXTENDED_STEMS[stem], locant, {
        kind: "alcohol",
        element: "O",
        label: "OH",
        hydrogens: 1
      });
    }

    return null;
  }

  function parseSubstituentPrefix(prefix, parentLength) {
    var text = normalizeName(prefix).replace(/-$/, "");
    var substituents = [];
    if (!text) {
      return substituents;
    }

    while (text.length) {
      var match = text.match(/^(\d+(?:,\d+)*)-(?:(di|tri|tetra|penta|hexa|hepta|octa|nona|deca)?-?(isopropyl|isobutyl|sec-butyl|tert-butyl|neopentyl|methyl|ethyl|propyl|butyl|pentyl|hexyl|heptyl|octyl|nonyl|decyl|undecyl|dodecyl))/);
      if (!match) {
        throw new Error("I can parse straight-chain and branched alkyl branches such as 2-methyl, 4-ethyl, or 2-isopropyl, but this prefix is more complex.");
      }

      var locants = match[1].split(",").map(function (locant) {
        return Number(locant);
      });
      var multiplier = match[2] || "";
      var branchName = match[3];
      var expected = multiplier ? MULTIPLIER_COUNTS[multiplier] : 1;

      if (locants.length !== expected) {
        throw new Error(branchName + " has " + locants.length + " locants but the multiplier expects " + expected + ".");
      }

      var isBranched = BRANCHED_SUBSTITUENT_INFO[branchName];
      for (var i = 0; i < locants.length; i += 1) {
        if (!Number.isInteger(locants[i]) || locants[i] < 1 || locants[i] > parentLength) {
          throw new Error("Substituent locants must be inside the parent chain.");
        }
        substituents.push({
          locant: locants[i],
          name: branchName,
          length: isBranched ? isBranched.carbons : ALKYL_LENGTHS[branchName],
          sortKey: isBranched ? isBranched.sortKey : branchName,
          branched: isBranched ? branchName : null
        });
      }

      text = text.slice(match[0].length);
      if (text[0] === "-") {
        text = text.slice(1);
      } else if (text.length) {
        throw new Error("I could not read the next substituent in the IUPAC name.");
      }
    }

    return substituents;
  }

  function parseHaloalkanePrefix(prefix, parentLength) {
    var text = normalizeName(prefix).replace(/-$/, "");
    var substituents = [];
    var attachments = [];
    if (!text) {
      return { substituents: substituents, attachments: attachments };
    }

    while (text.length) {
      var alkylMatch = text.match(/^(\d+(?:,\d+)*)-(?:(di|tri|tetra|penta|hexa|hepta|octa|nona|deca)?-?(isopropyl|isobutyl|sec-butyl|tert-butyl|neopentyl|methyl|ethyl|propyl|butyl|pentyl|hexyl|heptyl|octyl|nonyl|decyl|undecyl|dodecyl))/);
      var haloMatch = text.match(/^(\d+(?:,\d+)*)-(?:(di|tri|tetra|penta|hexa|hepta|octa|nona|deca)?-?(fluoro|chloro|bromo|iodo))/);
      var match = alkylMatch || haloMatch;
      var isHalo = !alkylMatch && !!haloMatch;
      if (!match) {
        throw new Error("I can parse alkyl branches, branched substituents, and halogen prefixes such as 2-chloro, 4-isopropyl, or 1,1-dibromo, but this prefix is more complex.");
      }

      var locants = match[1].split(",").map(function (locant) {
        return Number(locant);
      });
      var multiplier = match[2] || "";
      var substituentName = match[3];
      var expected = multiplier ? MULTIPLIER_COUNTS[multiplier] : 1;

      if (locants.length !== expected) {
        throw new Error(substituentName + " has " + locants.length + " locants but the multiplier expects " + expected + ".");
      }

      for (var i = 0; i < locants.length; i += 1) {
        if (!Number.isInteger(locants[i]) || locants[i] < 1 || locants[i] > parentLength) {
          throw new Error("Substituent locants must be inside the parent chain.");
        }
        if (isHalo) {
          var element = HALOGEN_BY_PREFIX[substituentName];
          attachments.push({
            atom: locants[i] - 1,
            locant: locants[i],
            element: element,
            label: element,
            kind: "haloalkane",
            hydrogens: 0
          });
        } else {
          var isBranched = BRANCHED_SUBSTITUENT_INFO[substituentName];
          substituents.push({
            locant: locants[i],
            name: substituentName,
            length: isBranched ? isBranched.carbons : ALKYL_LENGTHS[substituentName],
            sortKey: isBranched ? isBranched.sortKey : substituentName,
            branched: isBranched ? substituentName : null
          });
        }
      }

      text = text.slice(match[0].length);
      if (text[0] === "-") {
        text = text.slice(1);
      } else if (text.length) {
        throw new Error("I could not read the next substituent in the IUPAC name.");
      }
    }

    return { substituents: substituents, attachments: attachments };
  }

  function parseAcyclicHaloalkaneName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var parentMatch = name.match(/(meth|eth|prop|but|pent|hex|hept|oct|non|dec|undec|dodec|tridec|tetradec|pentadec|hexadec|heptadec|octadec|nonadec|eicos)ane$/);
    if (!parentMatch) {
      return null;
    }

    var parentStem = parentMatch[1];
    var parentLength = EXTENDED_STEMS[parentStem];
    var prefix = name.slice(0, parentMatch.index);
    var parsed = parseHaloalkanePrefix(prefix, parentLength);
    if (!parsed.attachments.length) {
      return null;
    }

    var adjacency = linearAdjacency(parentLength);
    for (var i = 0; i < parsed.substituents.length; i += 1) {
      var sub = parsed.substituents[i];
      if (sub.branched) {
        buildBranchedSubstituent(adjacency, sub.locant - 1, sub.branched);
      } else {
        buildLinearBranch(adjacency, sub.locant - 1, sub.length);
      }
    }

    var formulaInfo = formulaFromDerivativeGraph(adjacency, parsed.attachments, null);
    var canonical = derivativeCanonicalWithAttachments(adjacency, parsed.attachments);

    return {
      status: "ok",
      family: "haloalkane",
      familyLabel: FAMILY_INFO.haloalkane.label,
      familyPattern: parsed.attachments.length === 1 ? FAMILY_INFO.haloalkane.pattern : "Halogenated alkane",
      scope: "Parsed as a saturated haloalkane name with halogen and alkyl substituents.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formulaInfo.formula,
      elements: formulaInfo.elements,
      carbon: adjacency.length,
      hydrogen: formulaInfo.hydrogen,
      dbe: 0,
      parsedOnly: true,
      isomers: [{
        family: "haloalkane",
        canonical: "parsed:" + canonical,
        name: original,
        commonNames: [],
        adjacency: adjacency,
        edgeOrders: null,
        attachments: parsed.attachments,
        chain: Array.from({ length: parentLength }, function (_, index) {
          return index;
        }),
        substituents: parsed.substituents
      }]
    };
  }

  function parseAcyclicIupacName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var parentMatch = name.match(/(meth|eth|prop|but|pent|hex|hept|oct|non|dec|undec|dodec|tridec|tetradec|pentadec|hexadec|heptadec|octadec|nonadec|eicos)(?:-(\d+)-)?(ane|ene|yne)$/);
    if (!parentMatch) {
      return null;
    }

    var parentStem = parentMatch[1];
    var parentLength = EXTENDED_STEMS[parentStem];
    var suffix = parentMatch[3];
    var family = suffix === "ane" ? "alkane" : suffix === "ene" ? "alkene" : "alkyne";
    var bondOrder = suffix === "ene" ? 2 : suffix === "yne" ? 3 : 1;
    var multipleBondLocant = parentMatch[2] ? Number(parentMatch[2]) : bondOrder === 1 ? null : 1;
    var prefix = name.slice(0, parentMatch.index);
    var substituents = parseSubstituentPrefix(prefix, parentLength);

    if (bondOrder > 1 && (multipleBondLocant < 1 || multipleBondLocant >= parentLength)) {
      throw new Error("The multiple-bond locant must point to a bond inside the parent chain.");
    }

    var adjacency = [];
    for (var atom = 0; atom < parentLength; atom += 1) {
      adjacency.push([]);
      if (atom > 0) {
        adjacency[atom - 1].push(atom);
        adjacency[atom].push(atom - 1);
      }
    }

    var edgeOrders = new Map();
    if (bondOrder > 1) {
      edgeOrders.set(edgeKey(multipleBondLocant - 1, multipleBondLocant), bondOrder);
    }

    for (var i = 0; i < substituents.length; i += 1) {
      if (substituents[i].branched) {
        buildBranchedSubstituent(adjacency, substituents[i].locant - 1, substituents[i].branched);
      } else {
        buildLinearBranch(adjacency, substituents[i].locant - 1, substituents[i].length);
      }
    }

    var formula = formulaFromGraph(adjacency, edgeOrders);
    var familyInfo = FAMILY_INFO[family];

    return {
      status: "ok",
      family: family,
      familyLabel: familyInfo.label,
      familyPattern: familyInfo.pattern,
      scope:
        "Parsed from an IUPAC hydrocarbon name. This parser supports acyclic parent chains with straight-chain alkyl branches.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      carbon: adjacency.length,
      hydrogen: Number(formula.match(/H(\d*)$/)[1] || "1"),
      dbe: bondOrder === 2 ? 1 : bondOrder === 3 ? 2 : 0,
      parsedOnly: true,
      isomers: [{
        family: family,
        canonical: "parsed:" + name,
        name: original,
        commonNames: nameAliases(original),
        adjacency: adjacency,
        edgeOrders: edgeOrders.size ? edgeOrders : null,
        chain: Array.from({ length: parentLength }, function (_, index) {
          return index;
        }),
        substituents: substituents,
        bondOrder: bondOrder,
        multipleBond: bondOrder > 1 ? [multipleBondLocant - 1, multipleBondLocant] : null
      }]
    };
  }

  function parseBenzeneSubstituentList(prefix, parentLength) {
    var text = normalizeName(prefix).replace(/-$/, "");
    var substituents = [];
    if (!text) {
      return substituents;
    }

    while (text.length) {
      var match = text.match(/^(\d+(?:,\d+)*)-(?:(di|tri|tetra|penta|hexa|hepta|octa|nona|deca)?-?(isopropyl|isobutyl|sec-butyl|tert-butyl|neopentyl|methyl|ethyl|propyl|butyl|pentyl|hexyl|heptyl|octyl|nonyl|decyl|undecyl|dodecyl|fluoro|chloro|bromo|iodo|hydroxy|amino|carboxy|formyl|acetyl|methoxy|nitro))/);
      if (!match) {
        throw new Error("Cannot parse benzene substituent: " + text);
      }

      var locants = match[1].split(",").map(function (l) { return Number(l); });
      var multiplier = match[2] || "";
      var subName = match[3];
      var expected = multiplier ? MULTIPLIER_COUNTS[multiplier] : 1;

      if (locants.length !== expected) {
        throw new Error(subName + " has " + locants.length + " locants but the multiplier expects " + expected + ".");
      }

      var isBranched = BRANCHED_SUBSTITUENT_INFO[subName];
      var isAlkyl = ALKYL_LENGTHS[subName];
      var isHeteroatom = BENZENE_SUBSTITUENT_GROUPS[subName];

      for (var i = 0; i < locants.length; i += 1) {
        if (!Number.isInteger(locants[i]) || locants[i] < 1 || locants[i] > parentLength) {
          throw new Error("Substituent locants must be inside the parent chain.");
        }
        
        if (isHeteroatom) {
          substituents.push({
            locant: locants[i],
            name: isHeteroatom.name,
            length: isHeteroatom.size,
            sortKey: isHeteroatom.sortKey,
            extraElements: isHeteroatom.extraElements,
            extraHydrogens: isHeteroatom.extraHydrogens
          });
        } else if (isAlkyl) {
          substituents.push({
            locant: locants[i],
            name: subName,
            length: isAlkyl,
            sortKey: subName,
            extraElements: {},
            extraHydrogens: 0
          });
        } else if (isBranched) {
          substituents.push({
            locant: locants[i],
            name: subName,
            length: isBranched.carbons,
            sortKey: isBranched.sortKey,
            extraElements: {},
            extraHydrogens: 0
          });
        } else {
          throw new Error("Unknown benzene substituent: " + subName);
        }
      }

      text = text.slice(match[0].length);
      if (text[0] === "-") {
        text = text.slice(1);
      } else if (text.length) {
        throw new Error("Cannot parse benzene substituent prefix.");
      }
    }

    return substituents;
  }

  function parseOrthoMetaParaBenzeneName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var ompMatch = name.match(/^(o|ortho|m|meta|p|para)-(.*?)benzene$/);
    if (!ompMatch) return null;
    var ompPrefix = ompMatch[1];
    var substituentPart = ompMatch[2];
    var secondLocant = ORTHO_META_PARA_MAP[ompPrefix];
    if (!secondLocant) return null;

    var singleSubName = substituentPart.replace(/di$/, "").replace(/tri$/, "").replace(/tetra$/, "");
    var multiplierMatch = substituentPart.match(/^(di|tri|tetra)/);

    // Handle multiplier patterns like "o-dimethylbenzene"
    if (multiplierMatch && singleSubName && (ALKYL_LENGTHS[singleSubName] || BENZENE_SUBSTITUENT_GROUPS[singleSubName] || BRANCHED_SUBSTITUENT_INFO[singleSubName])) {
      var fullPrefix = "";
      var count = MULTIPLIER_COUNTS[multiplierMatch[1]] || 2;
      for (var ci = 0; ci < count; ci += 1) {
        var loc = ci === 0 ? 1 : secondLocant;
        fullPrefix += (ci > 0 ? "-" : "") + loc + "-" + singleSubName;
      }
      try {
        return parseAromaticIupacName(original.replace(name, fullPrefix + "benzene"));
      } catch (e) {
        return null;
      }
    }

    // Try splitting compound substituent names (e.g., "chloromethyl" -> "chloro" + "methyl")
    for (var hp in HALOGEN_BY_PREFIX) {
      if (substituentPart.indexOf(hp) === 0 && substituentPart.length > hp.length) {
        var remainder = substituentPart.slice(hp.length);
        if (ALKYL_LENGTHS[remainder] || BRANCHED_SUBSTITUENT_INFO[remainder]) {
          var splitPrefix = "1-" + hp + "-" + secondLocant + "-" + remainder;
          try {
            return parseAromaticIupacName(original.replace(name, splitPrefix + "benzene"));
          } catch (e) {
            return null;
          }
        }
      }
    }

    return null;
  }

  var HETEROCYCLIC_AROMATICS = {
    furan: { name: "furan", formula: "C4H4O", carbon: 4, hydrogen: 4, dbe: 3, description: "A five-membered aromatic ring containing oxygen." },
    pyrrole: { name: "pyrrole", formula: "C4H5N", carbon: 4, hydrogen: 5, dbe: 3, description: "A five-membered aromatic ring containing nitrogen." },
    pyridine: { name: "pyridine", formula: "C5H5N", carbon: 5, hydrogen: 5, dbe: 4, description: "A six-membered aromatic ring containing a nitrogen atom." },
    thiophene: { name: "thiophene", formula: "C4H4S", carbon: 4, hydrogen: 4, dbe: 3, description: "A five-membered aromatic ring containing sulfur." },
    imidazole: { name: "imidazole", formula: "C3H4N2", carbon: 3, hydrogen: 4, dbe: 3, description: "A five-membered aromatic ring with two nitrogen atoms." },
    oxazole: { name: "oxazole", formula: "C3H3NO", carbon: 3, hydrogen: 3, dbe: 3, description: "A five-membered aromatic ring with oxygen and nitrogen." },
    thiazole: { name: "thiazole", formula: "C3H3NS", carbon: 3, hydrogen: 3, dbe: 3, description: "A five-membered aromatic ring with sulfur and nitrogen." },
    pyrazole: { name: "pyrazole", formula: "C3H4N2", carbon: 3, hydrogen: 4, dbe: 3, description: "A five-membered aromatic ring with two adjacent nitrogen atoms." },
    isoxazole: { name: "isoxazole", formula: "C3H3NO", carbon: 3, hydrogen: 3, dbe: 3, description: "A five-membered aromatic ring with adjacent oxygen and nitrogen." },
    isothiazole: { name: "isothiazole", formula: "C3H3NS", carbon: 3, hydrogen: 3, dbe: 3, description: "A five-membered aromatic ring with adjacent sulfur and nitrogen." },
    pyrimidine: { name: "pyrimidine", formula: "C4H4N2", carbon: 4, hydrogen: 4, dbe: 4, description: "A six-membered aromatic ring with two nitrogen atoms at 1,3 positions." },
    pyrazine: { name: "pyrazine", formula: "C4H4N2", carbon: 4, hydrogen: 4, dbe: 4, description: "A six-membered aromatic ring with two nitrogen atoms at 1,4 positions." },
    pyridazine: { name: "pyridazine", formula: "C4H4N2", carbon: 4, hydrogen: 4, dbe: 4, description: "A six-membered aromatic ring with two nitrogen atoms at 1,2 positions." },
    indole: { name: "indole", formula: "C8H7N", carbon: 8, hydrogen: 7, dbe: 6, description: "A benzene ring fused to a pyrrole ring." },
    quinoline: { name: "quinoline", formula: "C9H7N", carbon: 9, hydrogen: 7, dbe: 7, description: "A benzene ring fused to a pyridine ring." },
    isoquinoline: { name: "isoquinoline", formula: "C9H7N", carbon: 9, hydrogen: 7, dbe: 7, description: "An isomer of quinoline with the nitrogen at a different position." },
    naphthalene: { name: "naphthalene", formula: "C10H8", carbon: 10, hydrogen: 8, dbe: 7, description: "Two fused benzene rings." },
    anthracene: { name: "anthracene", formula: "C14H10", carbon: 14, hydrogen: 10, dbe: 10, description: "Three fused benzene rings in a linear arrangement." },
    phenanthrene: { name: "phenanthrene", formula: "C14H10", carbon: 14, hydrogen: 10, dbe: 10, description: "Three fused benzene rings in an angular arrangement." },
    coumarin: { name: "coumarin", formula: "C9H6O2", carbon: 9, hydrogen: 6, dbe: 7, description: "A benzene ring fused to a pyrone ring." }
  };

  function parseHeterocyclicAromaticName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var compound = HETEROCYCLIC_AROMATICS[name];
    if (!compound) return null;
    var elements = { C: compound.carbon, H: compound.hydrogen, O: 0, F: 0, Cl: 0, Br: 0, I: 0, N: 0 };
    if (compound.formula.indexOf("O") !== -1) elements.O = (compound.formula.match(/O(\d*)/) || [,"1"])[1] ? Number((compound.formula.match(/O(\d*)/))[1]) : 1;
    if (compound.formula.indexOf("N") !== -1) elements.N = (compound.formula.match(/N(\d*)/) || [,"1"])[1] ? Number((compound.formula.match(/N(\d*)/))[1]) : 1;
    if (compound.formula.indexOf("S") !== -1) { /* S not in formatMolecularFormula order but we track it */ }
    return {
      status: "ok",
      family: "aromatic",
      familyLabel: FAMILY_INFO.aromatic.label,
      familyPattern: "Heterocyclic aromatic",
      scope: compound.description,
      source: "parsed-name",
      queryName: original,
      matchedName: compound.name,
      formula: compound.formula,
      elements: elements,
      carbon: compound.carbon,
      hydrogen: compound.hydrogen,
      dbe: compound.dbe,
      parsedOnly: true,
      isomers: [{
        family: "aromatic",
        canonical: "parsed:hetero:" + name,
        name: compound.name,
        commonNames: [],
        sequence: [null, null, null, null, null, null],
        substituents: []
      }]
    };
  }

  function parseAromaticIupacName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    if (name === "benzene") {
      return {
        status: "ok",
        family: "aromatic",
        familyLabel: FAMILY_INFO.aromatic.label,
        familyPattern: FAMILY_INFO.aromatic.pattern,
        scope: "Parsed as a single benzene-ring aromatic hydrocarbon.",
        source: "parsed-name",
        queryName: original,
        matchedName: original,
        formula: "C6H6",
        carbon: 6,
        hydrogen: 6,
        dbe: 4,
        parsedOnly: true,
        isomers: [{
          family: "aromatic",
          canonical: "parsed:" + name,
          name: original,
          commonNames: nameAliases(original),
          sequence: [null, null, null, null, null, null],
          substituents: []
        }]
      };
    }

    if (!name.endsWith("benzene")) {
      return null;
    }

    var prefix = name.slice(0, -"benzene".length);
    if (!prefix) {
      return null;
    }

    var substituents;
    if (ALKYL_LENGTHS[prefix]) {
      substituents = [{
        locant: 1,
        name: prefix,
        length: ALKYL_LENGTHS[prefix],
        sortKey: prefix,
        extraElements: {},
        extraHydrogens: 0
      }];
    } else if (BENZENE_SUBSTITUENT_GROUPS[prefix]) {
      var group = BENZENE_SUBSTITUENT_GROUPS[prefix];
      substituents = [{
        locant: 1,
        name: group.name,
        length: group.size,
        sortKey: group.sortKey,
        extraElements: group.extraElements,
        extraHydrogens: group.extraHydrogens
      }];
    } else {
      substituents = parseBenzeneSubstituentList(prefix, 6);
    }

    var occupied = new Set();
    var sequence = [null, null, null, null, null, null];
    var sideCarbons = 0;
    var sideHydrogens = 0;
    var extraElements = {};

    for (var i = 0; i < substituents.length; i += 1) {
      var sub = substituents[i];
      if (occupied.has(sub.locant)) {
        throw new Error("A benzene ring position cannot hold two substituents.");
      }
      occupied.add(sub.locant);
      sideCarbons += sub.length || 0;
      if (BENZENE_SUBSTITUENT_GROUPS[sub.name]) {
        sideHydrogens += sub.extraHydrogens || 0;
      } else {
        sideHydrogens += (sub.length || 0) * 2 + 1;
      }
      if (sub.extraElements) {
        for (var el in sub.extraElements) {
          extraElements[el] = (extraElements[el] || 0) + sub.extraElements[el];
        }
      }
      var subLabel = BENZENE_SUBSTITUENT_GROUPS[sub.name]
        ? BENZENE_SUBSTITUENT_GROUPS[sub.name].label
        : shortSubstituentLabel(sub.name);
      sequence[sub.locant - 1] = {
        code: sub.name,
        size: sub.length || 0,
        name: sub.name,
        sortKey: sub.sortKey,
        label: subLabel
      };
    }

    var carbon = 6 + sideCarbons;
    var hydrogen = 6 - substituents.length + sideHydrogens;
    var elements = { C: carbon, H: hydrogen, O: 0, F: 0, Cl: 0, Br: 0, I: 0, N: 0 };
    for (var el2 in extraElements) {
      elements[el2] = (elements[el2] || 0) + extraElements[el2];
    }
    var formula = formatMolecularFormula(elements);
    var hasHeteroatom = Object.keys(extraElements).length > 0;

    return {
      status: "ok",
      family: "aromatic",
      familyLabel: FAMILY_INFO.aromatic.label,
      familyPattern: FAMILY_INFO.aromatic.pattern,
      scope: hasHeteroatom
        ? "Parsed as a substituted aromatic hydrocarbon with heteroatom substituents."
        : "Parsed as a single benzene-ring aromatic hydrocarbon with substituents.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      carbon: carbon,
      hydrogen: hydrogen,
      dbe: 4,
      parsedOnly: true,
      isomers: [{
        family: "aromatic",
        canonical: "parsed:" + name,
        name: original,
        commonNames: nameAliases(original),
        sequence: sequence,
        substituents: substituents
      }]
    };
  }

  function buildNameIndex() {
    if (nameIndexCache) {
      return nameIndexCache;
    }

    var index = {
      strict: new Map(),
      loose: new Map(),
      entries: []
    };
    var families = ["alkane", "alkene", "alkyne", "cycloalkane", "cycloalkene", "diene", "bicyclic", "aromatic", "fused_aromatic"];

    for (var f = 0; f < families.length; f += 1) {
      var family = families[f];
      for (var carbon = familyMinimumCarbon(family); carbon <= familyMaximumCarbon(family); carbon += 1) {
        var hydrogen = expectedHydrogenForFamily(carbon, family);
        if (hydrogen < 1) {
          continue;
        }

        var analysis = analyzeFormula(formatFormula(carbon, hydrogen), family);
        if (analysis.status !== "ok") {
          continue;
        }

        for (var i = 0; i < analysis.isomers.length; i += 1) {
          var isomer = analysis.isomers[i];
          addNameIndexEntry(index, isomer, analysis, nameAliases(isomer.name));
          index.entries.push({
            name: isomer.name,
            commonNames: isomer.commonNames || [],
            formula: analysis.formula,
            family: analysis.family,
            familyLabel: analysis.familyLabel,
            canonical: isomer.canonical
          });
        }
      }
    }

    nameIndexCache = index;
    return index;
  }

  function editDistance(left, right) {
    var a = String(left || "");
    var b = String(right || "");
    if (!a.length) {
      return b.length;
    }
    if (!b.length) {
      return a.length;
    }

    var previous = [];
    for (var i = 0; i <= b.length; i += 1) {
      previous[i] = i;
    }

    for (var row = 1; row <= a.length; row += 1) {
      var current = [row];
      for (var col = 1; col <= b.length; col += 1) {
        var cost = a[row - 1] === b[col - 1] ? 0 : 1;
        current[col] = Math.min(
          current[col - 1] + 1,
          previous[col] + 1,
          previous[col - 1] + cost
        );
      }
      previous = current;
    }

    return previous[b.length];
  }

  function suggestFormulaFamilies(input, selectedFamily) {
    var parsed;
    try {
      parsed = parseFormula(input);
    } catch (e) {
      return [];
    }

    var families = selectedFamily && selectedFamily !== "auto"
      ? [selectedFamily]
      : ["alkane", "alkene", "alkyne", "aromatic", "haloalkane", "alcohol", "ester", "carboxylic acid", "aldehyde", "ketone", "ether", "amine"];

    var matches = [];
    var seenFormulas = new Set();
    var exactMatch = false;

    // First pass: show exact formula matches
    for (var i = 0; i < families.length; i += 1) {
      var family = families[i];
      if (!FAMILY_INFO[family]) {
        continue;
      }
      if (parsed.carbon < familyMinimumCarbon(family)) {
        continue;
      }
      if (formulaMatchesFamily(parsed, family)) {
        matches.push({
          formula: parsed.formula,
          family: family,
          label: FAMILY_INFO[family].label,
          exact: true
        });
        seenFormulas.add(parsed.formula + ":" + family);
        exactMatch = true;
      }
    }

    // Second pass: show other families for the same carbon count with their correct formulas
    // This lets users discover related families (e.g., typing C6H6 also shows C6H12 Alkene, C6H14 Alkane, etc.)
    for (var j = 0; j < families.length; j += 1) {
      var relFamily = families[j];
      if (!FAMILY_INFO[relFamily]) {
        continue;
      }
      if (parsed.carbon < familyMinimumCarbon(relFamily)) {
        continue;
      }
      var relHydrogen = expectedHydrogenForFamily(parsed.carbon, relFamily);
      if (!relHydrogen || relHydrogen < 1) {
        continue;
      }
      var relKey = relHydrogen + ":" + relFamily;
      if (seenFormulas.has(parsed.formula + ":" + relFamily)) {
        continue;
      }
      // Only include hydrocarbon families for related suggestions (not derivatives which need extra elements)
      if (relFamily !== "alkane" && relFamily !== "alkene" && relFamily !== "alkyne" && relFamily !== "aromatic") {
        continue;
      }
      var relFormula = formatFormula(parsed.carbon, relHydrogen);
      var relElements = { C: parsed.carbon, H: relHydrogen, O: 0, F: 0, Cl: 0, Br: 0, I: 0, N: 0 };
      var relMolecularFormula = formatMolecularFormula(relElements);
      if (!seenFormulas.has(relMolecularFormula + ":" + relFamily)) {
        matches.push({
          formula: relMolecularFormula,
          family: relFamily,
          label: FAMILY_INFO[relFamily].label,
          exact: false
        });
        seenFormulas.add(relMolecularFormula + ":" + relFamily);
      }
    }

    return matches;
  }

  function suggestionScore(inputLoose, candidateLoose) {
    if (!inputLoose || !candidateLoose) {
      return null;
    }
    if (inputLoose === candidateLoose) {
      return 0;
    }

    var contains = candidateLoose.indexOf(inputLoose) !== -1 || inputLoose.indexOf(candidateLoose) !== -1;
    var distance = editDistance(inputLoose, candidateLoose);
    var maxLength = Math.max(inputLoose.length, candidateLoose.length);
    var threshold = Math.max(2, Math.floor(maxLength * 0.38));
    if (!contains && distance > threshold) {
      return null;
    }

    var score = distance;
    if (contains) {
      score -= 1.5;
    }
    if (candidateLoose.indexOf(inputLoose.slice(0, Math.min(4, inputLoose.length))) === 0) {
      score -= 0.5;
    }
    return score;
  }

  function suggestNames(input, selectedFamily, limit) {
    var index = buildNameIndex();
    var loose = looseNameKey(input);
    var ranked = [];
    var seen = new Set();
    var max = limit || 6;

    if (!loose) {
      return [];
    }

    for (var i = 0; i < index.entries.length; i += 1) {
      var entry = index.entries[i];
      if (selectedFamily && selectedFamily !== "auto" && entry.family !== selectedFamily) {
        continue;
      }
      var candidates = [entry.name].concat(entry.commonNames || []);
      for (var c = 0; c < candidates.length; c += 1) {
        var entryLoose = looseNameKey(candidates[c]);
        var key = normalizeName(candidates[c]);
        var score = suggestionScore(loose, entryLoose);
        if (score !== null && !seen.has(key)) {
          ranked.push({
            value: candidates[c],
            score: score,
            distance: editDistance(loose, entryLoose),
            length: entryLoose.length
          });
          seen.add(key);
        }
      }
    }

    ranked.sort(function (a, b) {
      return a.score - b.score || a.distance - b.distance || a.length - b.length || compareStrings(a.value, b.value);
    });

    return ranked.slice(0, max).map(function (item) {
      return item.value;
    });
  }

  function invalidNameMessage(input, detail, suggestions) {
    var name = String(input || "").trim();
    var intro = name ? '"' + name + '" does not exist as written.' : "That name does not exist as written.";
    var reason = detail ? " " + detail : "";
    var next = suggestions && suggestions.length
      ? " Did you mean one of the options below?"
      : " Try a formula such as C5H12, a common name such as isobutane, or a supported IUPAC name.";
    return intro + reason + next;
  }

  function parseCarboxylicAcidName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var acidMatch = name.match(/^(.*?)anoicacid$/) || name.match(/^(.*?)anoic acid$/);
    if (!acidMatch) {
      acidMatch = name.match(/^(.*?)oicacid$/) || name.match(/^(.*?)oic acid$/);
    }
    if (!acidMatch) {
      return null;
    }
    var prefix = acidMatch[1];
    var stemMatch = prefix.match(/(.*?)(meth|eth|prop|but|pent|hex|hept|oct|non|dec)$/);
    if (!stemMatch && !prefix) {
      return null;
    }
    var parentStem = stemMatch ? stemMatch[2] : prefix;
    var parentLength = EXTENDED_STEMS[parentStem];
    if (!parentLength) {
      return null;
    }
    var substituentPrefix = stemMatch ? stemMatch[1] : "";
    var attachments = [];
    var substituents = [];
    if (substituentPrefix) {
      var parsed = parseHaloalkanePrefix(substituentPrefix, parentLength);
      substituents = parsed.substituents;
      attachments = parsed.attachments;
    }
    var adjacency = linearAdjacency(parentLength);
    for (var i = 0; i < substituents.length; i += 1) {
      var sub = substituents[i];
      if (sub.branched) {
        buildBranchedSubstituent(adjacency, sub.locant - 1, sub.branched);
      } else {
        buildLinearBranch(adjacency, sub.locant - 1, sub.length);
      }
    }
    // The carboxyl carbon is C1 of the parent chain: the double-bonded
    // oxygen plus the hydroxyl exactly fill its valence, and the formula
    // (including any halogen prefixes) comes from the real attachment model.
    var haloGroups = attachments.map(function (attachment) {
      return {
        locant: attachment.locant,
        name: HALOGEN_PREFIXES[attachment.element],
        sortKey: HALOGEN_PREFIXES[attachment.element],
        carbonCount: 0
      };
    });
    attachments.push({ atom: 0, element: "O", label: "O", kind: "ketone", hydrogens: 0, bondOrder: 2 });
    attachments.push({ atom: 0, element: "O", label: "OH", kind: "alcohol", hydrogens: 1, bondOrder: 1 });

    var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
    var elements = formulaInfo.elements;
    var carbonTotal = elements.C;
    var hydrogenTotal = formulaInfo.hydrogen;
    var formula = formulaInfo.formula;
    var naming = functionalGroupBest(adjacency, 0, "carboxylic acid", haloGroups);
    var canonicalName = naming ? naming.name : original;
    return {
      status: "ok",
      family: "carboxylic acid",
      familyLabel: "Carboxylic Acid",
      familyPattern: "CnH2nO2",
      scope: "Parsed as a carboxylic acid from an IUPAC name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      elements: elements,
      carbon: carbonTotal,
      hydrogen: hydrogenTotal,
      dbe: 1,
      parsedOnly: true,
      isomers: [{
        family: "carboxylic acid",
        canonical: "parsed:acid:" + parentStem + ":" + canonicalName,
        name: canonicalName,
        commonNames: [],
        adjacency: adjacency,
        edgeOrders: null,
        attachments: attachments,
        chain: naming ? naming.chain : Array.from({ length: parentLength }, function (_, idx) { return idx; }),
        substituents: naming ? naming.substituents : substituents
      }]
    };
  }

  function parseAldehydeName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var aldehydeMatch = name.match(/^(.*?)anal$/);
    if (!aldehydeMatch) {
      return null;
    }
    var prefix = aldehydeMatch[1];
    var stemMatch = prefix.match(/(.*?)(meth|eth|prop|but|pent|hex|hept|oct|non|dec)$/);
    if (!stemMatch && !prefix) {
      return null;
    }
    var parentStem = stemMatch ? stemMatch[2] : prefix;
    var parentLength = EXTENDED_STEMS[parentStem];
    if (!parentLength) {
      return null;
    }
    var substituentPrefix = stemMatch ? stemMatch[1] : "";
    var attachments = [];
    var substituents = [];
    if (substituentPrefix) {
      var parsed = parseHaloalkanePrefix(substituentPrefix, parentLength);
      substituents = parsed.substituents;
      attachments = parsed.attachments;
    }
    var adjacency = linearAdjacency(parentLength);
    for (var i = 0; i < substituents.length; i += 1) {
      var sub = substituents[i];
      if (sub.branched) {
        buildBranchedSubstituent(adjacency, sub.locant - 1, sub.branched);
      } else {
        buildLinearBranch(adjacency, sub.locant - 1, sub.length);
      }
    }
    // The formyl carbon is C1 of the parent chain and carries the C=O.
    var haloGroups = attachments.map(function (attachment) {
      return {
        locant: attachment.locant,
        name: HALOGEN_PREFIXES[attachment.element],
        sortKey: HALOGEN_PREFIXES[attachment.element],
        carbonCount: 0
      };
    });
    attachments.push({ atom: 0, element: "O", label: "O", kind: "aldehyde", hydrogens: 0, bondOrder: 2 });

    var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
    var elements = formulaInfo.elements;
    var carbonTotal = elements.C;
    var hydrogenTotal = formulaInfo.hydrogen;
    var formula = formulaInfo.formula;
    var naming = functionalGroupBest(adjacency, 0, "aldehyde", haloGroups);
    var canonicalName = naming ? naming.name : original;
    return {
      status: "ok",
      family: "aldehyde",
      familyLabel: "Aldehyde",
      familyPattern: "CnH2nO",
      scope: "Parsed as an aldehyde from an IUPAC name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      elements: elements,
      carbon: carbonTotal,
      hydrogen: hydrogenTotal,
      dbe: 1,
      parsedOnly: true,
      isomers: [{
        family: "aldehyde",
        canonical: "parsed:aldehyde:" + parentStem + ":" + canonicalName,
        name: canonicalName,
        commonNames: [],
        adjacency: adjacency,
        edgeOrders: null,
        attachments: attachments,
        chain: naming ? naming.chain : Array.from({ length: parentLength }, function (_, idx) { return idx; }),
        substituents: naming ? naming.substituents : substituents
      }]
    };
  }

  // "butanamide", "2-methylpropanamide", "3-chloroethanamide". Mirrors the
  // carboxylic-acid parser: the carbonyl carbon is C1 of the parent chain,
  // carrying a double-bonded oxygen and a primary amino group.
  function parseAmideName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var amideMatch = name.match(/^(.*?)anamide$/);
    if (!amideMatch) {
      return null;
    }
    var prefix = amideMatch[1];
    var stemMatch = prefix.match(/(.*?)(meth|eth|prop|but|pent|hex|hept|oct|non|dec)$/);
    if (!stemMatch && !prefix) {
      return null;
    }
    var parentStem = stemMatch ? stemMatch[2] : prefix;
    var parentLength = EXTENDED_STEMS[parentStem];
    if (!parentLength) {
      return null;
    }
    var substituentPrefix = stemMatch ? stemMatch[1] : "";
    var attachments = [];
    var substituents = [];
    if (substituentPrefix) {
      var parsed = parseHaloalkanePrefix(substituentPrefix, parentLength);
      substituents = parsed.substituents;
      attachments = parsed.attachments;
    }
    var adjacency = linearAdjacency(parentLength);
    for (var i = 0; i < substituents.length; i += 1) {
      var sub = substituents[i];
      if (sub.branched) {
        buildBranchedSubstituent(adjacency, sub.locant - 1, sub.branched);
      } else {
        buildLinearBranch(adjacency, sub.locant - 1, sub.length);
      }
    }
    var haloGroups = attachments.map(function (attachment) {
      return {
        locant: attachment.locant,
        name: HALOGEN_PREFIXES[attachment.element],
        sortKey: HALOGEN_PREFIXES[attachment.element],
        carbonCount: 0
      };
    });
    attachments.push({ atom: 0, element: "O", label: "O", kind: "ketone", hydrogens: 0, bondOrder: 2 });
    attachments.push({ atom: 0, element: "N", label: "NH\u2082", kind: "amine", hydrogens: 2, bondOrder: 1 });

    var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
    var elements = formulaInfo.elements;
    var carbonTotal = elements.C;
    var hydrogenTotal = formulaInfo.hydrogen;
    var formula = formulaInfo.formula;
    var naming = functionalGroupBest(adjacency, 0, "amide", haloGroups);
    var canonicalName = naming ? naming.name : original;
    return {
      status: "ok",
      family: "amide",
      familyLabel: "Amide",
      familyPattern: "CnH2n+1NO",
      scope: "Parsed as a primary amide from an IUPAC name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      elements: elements,
      carbon: carbonTotal,
      hydrogen: hydrogenTotal,
      dbe: 1,
      parsedOnly: true,
      isomers: [{
        family: "amide",
        canonical: "parsed:amide:" + parentStem + ":" + canonicalName,
        name: canonicalName,
        commonNames: [],
        adjacency: adjacency,
        edgeOrders: null,
        attachments: attachments,
        chain: naming ? naming.chain : Array.from({ length: parentLength }, function (_, idx) { return idx; }),
        substituents: naming ? naming.substituents : substituents
      }]
    };
  }

  function parseKetoneName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    if (!name) {
      return null;
    }

    // Systematic: "butan-2-one", "3-methylbutan-2-one", "pentan-3-one".
    // Legacy digit-first style: "2-butanone", "3-pentanone".
    var systematic = name.match(/^(.*?)an-?(\d+)-?one$/);
    var parentStem = null;
    var locant = null;
    var substituentPrefix = "";

    if (systematic) {
      substituentPrefix = systematic[1];
      locant = Number(systematic[2]);
      var stemMatch = substituentPrefix.match(/(.*?)(meth|eth|prop|but|pent|hex|hept|oct|non|dec)$/);
      if (stemMatch) {
        parentStem = stemMatch[2];
        substituentPrefix = stemMatch[1];
      } else {
        parentStem = substituentPrefix;
        substituentPrefix = "";
      }
    } else {
      var legacy = name.match(/^(\d+)-?((?:meth|eth|prop|but|pent|hex|hept|oct|non|dec))one$/);
      if (!legacy) {
        return null;
      }
      locant = Number(legacy[1]);
      parentStem = legacy[2];
    }

    var parentLength = EXTENDED_STEMS[parentStem];
    if (!parentLength) {
      return null;
    }
    if (locant < 2 || locant >= parentLength) {
      return null;
    }

    var haloAttachments = [];
    var substituentsForBuild = [];
    if (substituentPrefix) {
      var parsed = parseHaloalkanePrefix(substituentPrefix, parentLength);
      haloAttachments = parsed.attachments;
      for (var si = 0; si < parsed.substituents.length; si += 1) {
        substituentsForBuild.push(parsed.substituents[si]);
      }
    }

    var adjacency = linearAdjacency(parentLength);
    for (var i = 0; i < substituentsForBuild.length; i += 1) {
      var sub = substituentsForBuild[i];
      if (sub.branched) {
        buildBranchedSubstituent(adjacency, sub.locant - 1, sub.branched);
      } else {
        buildLinearBranch(adjacency, sub.locant - 1, sub.length);
      }
    }

    var anchor = locant - 1;
    var attachments = haloAttachments.slice();
    attachments.push({ atom: anchor, element: "O", label: "O", kind: "ketone", hydrogens: 0, bondOrder: 2 });

    var haloGroups = haloAttachments.map(function (attachment) {
      return {
        locant: attachment.locant,
        name: HALOGEN_PREFIXES[attachment.element],
        sortKey: HALOGEN_PREFIXES[attachment.element],
        carbonCount: 0
      };
    });

    var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
    var elements = formulaInfo.elements;
    var carbonTotal = elements.C;
    var hydrogenTotal = formulaInfo.hydrogen;
    var formula = formulaInfo.formula;
    var naming = functionalGroupBest(adjacency, anchor, "ketone", haloGroups);
    var canonicalName = naming ? naming.name : original;

    return {
      status: "ok",
      family: "ketone",
      familyLabel: "Ketone",
      familyPattern: "CnH2nO",
      scope: "Parsed as a ketone from an IUPAC name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      elements: elements,
      carbon: carbonTotal,
      hydrogen: hydrogenTotal,
      dbe: 1,
      parsedOnly: true,
      isomers: [{
        family: "ketone",
        canonical: "parsed:ketone:" + parentStem + ":" + locant + ":" + canonicalName,
        name: canonicalName,
        commonNames: [],
        adjacency: adjacency,
        edgeOrders: null,
        attachments: attachments,
        chain: naming ? naming.chain : Array.from({ length: parentLength }, function (_, idx) { return idx; }),
        substituents: naming ? naming.substituents : substituentsForBuild
      }]
    };
  }

  function parseAmineName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var amineMatch = name.match(/^(.*?)an-?(\d+)-?amine$/) || name.match(/^(\d+)-?(.*?)amine$/) || name.match(/^(.*?)anamine$/);
    if (!amineMatch) {
      return null;
    }
    var parentStem, locant;
    if (amineMatch.length === 4 && amineMatch[2]) {
      locant = Number(amineMatch[2]);
      parentStem = amineMatch[1];
    } else if (amineMatch.length === 4 && amineMatch[1]) {
      locant = Number(amineMatch[1]);
      parentStem = amineMatch[2];
    } else {
      parentStem = amineMatch[1];
      locant = 1;
    }
    var parentLength = EXTENDED_STEMS[parentStem];
    if (!parentLength) {
      return null;
    }
    if (locant < 1 || locant > parentLength) {
      return null;
    }
    var adjacency = linearAdjacency(parentLength);
    var attachments = [{
      atom: locant - 1,
      element: "N",
      label: "NH\u2082",
      kind: "amine",
      hydrogens: 2
    }];
    var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
    var carbonTotal = formulaInfo.elements.C;
    var hydrogenTotal = formulaInfo.hydrogen;
    var formula = formulaInfo.formula;
    var nameInfo = functionalGroupBest(adjacency, locant - 1, "amine", []);
    var canonicalName = nameInfo ? nameInfo.name : name;
    return {
      status: "ok",
      family: "amine",
      familyLabel: "Amine",
      familyPattern: "CnH2n+3N",
      scope: "Parsed as a primary amine from an IUPAC name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      elements: formulaInfo.elements,
      carbon: carbonTotal,
      hydrogen: hydrogenTotal,
      dbe: 0,
      parsedOnly: true,
      isomers: [{
        family: "amine",
        canonical: "parsed:amine:" + parentStem + ":" + locant + ":" + canonicalName,
        name: canonicalName,
        commonNames: [],
        adjacency: adjacency,
        edgeOrders: null,
        attachments: attachments,
        chain: nameInfo ? nameInfo.chain : Array.from({ length: parentLength }, function (_, idx) { return idx; }),
        substituents: nameInfo ? nameInfo.substituents : []
      }]
    };
  }

  // Placeholder to preserve existing closure shape for parseAmineName.
  function safeParseAcyclicAlkane(text) {
    try {
      var parsed = parseAcyclicIupacName(text);
      if (parsed && parsed.status === "ok" && parsed.family === "alkane") {
        return {
          adjacency: parsed.isomers[0].adjacency,
          chain: parsed.isomers[0].chain
        };
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  // Turn an alkoxy group text ("methoxy", "2-methylpropoxy",
  // "propan-2-yloxy", "isopropoxy", ...) into a fragment + O anchor.
  // `strict` is used when deciding whether a leading "N-" is an oxygen
  // locant: only clearly simple groups qualify for stripping.
  function etherAlkoxyFragment(text, strict) {
    if (!text) return null;
    var lower = String(text).toLowerCase();

    var ALKOXY_ALIASES = {
      isopropoxy: "isopropyl",
      isobutoxy: "isobutyl",
      "sec-butoxy": "sec-butyl",
      "tert-butoxy": "tert-butyl",
      "t-butoxy": "tert-butyl",
      neopentoxy: "neopentyl",
      isopentoxy: "isopentyl",
      "n-propoxy": "propyl",
      "n-butoxy": "butyl",
      "n-pentoxy": "pentyl"
    };
    if (ALKOXY_ALIASES[lower]) {
      return generateEtherIsomers.alkylFragment(ALKOXY_ALIASES[lower]);
    }

    // "methoxy", "ethoxy", "2-methylpropoxy": attachment at position 1.
    var oxyMatch = lower.match(/^((?:\d+-)*)((?:meth|eth|prop|but|pent|hex|hept|oct|non|dec))oxy$/);
    if (oxyMatch) {
      var parent = safeParseAcyclicAlkane(oxyMatch[1] + oxyMatch[2] + "ane");
      if (parent) {
        return { adjacency: parent.adjacency, anchor: parent.chain[0] };
      }
      if (!oxyMatch[1]) {
        return generateEtherIsomers.alkylFragment(oxyMatch[2] + "yl");
      }
      return null;
    }

    // "propan-2-yloxy", "butan-1-yloxy": straight chain, attachment at locant.
    var yloxyMatch = lower.match(/^((?:\d+-)*)((?:meth|eth|prop|but|pent|hex|hept|oct|non|dec))an-(\d+)-yloxy$/);
    if (yloxyMatch && !yloxyMatch[1]) {
      var chainLength = EXTENDED_STEMS[yloxyMatch[2]];
      var anchor = Number(yloxyMatch[3]) - 1;
      if (chainLength && anchor >= 0 && anchor < chainLength) {
        return { adjacency: linearAdjacency(chainLength), anchor: anchor };
      }
      return null;
    }

    // Branched alkoxy written as alkane+oxy: "2,2-dimethylpropoxy".
    if (!strict) {
      var asAlkane = lower.replace(/oxy$/, "ane");
      if (asAlkane !== lower) {
        var branched = safeParseAcyclicAlkane(asAlkane);
        if (branched) {
          return { adjacency: branched.adjacency, anchor: branched.chain[0] };
        }
      }
    }
    return null;
  }

  // Interpret the text in front of the parent alkane: optional C-O locant
  // plus the alkoxy group, with or without parentheses.
  function etherAlkoxyHead(head) {
    if (!head) return null;

    if (/\)$/.test(head)) {
      var open = head.indexOf("(");
      if (open === -1) return null;
      var locantPart = head.slice(0, open);
      var inner = head.slice(open + 1, head.length - 1);
      var parenLocant = 1;
      if (locantPart) {
        var locantMatch = locantPart.match(/^(\d+)-$/);
        if (!locantMatch) return null;
        parenLocant = Number(locantMatch[1]);
      }
      var parenFragment = etherAlkoxyFragment(inner);
      return parenFragment ? { fragment: parenFragment, oLocant: parenLocant } : null;
    }

    var leadMatch = head.match(/^(\d+)-(.+)$/);
    if (leadMatch) {
      var stripped = etherAlkoxyFragment(leadMatch[2], true);
      if (stripped) {
        return { fragment: stripped, oLocant: Number(leadMatch[1]) };
      }
      // The digits belong to the group itself ("2-methylpropoxy").
      var whole = etherAlkoxyFragment(head);
      return whole ? { fragment: whole, oLocant: 1 } : null;
    }

    var plain = etherAlkoxyFragment(head);
    return plain ? { fragment: plain, oLocant: 1 } : null;
  }

  // Systematic alkoxyalkane names: split into [C-O locant] + alkoxy + parent.
  function parseAlkoxyalkaneName(name) {
    if (!/ane$/.test(name) || name.indexOf("oxy") === -1) return null;

    var oxyIndex = name.indexOf("oxy");
    while (oxyIndex !== -1) {
      var cut = oxyIndex + 3;
      // A parenthesised group ("1-(propan-2-yloxy)propane") keeps its closing
      // bracket with the alkoxy text, not with the parent.
      if (name.charAt(cut) === ")") {
        cut += 1;
      }
      var head = etherAlkoxyHead(name.slice(0, cut));
      if (head) {
        var parentText = name.slice(cut);
        if (parentText.charAt(0) === "-") {
          parentText = parentText.slice(1);
        }
        var parent = safeParseAcyclicAlkane(parentText);
        if (parent && head.oLocant >= 1 && head.oLocant <= parent.chain.length) {
          var parentAnchor = parent.chain[head.oLocant - 1];
          if (parentAnchor !== undefined) {
            return {
              a: { adjacency: parent.adjacency, anchor: parentAnchor },
              b: head.fragment
            };
          }
        }
      }
      oxyIndex = name.indexOf("oxy", cut);
    }
    return null;
  }

  function parseEtherName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    if (!name) return null;

    var sides = null;

    if (/ether$/.test(name)) {
      // Common names: "diethyl ether", "methyl tert-butyl ether".
      var body = name.replace(/ether$/, "");
      if (body.length < 2) return null;
      var diMatch = body.match(/^di(.+)$/);
      if (diMatch) {
        var shared = generateEtherIsomers.alkylFragment(diMatch[1]);
        if (shared) sides = { a: shared, b: shared };
      }
      if (!sides) {
        for (var split = 1; split < body.length; split += 1) {
          var left = generateEtherIsomers.alkylFragment(body.slice(0, split));
          if (!left) continue;
          var right = generateEtherIsomers.alkylFragment(body.slice(split));
          if (right) {
            sides = { a: left, b: right };
            break;
          }
        }
      }
      if (!sides) return null;
    } else {
      sides = parseAlkoxyalkaneName(name);
      if (!sides) return null;
    }

    var built = generateEtherIsomers.buildGraph(sides.a, sides.b);
    var naming = generateEtherIsomers.nameSides(sides.a, sides.b);
    var carbonTotal = 0;
    var hydrogenTotal = 0;
    for (var atom = 0; atom < built.adjacency.length; atom += 1) {
      if (built.elements[atom] === "C") {
        carbonTotal += 1;
        hydrogenTotal += 4 - built.adjacency[atom].length;
      }
    }
    var elements = { C: carbonTotal, H: hydrogenTotal, O: 1, F: 0, Cl: 0, Br: 0, I: 0, N: 0 };
    var formula = formatMolecularFormula(elements);

    return {
      status: "ok",
      family: "ether",
      familyLabel: FAMILY_INFO.ether.label,
      familyPattern: FAMILY_INFO.ether.pattern,
      scope: "Parsed as an ether from an IUPAC or common ether name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      elements: elements,
      carbon: carbonTotal,
      hydrogen: hydrogenTotal,
      dbe: 0,
      parsedOnly: true,
      isomers: [{
        family: "ether",
        canonical: generateEtherIsomers.canonicalKey(built.adjacency, built.elements),
        name: naming.name,
        commonNames: nameAliases(naming.name),
        adjacency: built.adjacency,
        edgeOrders: null,
        attachments: null,
        elements: built.elements,
        chain: naming.chain,
        substituents: naming.substituents,
        formula: formula
      }]
    };
  }

  function parseHalobenzeneName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var haloMatch = name.match(/^(fluoro|chloro|bromo|iodo)benzene$/);
    if (!haloMatch) return null;
    var haloByPrefix = { fluoro: "F", chloro: "Cl", bromo: "Br", iodo: "I" };
    var element = haloByPrefix[haloMatch[1]];
    var prefix = haloMatch[1];
    var sequence = [null, null, null, null, null, null];
    sequence[0] = { code: prefix, size: 1, name: prefix, sortKey: prefix, label: element, carbonCount: 0 };
    var substituents = [{ locant: 1, name: prefix, length: 1, sortKey: prefix, carbonCount: 0 }];
    return {
      status: "ok",
      family: "aromatic",
      familyLabel: FAMILY_INFO.aromatic.label,
      familyPattern: FAMILY_INFO.aromatic.pattern,
      scope: "Parsed as a halogenated aromatic hydrocarbon.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: "C6H5" + element,
      carbon: 6,
      hydrogen: 5,
      dbe: 4,
      parsedOnly: true,
      isomers: [{
        family: "aromatic",
        canonical: "parsed:halobenzene:" + element,
        name: original,
        commonNames: [],
        sequence: sequence,
        substituents: substituents
      }]
    };
  }

  // The alcohol side of an ester name: "methyl", "tert-butyl", "propan-2-yl",
  // "2-methylpropyl". Radicals ending in "yl" fall back to their parent alkane
  // with the attachment anchored on C1 (or the an-N-yl locant).
  function esterRadicalFragment(text) {
    if (!text) return null;
    var direct = generateEtherIsomers.alkylFragment(text);
    if (direct) return direct;
    var anMatch = text.match(/^([a-z]+an)-(\d+)-yl$/);
    if (anMatch) {
      var locant = Number(anMatch[2]);
      var systematic = safeParseAcyclicAlkane(anMatch[1] + "e");
      if (systematic && locant >= 1 && locant <= systematic.chain.length) {
        return { adjacency: systematic.adjacency, anchor: systematic.chain[locant - 1] };
      }
    }
    if (/yl$/.test(text)) {
      var branched = safeParseAcyclicAlkane(text.replace(/yl$/, "ane"));
      if (branched) {
        return { adjacency: branched.adjacency, anchor: branched.chain[0] };
      }
    }
    return null;
  }

  // "methyl propanoate", "propan-2-yl ethanoate", "2-methylpropyl 2-methylpropanoate".
  // normalizeName strips spaces, so the split point is found by trying every
  // boundary: the left side must be an alcohol radical, the right side an
  // alkanoate acid part that ends the name. Both sides are rebuilt through the
  // ester generator's own graph builder and namer, so parsed names round-trip
  // exactly like generated isomers.
  function parseEsterName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    if (!name || !/(?:oate|acetate|formate)$/.test(name)) {
      return null;
    }

    var acidSide = null;
    var alcoholSide = null;
    for (var split = 1; split + 6 <= name.length; split += 1) {
      var radical = esterRadicalFragment(name.slice(0, split));
      if (!radical) continue;
      var acidText = name.slice(split);
      if (acidText === "acetate") acidText = "ethanoate";
      else if (acidText === "formate") acidText = "methanoate";
      if (!/anoate$/.test(acidText)) continue;
      var acidParent = safeParseAcyclicAlkane(acidText.slice(0, -4) + "e");
      if (!acidParent) continue;
      acidSide = { adjacency: acidParent.adjacency, anchor: acidParent.chain[0] };
      alcoholSide = radical;
      break;
    }
    if (!acidSide || !alcoholSide) {
      return null;
    }

    var built = generateEsterIsomers.buildEsterGraph(acidSide, alcoholSide);
    var naming = generateEsterIsomers.nameEster(acidSide, alcoholSide);
    var carbonTotal = 0;
    var hydrogenTotal = 0;
    for (var atom = 0; atom < built.adjacency.length; atom += 1) {
      if (built.elements[atom] !== "C") continue;
      carbonTotal += 1;
      var valence = 0;
      for (var n = 0; n < built.adjacency[atom].length; n += 1) {
        var other = built.adjacency[atom][n];
        var edgeKey = atom < other ? atom + "-" + other : other + "-" + atom;
        valence += built.edgeOrders.get(edgeKey) || 1;
      }
      hydrogenTotal += 4 - valence;
    }
    var elements = { C: carbonTotal, H: hydrogenTotal, O: 2, F: 0, Cl: 0, Br: 0, I: 0, N: 0 };
    var formula = formatMolecularFormula(elements);

    return {
      status: "ok",
      family: "ester",
      familyLabel: FAMILY_INFO.ester.label,
      familyPattern: FAMILY_INFO.ester.pattern,
      scope: "Parsed as an ester from an IUPAC name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formula,
      elements: elements,
      carbon: carbonTotal,
      hydrogen: hydrogenTotal,
      dbe: 1,
      parsedOnly: true,
      isomers: [{
        family: "ester",
        canonical: generateEtherIsomers.canonicalKey(built.adjacency, built.elements),
        name: naming.name,
        commonNames: [],
        adjacency: built.adjacency,
        edgeOrders: built.edgeOrders,
        attachments: null,
        elements: built.elements,
        chain: naming.chain,
        substituents: naming.substituents,
        formula: formula
      }]
    };
  }

  // "ethanenitrile", "propanenitrile", "2-methylpropanenitrile": the cyano
  // nitrogen hangs off C1 of the parent chain exactly where the generator puts it.
  function parseNitrileName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    if (!name || !/nitrile$/.test(name)) {
      return null;
    }
    var parent = safeParseAcyclicAlkane(name.slice(0, -"nitrile".length));
    if (!parent) {
      return null;
    }
    var anchor = parent.chain[0];
    if (parent.adjacency[anchor].length > 1) {
      return null;
    }
    var attachments = [{
      atom: anchor,
      element: "N",
      label: "N",
      kind: "nitrile",
      hydrogens: 0,
      bondOrder: 3
    }];
    var formulaInfo = formulaFromDerivativeGraph(parent.adjacency, attachments, null);
    var naming = functionalGroupBest(parent.adjacency, anchor, "nitrile");
    if (!naming) {
      return null;
    }
    return {
      status: "ok",
      family: "nitrile",
      familyLabel: FAMILY_INFO.nitrile.label,
      familyPattern: FAMILY_INFO.nitrile.pattern,
      scope: "Parsed as a nitrile from an IUPAC name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formulaInfo.formula,
      elements: formulaInfo.elements,
      carbon: parent.adjacency.length,
      hydrogen: formulaInfo.hydrogen,
      dbe: 2,
      parsedOnly: true,
      isomers: [{
        family: "nitrile",
        canonical: derivativeCanonicalWithAttachments(parent.adjacency, attachments),
        name: naming.name,
        commonNames: [],
        adjacency: parent.adjacency,
        edgeOrders: null,
        attachments: attachments,
        chain: naming.chain,
        substituents: naming.substituents,
        formula: formulaInfo.formula
      }]
    };
  }

  // "nitromethane", "1-nitropropane", "2-methyl-2-nitropropane": nitro is an
  // ordinary prefix substituent, so the parent alkane carries the last word.
  function parseNitroName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    if (!name || name.indexOf("nitro") === -1) {
      return null;
    }
    var match = name.match(/^(.*?)nitro(.+)$/);
    if (!match) {
      return null;
    }
    var prefix = match[1];
    var locant = 1;
    var locantMatch = prefix.match(/(\d+)-$/);
    if (locantMatch) {
      locant = Number(locantMatch[1]);
      prefix = prefix.slice(0, locantMatch.index);
    }
    var parent = safeParseAcyclicAlkane(match[2]);
    if (!parent || locant < 1 || locant > parent.chain.length) {
      return null;
    }

    var haloAttachments = [];
    var substituentsForBuild = [];
    if (prefix) {
      var parsedPrefix = parseHaloalkanePrefix(prefix, parent.chain.length);
      haloAttachments = parsedPrefix.attachments;
      for (var si = 0; si < parsedPrefix.substituents.length; si += 1) {
        substituentsForBuild.push(parsedPrefix.substituents[si]);
      }
    }

    var adjacency = parent.adjacency;
    for (var i = 0; i < substituentsForBuild.length; i += 1) {
      var sub = substituentsForBuild[i];
      if (sub.branched) {
        buildBranchedSubstituent(adjacency, sub.locant - 1, sub.branched);
      } else {
        buildLinearBranch(adjacency, sub.locant - 1, sub.length);
      }
    }

    var anchor = parent.chain[locant - 1];
    var attachments = haloAttachments.slice();
    attachments.push({
      atom: anchor,
      element: "N",
      label: "NO\u2082",
      kind: "nitro",
      hydrogens: 0,
      bondOrder: 1,
      extraElements: { O: 2 }
    });

    var haloGroups = haloAttachments.map(function (attachment) {
      return {
        locant: attachment.locant,
        name: HALOGEN_PREFIXES[attachment.element],
        sortKey: HALOGEN_PREFIXES[attachment.element],
        carbonCount: 0
      };
    });

    var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
    var naming = functionalGroupBest(adjacency, anchor, "nitro", haloGroups);
    if (!naming) {
      return null;
    }
    return {
      status: "ok",
      family: "nitro",
      familyLabel: FAMILY_INFO.nitro.label,
      familyPattern: FAMILY_INFO.nitro.pattern,
      scope: "Parsed as a nitroalkane from an IUPAC name.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formulaInfo.formula,
      elements: formulaInfo.elements,
      carbon: adjacency.length,
      hydrogen: formulaInfo.hydrogen,
      dbe: 0,
      parsedOnly: true,
      isomers: [{
        family: "nitro",
        canonical: derivativeCanonicalWithAttachments(adjacency, attachments),
        name: naming.name,
        commonNames: [],
        adjacency: adjacency,
        edgeOrders: null,
        attachments: attachments,
        chain: naming.chain,
        substituents: naming.substituents,
        formula: formulaInfo.formula
      }]
    };
  }

  function convertAromaticBaseName(name) {
    var baseMap = {
      toluene: "methyl",
      phenol: "hydroxy",
      aniline: "amino",
      benzoicacid: "carboxy",
      benzaldehyde: "formyl"
    };

    for (var base in baseMap) {
      if (name.endsWith(base)) {
        var prefix = name.slice(0, -base.length);
        var baseSub = baseMap[base];

        if (!prefix) {
          return baseSub + "benzene";
        }

        prefix = prefix.replace(/-$/, "");

        var ompSubMatch = prefix.match(/^(o|ortho|m|meta|p|para)-(.+)$/);
        if (ompSubMatch) {
          var loc = ORTHO_META_PARA_MAP[ompSubMatch[1]];
          var subPart = ompSubMatch[2];
          if (subPart && (ALKYL_LENGTHS[subPart] || BENZENE_SUBSTITUENT_GROUPS[subPart] || BRANCHED_SUBSTITUENT_INFO[subPart] || HALOGEN_BY_PREFIX[subPart])) {
            return "1-" + baseSub + "-" + loc + "-" + subPart + "benzene";
          }
          for (var hp in HALOGEN_BY_PREFIX) {
            if (subPart.indexOf(hp) === 0 && subPart.length > hp.length) {
              var remainder = subPart.slice(hp.length);
              if (ALKYL_LENGTHS[remainder] || BRANCHED_SUBSTITUENT_INFO[remainder]) {
                return "1-" + hp + "-" + loc + "-" + remainder + "-" + baseSub + "benzene";
              }
            }
          }
          return null;
        }

        var subParts = [];
        var remaining = prefix;
        while (remaining.length) {
          var subMatch = remaining.match(/^(\d+(?:,\d+)*)-((?:di|tri|tetra)?(?:fluoro|chloro|bromo|iodo|hydroxy|amino|methyl|ethyl|propyl|butyl|pentyl|hexyl|heptyl|octyl|nonyl|decyl|nitro|methoxy))/);
          if (!subMatch) {
            return null;
          }
          subParts.push(subMatch[0]);
          remaining = remaining.slice(subMatch[0].length);
          if (remaining[0] === "-") {
            remaining = remaining.slice(1);
          }
        }

        if (subParts.length) {
          return "1-" + baseSub + "-" + subParts.join("-") + "benzene";
        }

        return null;
      }
    }

    return null;
  }

  function parseConvertedAromaticBaseName(input) {
    var original = String(input || "").trim();
    var name = normalizeName(original);
    var converted = convertAromaticBaseName(name);
    if (!converted) return null;
    var result = parseAromaticIupacName(converted);
    if (result) {
      result.queryName = original;
    }
    return result;
  }

  var COMMON_COMPOUND_ALIASES_NORM = null;

  function resolveCommonAlias(name) {
    var iupac = COMMON_COMPOUND_ALIASES[name];
    if (iupac) {
      return iupac;
    }
    if (!COMMON_COMPOUND_ALIASES_NORM) {
      COMMON_COMPOUND_ALIASES_NORM = {};
      var keys = Object.keys(COMMON_COMPOUND_ALIASES);
      for (var i = 0; i < keys.length; i++) {
        COMMON_COMPOUND_ALIASES_NORM[normalizeName(keys[i])] = COMMON_COMPOUND_ALIASES[keys[i]];
      }
    }
    return COMMON_COMPOUND_ALIASES_NORM[name] || null;
  }

  function analyzeName(input, selectedFamily) {
    var name = normalizeName(input);
    if (!name) {
      return { status: "error", message: "Enter a formula or IUPAC name." };
    }

    var index = buildNameIndex();
    var match = index.strict.get(name) || index.loose.get(looseNameKey(input));

    if (!match) {
      var guidance = FRIENDLY_NAME_GUIDANCE[looseNameKey(input)];
      if (guidance) {
        return {
          status: "unsupported",
          formula: String(input || "").trim(),
          familyLabel: selectedFamily && selectedFamily !== "auto" && FAMILY_INFO[selectedFamily] ? FAMILY_INFO[selectedFamily].label : "Auto",
          popupTitle: guidance.title,
          hints: guidance.hints,
          message: guidance.message
        };
      }

      var commonIupac = resolveCommonAlias(name);
      try {
        var parsed = commonIupac
          ? (parseHeterocyclicAromaticName(commonIupac) || parseOrthoMetaParaBenzeneName(commonIupac) || parseConvertedAromaticBaseName(commonIupac) || parseHalobenzeneName(commonIupac) || parseCarboxylicAcidName(commonIupac) || parseAldehydeName(commonIupac) || parseKetoneName(commonIupac) || parseAmideName(commonIupac) || parseAmineName(commonIupac) || parseEtherName(commonIupac) || parseEsterName(commonIupac) || parseNitrileName(commonIupac) || parseNitroName(commonIupac) || parseDerivativeName(commonIupac) || parseAromaticIupacName(commonIupac) || parseAcyclicHaloalkaneName(commonIupac) || parseAcyclicIupacName(commonIupac) || parseHeterocyclicAromaticName(input) || parseOrthoMetaParaBenzeneName(input) || parseConvertedAromaticBaseName(input) || parseHalobenzeneName(input) || parseAromaticIupacName(input))
          : (parseHeterocyclicAromaticName(input) || parseOrthoMetaParaBenzeneName(input) || parseConvertedAromaticBaseName(input) || parseHalobenzeneName(input) || parseCarboxylicAcidName(input) || parseAldehydeName(input) || parseKetoneName(input) || parseAmideName(input) || parseAmineName(input) || parseEtherName(input) || parseEsterName(input) || parseNitrileName(input) || parseNitroName(input) || parseDerivativeName(input) || parseAromaticIupacName(input) || parseAcyclicHaloalkaneName(input) || parseAcyclicIupacName(input));
        if (parsed) {
          if (commonIupac && !parsed.queryName) {
            parsed.queryName = String(input || "").trim();
            parsed.matchedName = String(input || "").trim();
          }
          if (parsed.status === "ok" && parsed.family && !ENUMERATED_FAMILIES[parsed.family]) {
            return unsupportedNamedFamily(String(input || "").trim(), parsed);
          }
          if (selectedFamily && selectedFamily !== "auto" && parsed.family !== selectedFamily) {
            return {
              status: "unsupported",
              formula: parsed.queryName || String(input || "").trim(),
              familyLabel: FAMILY_INFO[selectedFamily].label,
              message:
                (parsed.queryName || String(input || "").trim()) +
                " parses as a " +
                parsed.familyLabel.toLowerCase() +
                ", but the current filter is set to " +
                FAMILY_INFO[selectedFamily].label.toLowerCase() +
                ". Choose Auto or the matching family."
            };
          }
          return parsed;
        }
      } catch (error) {
        var parsedSuggestions = suggestNames(input, selectedFamily);
        return {
          status: "unsupported",
          formula: String(input || "").trim(),
          familyLabel: selectedFamily && selectedFamily !== "auto" && FAMILY_INFO[selectedFamily] ? FAMILY_INFO[selectedFamily].label : "Auto",
          popupTitle: "That compound does not exist as written",
          suggestions: parsedSuggestions,
          suggestionLabel: parsedSuggestions.length ? "Did you mean one of these names?" : "",
          hints: ["Use Auto mode", "Check the locants and parent chain"],
          message: invalidNameMessage(input, error.message, parsedSuggestions)
        };
      }

      var suggestions = suggestNames(input, selectedFamily);
      return {
        status: "unsupported",
        formula: String(input || "").trim(),
        familyLabel: selectedFamily && selectedFamily !== "auto" && FAMILY_INFO[selectedFamily] ? FAMILY_INFO[selectedFamily].label : "Auto",
        popupTitle: "That compound does not exist as written",
        suggestions: suggestions,
        suggestionLabel: suggestions.length ? "Did you mean one of these names?" : "",
        hints: ["Try C5H12", "Try isobutane", "Try pent-2-ene"],
        message: invalidNameMessage(input, "", suggestions)
      };
    }

    if (selectedFamily && selectedFamily !== "auto" && match.family !== selectedFamily) {
      return {
        status: "unsupported",
        formula: match.name,
        familyLabel: FAMILY_INFO[selectedFamily].label,
        message:
          match.name +
          " is a " +
          match.familyLabel.toLowerCase() +
          ", but the current filter is set to " +
          FAMILY_INFO[selectedFamily].label.toLowerCase() +
          ". Choose Auto or the matching family."
      };
    }

    var analysis = analyzeFormula(match.formula, match.family);
    var matchedIsomer = analysis.isomers.find(function (isomer) {
      return isomer.canonical === match.canonical;
    });
    analysis.source = "name";
    analysis.queryName = String(input || "").trim();
    analysis.matchedName = match.name;
    analysis.matchedAlias = match.matchedAlias;
    analysis.matchedInputName = match.matchedInputName;
    analysis.matchedCanonical = match.canonical;
    analysis.nameOnly = true;
    analysis.scope =
      "Matched a specific hydrocarbon name. Formula isomer lists are shown only when you enter a formula.";
    analysis.isomers = matchedIsomer ? [matchedIsomer] : analysis.isomers.filter(function (isomer) {
      return isomer.canonical === match.canonical;
    });
    return analysis;
  }

  function analyzeQuery(input, selectedFamily) {
    if (isFormulaInput(input)) {
      return analyzeFormula(input, selectedFamily);
    }
    return analyzeName(input, selectedFamily);
  }

  function molecule3DModel(isomer) {
    var atoms = [];
    var bonds = [];
    var positions = new Map();

    function addAtom(element, x, y, z, label, charge) {
      atoms.push({ element: element, x: x, y: y, z: z, label: label || element, charge: charge || 0 });
      return atoms.length - 1;
    }

    function addBond(from, to, order) {
      bonds.push({ from: from, to: to, order: order || 1 });
    }

    function addCarbonHydrogens(carbonIndexes) {
        var candidates = [
          { x: 1, y: 1, z: 1 }, { x: 1, y: -1, z: -1 },
          { x: -1, y: 1, z: -1 }, { x: -1, y: -1, z: 1 },
          { x: 1, y: -1, z: 1 }, { x: -1, y: 1, z: 1 },
          { x: 1, y: 1, z: -1 }, { x: -1, y: -1, z: -1 }
        ];
        for (var ci = 0; ci < carbonIndexes.length; ci += 1) {
          var carbonIndex = carbonIndexes[ci];
          var carbon = atoms[carbonIndex];
          // Only carbons pick up implicit hydrogens; bridging hetero atoms
          // (ether oxygen) arrive with their full valence already bonded.
          if (carbon.element !== "C") continue;
          var valence = 0;
          var usedDirections = [];
          for (var bi = 0; bi < bonds.length; bi += 1) {
            var bond = bonds[bi];
            if (bond.from !== carbonIndex && bond.to !== carbonIndex) continue;
            valence += bond.order || 1;
            var other = atoms[bond.from === carbonIndex ? bond.to : bond.from];
            var dx = other.x - carbon.x;
            var dy = other.y - carbon.y;
            var dz = other.z - carbon.z;
            var length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            usedDirections.push({ x: dx / length, y: dy / length, z: dz / length });
          }
          var hydrogenCount = Math.max(0, Math.floor(4 - valence));
          for (var hi = 0; hi < hydrogenCount; hi += 1) {
            var best = null;
            var bestScore = Infinity;
            for (var di = 0; di < candidates.length; di += 1) {
              var direction = candidates[di];
              var magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
              var unit = { x: direction.x / magnitude, y: direction.y / magnitude, z: direction.z / magnitude };
              var score = -Infinity;
              for (var ui = 0; ui < usedDirections.length; ui += 1) {
                var used = usedDirections[ui];
                score = Math.max(score, unit.x * used.x + unit.y * used.y + unit.z * used.z);
              }
              if (!usedDirections.length) score = 0;
              if (score < bestScore) {
                best = unit;
                bestScore = score;
              }
            }
            if (!best) continue;
            usedDirections.push(best);
            var hydrogenIndex = addAtom(
              "H",
              carbon.x + best.x * 0.9,
              carbon.y + best.y * 0.9,
              carbon.z + best.z * 0.9,
              "H"
            );
            addBond(carbonIndex, hydrogenIndex, 1);
          }
        }
    }

    if (isomer.family === "bicyclic" || isomer.family === "fused_aromatic") {
      var graph = isomer.adjacency || [];
      var graphCoordinates = isomer.coordinates || graphLayout(graph);
      var totalBondLength = 0;
      var bondCount = 0;
      for (var ga = 0; ga < graph.length; ga += 1) {
        for (var gb = 0; gb < graph[ga].length; gb += 1) {
          var gn = graph[ga][gb];
          if (gn <= ga) continue;
          var gx = graphCoordinates[ga].x - graphCoordinates[gn].x;
          var gy = graphCoordinates[ga].y - graphCoordinates[gn].y;
          totalBondLength += Math.sqrt(gx * gx + gy * gy);
          bondCount += 1;
        }
      }
      var graphScale = bondCount ? 1.45 / (totalBondLength / bondCount) : 1;
      var graphCarbonIndexes = [];
      for (var gc = 0; gc < graph.length; gc += 1) {
        graphCarbonIndexes[gc] = addAtom(
          "C",
          graphCoordinates[gc].x * graphScale,
          graphCoordinates[gc].y * graphScale,
          0,
          "C"
        );
      }
      for (var ge = 0; ge < graph.length; ge += 1) {
        for (var gj = 0; gj < graph[ge].length; gj += 1) {
          var graphNeighbor = graph[ge][gj];
          if (graphNeighbor > ge) {
            addBond(
              graphCarbonIndexes[ge],
              graphCarbonIndexes[graphNeighbor],
              getBondOrder(isomer.edgeOrders, ge, graphNeighbor)
            );
          }
        }
      }
      addCarbonHydrogens(graphCarbonIndexes);
      return { atoms: atoms, bonds: bonds };
    }

    if (isomer.family === "aromatic") {
        var centerRadius = 1.35;
        var sequence = isomer.sequence || [null, null, null, null, null, null];
        var ringIndexes = [];
        for (var r = 0; r < 6; r += 1) {
          var angle = (-90 + r * 60) * Math.PI / 180;
          ringIndexes.push(addAtom("C", Math.cos(angle) * centerRadius, Math.sin(angle) * centerRadius, 0, "C"));
        }
        for (var rb = 0; rb < 6; rb += 1) {
          var nextRingAtom = (rb + 1) % 6;
          addBond(ringIndexes[rb], ringIndexes[nextRingAtom], rb % 2 === 0 ? 2 : 1);
        }
        for (var s = 0; s < sequence.length; s += 1) {
          var sub = sequence[s];
          var subCarbonCount = sub ? (sub.carbonCount || sub.size || 0) : 0;
          if (!sub || !subCarbonCount) continue;
          var base = atoms[ringIndexes[s]];
          var length = Math.sqrt(base.x * base.x + base.y * base.y) || 1;
          var outward = { x: base.x / length, y: base.y / length };
          var previous = ringIndexes[s];
          for (var sc = 0; sc < subCarbonCount; sc += 1) {
            var distance = 1.55 + sc * 1.5;
            var next = addAtom(
              "C",
              base.x + outward.x * distance,
              base.y + outward.y * distance,
              sc % 2 ? 0.25 : -0.2,
              "C"
            );
            addBond(previous, next, 1);
            previous = next;
          }
        }
        var aromaticCarbons = [];
        for (var ar = 0; ar < ringIndexes.length; ar += 1) aromaticCarbons.push(ringIndexes[ar]);
        for (var ac = 6; ac < atoms.length; ac += 1) {
          if (atoms[ac].element === "C") aromaticCarbons.push(ac);
        }
        addCarbonHydrogens(aromaticCarbons);
        return { atoms: atoms, bonds: bonds };
    }

    var adjacency = isomer.adjacency || [[]];
    var chain = isomer.chain && isomer.chain.length ? isomer.chain : allLongestChains(adjacency)[0];
    var ringBond = isomer.ringBond;
    if (ringBond && ringBond.length === 2) {
        var cyclePath = findPath(adjacency, ringBond[0], ringBond[1], null);
        if (cyclePath && cyclePath.length > 2) chain = cyclePath;
    }
    var chainSet = new Set(chain);
    var branchVectors = [
        { x: 0.2, y: 1, z: 0.35 },
        { x: -0.2, y: -1, z: 0.35 },
        { x: 0.25, y: 0.4, z: -1 },
        { x: -0.25, y: -0.4, z: -1 }
    ];

    if (ringBond && chain.length > 2) {
        var radius = 1.45;
        var cycleSize = chain.length;
        for (var rp = 0; rp < chain.length; rp += 1) {
          var ringAngle = (-90 + rp * 360 / cycleSize) * Math.PI / 180;
          positions.set(chain[rp], {
            x: Math.cos(ringAngle) * radius,
            y: Math.sin(ringAngle) * radius,
            z: 0
          });
        }
    } else {
        for (var i = 0; i < chain.length; i += 1) {
          positions.set(chain[i], {
            x: (i - (chain.length - 1) / 2) * 1.45,
            y: i % 2 === 0 ? -0.35 : 0.35,
            z: i % 2 === 0 ? 0.12 : -0.12
          });
        }
    }

    function placeBranch(node, parent, origin, vector, depth) {
        var length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z) || 1;
        var scale = 1.5;
        var point = {
          x: origin.x + vector.x / length * scale,
          y: origin.y + vector.y / length * scale,
          z: origin.z + vector.z / length * scale
        };
        positions.set(node, point);
        var children = adjacency[node].filter(function (next) {
          return next !== parent;
        });
        for (var child = 0; child < children.length; child += 1) {
          placeBranch(children[child], node, point, branchVectors[(child + depth) % branchVectors.length], depth + 1);
        }
    }

    for (var c = 0; c < chain.length; c += 1) {
        var atom = chain[c];
        var branches = adjacency[atom].filter(function (next) {
          return !chainSet.has(next);
        });
        for (var b = 0; b < branches.length; b += 1) {
          placeBranch(branches[b], atom, positions.get(atom), branchVectors[(c + b) % branchVectors.length], 1);
        }
    }

    var carbonIndexes = [];
    for (var carbon = 0; carbon < adjacency.length; carbon += 1) {
        var pos = positions.get(carbon) || { x: 0, y: 0, z: 0 };
        var carbonElement = (isomer.elements && isomer.elements[carbon]) || "C";
        carbonIndexes[carbon] = addAtom(carbonElement, pos.x, pos.y, pos.z, carbonElement);
    }
    for (var edge = 0; edge < adjacency.length; edge += 1) {
        for (var e = 0; e < adjacency[edge].length; e += 1) {
          var neighbor = adjacency[edge][e];
          if (neighbor > edge) {
            addBond(carbonIndexes[edge], carbonIndexes[neighbor], getBondOrder(isomer.edgeOrders, edge, neighbor));
          }
        }
    }
    if (ringBond && ringBond.length === 2) {
        addBond(carbonIndexes[ringBond[0]], carbonIndexes[ringBond[1]], getBondOrder(isomer.edgeOrders, ringBond[0], ringBond[1]));
    }

    for (var a = 0; a < (isomer.attachments || []).length; a += 1) {
        var attachment = isomer.attachments[a];
        var parent = positions.get(attachment.atom) || { x: 0, y: 0, z: 0 };
        var direction = branchVectors[(attachment.atom + a + 1) % branchVectors.length];
        var length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z) || 1;
        direction = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
        var hetero = addAtom(
          attachment.element,
          parent.x + direction.x * 1.45,
          parent.y + direction.y * 1.45,
          parent.z + direction.z * 1.45,
          attachment.label,
          attachment.kind === "nitro" ? 1 : 0
        );
        addBond(carbonIndexes[attachment.atom], hetero, attachment.bondOrder || 1);
        if (attachment.kind === "nitro") {
          // Use one valid resonance contributor for the nitro group.
          var nitroAngle = Math.atan2(direction.y, direction.x);
          for (var no = 0; no < 2; no += 1) {
            var nAngle = nitroAngle + (no === 0 ? 0.65 : -0.65);
            var oxygen = addAtom(
              "O",
              atoms[hetero].x + Math.cos(nAngle) * 1.2,
              atoms[hetero].y + Math.sin(nAngle) * 1.2,
              atoms[hetero].z + (no === 0 ? 0.4 : -0.4),
              "O",
              no === 1 ? -1 : 0
            );
            addBond(hetero, oxygen, no === 0 ? 2 : 1);
          }
        }
        for (var ah = 0; ah < (attachment.hydrogens || 0); ah += 1) {
          var angle = (ah + 1) * 2.4;
          var hx = -direction.x * 0.45 + Math.cos(angle) * 0.75;
          var hy = -direction.y * 0.45 + Math.sin(angle) * 0.75;
          var hz = -direction.z * 0.45 + (ah % 2 ? -0.35 : 0.35);
          var hLength = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
          var hydrogen = addAtom(
            "H",
            atoms[hetero].x + hx / hLength * 0.9,
            atoms[hetero].y + hy / hLength * 0.9,
            atoms[hetero].z + hz / hLength * 0.9,
            "H"
          );
          addBond(hetero, hydrogen, 1);
        }
    }

    addCarbonHydrogens(carbonIndexes);
    return { atoms: atoms, bonds: bonds };
  }

  function molecule3DMarkup(isomer, compact) {
    if (compact) {
        return (
          '<div class="molecule-3d-card">' +
          '<div class="molecule-3d-preview" aria-hidden="true"><i></i><i></i><i></i></div>' +
          '<span>Interactive 3D structure</span>' +
          '<small>Open to rotate and zoom</small>' +
          "</div>"
        );
    }
    var modelData = JSON.stringify(molecule3DModel(isomer));
    return (
        '<div class="viewer-3d-stage">' +
          '<div class="mol-viewer-3d" data-molecule-model="' +
          encodeURIComponent(modelData) +
          '"></div>' +
          '<div class="viewer-3d-controls">' +
            '<p>Drag to rotate · scroll or pinch to zoom</p>' +
            '<div>' +
              '<button type="button" data-3d-rotation aria-pressed="true">Pause rotation</button>' +
              '<button type="button" data-3d-reset>Reset view</button>' +
            '</div>' +
          '</div>' +
        '</div>'
    );
  }

  function renderIsomerDiagram(isomer, displayMode, context) {
    if (displayMode === "3d") {
      return molecule3DMarkup(isomer, context !== "viewer");
    }
    if (isomer.family === "bicyclic" || isomer.family === "fused_aromatic") {
      return buildGraphDiagramSvg(isomer, displayMode);
    }
    if (isomer.family === "cycloalkane" || isomer.family === "cycloalkene") {
      return buildCycloalkaneDiagramSvg(isomer, displayMode);
    }
    return isomer.family === "aromatic"
      ? buildAromaticDiagramSvg(isomer, displayMode)
      : buildDiagramSvg(isomer.adjacency, isomer.chain, isomer.edgeOrders, displayMode, isomer.attachments, isomer.elements);
  }

  function renderResults(target, countLabel, analysis, titleTarget, displayMode) {
    if (!target) {
      return;
    }

    target.innerHTML = "";

    // Keep the page quiet until there is something to show: the results block
    // (heading, toolbar, cards) only appears once a search resolves, while the
    // progress bar keeps it visible during analysis.
    var section = target.parentNode;
    if (section && section.classList) {
      section.hidden =
        analysis.status !== "ok" && !document.body.classList.contains("is-analyzing");
    }

    if (titleTarget) {
      titleTarget.textContent = "Isomers";
    }
    if (countLabel) {
      countLabel.textContent = "";
    }

    if (analysis.status !== "ok") {
      var template = document.getElementById("empty-state-template");
      target.appendChild(template.content.cloneNode(true));
      return;
    }

    if (countLabel) {
      countLabel.textContent =
        analysis.parsedOnly
          ? "Parsed IUPAC structure"
          : analysis.nameOnly
          ? "Matched " + (analysis.matchedAlias ? analysis.matchedAlias + " (" + analysis.matchedName + ")" : analysis.matchedName) + " as one compound"
          : analysis.source === "name"
          ? "Matched " +
            (analysis.matchedAlias ? analysis.matchedAlias + " (" + analysis.matchedName + ")" : analysis.matchedName) +
            " within " +
            analysis.isomers.length +
            " related " +
            analysis.familyLabel.toLowerCase() +
            " isomers"
          : analysis.isomers.length +
            " " +
            analysis.familyLabel.toLowerCase() +
            " constitutional " +
            (analysis.isomers.length === 1 ? "isomer" : "isomers");
    }
    if (countLabel && analysis.ambiguityNote) {
      countLabel.textContent += analysis.ambiguityNote;
    }
    if (titleTarget && (analysis.parsedOnly || analysis.nameOnly)) {
      titleTarget.textContent = "Compound";
    }

    // Remove any existing filter bars from previous renders
    if (target.parentNode) {
      var existingFilters = target.parentNode.querySelectorAll(".isomer-filter-bar");
      for (var ef = 0; ef < existingFilters.length; ef += 1) {
        existingFilters[ef].remove();
      }
    }

    // Add isomer type filter tabs for alkene/alkyne families
    var currentFilterType = "all";
    if (analysis.family === "alkene" || analysis.family === "alkyne") {
      var filterBar = document.createElement("div");
      filterBar.className = "isomer-filter-bar";
      var typeCounts = { all: analysis.isomers.length, chain: 0, positional: 0, geometric: 0 };
      for (var fi = 0; fi < analysis.isomers.length; fi += 1) {
        var it = analysis.isomers[fi];
        if (it.isomerType === "chain") typeCounts.chain++;
        else typeCounts.positional++;
        if (it.hasGeometric) typeCounts.geometric++;
      }
      var filterTypes = ["all", "positional", "chain"];
      if (typeCounts.geometric > 0) filterTypes.push("geometric");
      for (var ft = 0; ft < filterTypes.length; ft += 1) {
        var fbtn = document.createElement("button");
        fbtn.type = "button";
        fbtn.className = "isomer-filter-btn" + (ft === 0 ? " active" : "");
        fbtn.textContent = filterTypes[ft].charAt(0).toUpperCase() + filterTypes[ft].slice(1) + " (" + typeCounts[filterTypes[ft]] + ")";
        fbtn.setAttribute("data-filter-type", filterTypes[ft]);
        filterBar.appendChild(fbtn);
      }
      target.parentNode.insertBefore(filterBar, target);

      // Attach click handlers for filter buttons
      filterBar.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-filter-type]");
        if (!btn) return;
        var filterType = btn.getAttribute("data-filter-type");
        // Update active state
        var allBtns = filterBar.querySelectorAll(".isomer-filter-btn");
        for (var ab = 0; ab < allBtns.length; ab += 1) {
          allBtns[ab].classList.toggle("active", allBtns[ab].getAttribute("data-filter-type") === filterType);
        }
        // Filter cards
        var cards = target.querySelectorAll(".isomer-card");
        for (var ci = 0; ci < cards.length; ci += 1) {
          var cardType = cards[ci].getAttribute("data-isomer-type");
          var cardGeo = cards[ci].getAttribute("data-has-geometric") === "true";
          if (filterType === "all") {
            cards[ci].style.display = "";
          } else if (filterType === "geometric") {
            cards[ci].style.display = cardGeo ? "" : "none";
          } else {
            cards[ci].style.display = cardType === filterType ? "" : "none";
          }
        }
      });
    }

    for (var i = 0; i < analysis.isomers.length; i += 1) {
      var isomer = analysis.isomers[i];
      var card = document.createElement("article");
      card.className = "isomer-card";
      card.style.setProperty("--card-index", String(i));
      if (isomer.family) {
        card.setAttribute("data-family", isomer.family);
      }
      if (isomer.isomerType) {
        card.setAttribute("data-isomer-type", isomer.isomerType);
      }
      if (isomer.hasGeometric) {
        card.setAttribute("data-has-geometric", "true");
      }
      if (analysis.parsedOnly || analysis.nameOnly || (analysis.matchedCanonical && isomer.canonical === analysis.matchedCanonical)) {
        card.classList.add("matched-card");
      }

      var header = document.createElement("header");
      var pill = document.createElement("div");
      pill.className = "index-pill";
      pill.textContent = String(i + 1);

      var titleBlock = document.createElement("div");
      var title = document.createElement("h3");
      title.textContent = isomer.name;
      var formula = document.createElement("p");
      formula.className = "formula-line";
      formula.textContent =
        analysis.parsedOnly
          ? analysis.formula + " | parsed from IUPAC name"
          : analysis.nameOnly
          ? analysis.formula + " | matched " + (analysis.matchedAlias ? analysis.matchedAlias : "name")
          :
        analysis.matchedCanonical && isomer.canonical === analysis.matchedCanonical
          ? analysis.formula + " | matched " + (analysis.matchedAlias ? analysis.matchedAlias : "name")
          : analysis.formula;
      titleBlock.appendChild(title);
      titleBlock.appendChild(formula);
      if (isomer.commonNames && isomer.commonNames.length) {
        var common = document.createElement("p");
        common.className = "common-name-line";
        common.textContent = "Also called " + isomer.commonNames.slice(0, 3).join(", ");
        titleBlock.appendChild(common);
      }
      header.appendChild(pill);
      header.appendChild(titleBlock);
      var openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "open-compound";
      openButton.textContent = "Open";
      openButton.setAttribute("data-open-compound", String(i));
      header.appendChild(openButton);

      var cardActions = document.createElement("div");
      cardActions.className = "card-actions";
      var copyNameBtn = document.createElement("button");
      copyNameBtn.type = "button";
      copyNameBtn.className = "copy-btn";
      copyNameBtn.textContent = "Copy name";
      copyNameBtn.setAttribute("data-copy-name", escapeHtml(isomer.name));
      var copyFormulaBtn = document.createElement("button");
      copyFormulaBtn.type = "button";
      copyFormulaBtn.className = "copy-btn";
      copyFormulaBtn.textContent = "Copy formula";
      copyFormulaBtn.setAttribute("data-copy-formula", escapeHtml(analysis.formula));
      cardActions.appendChild(copyNameBtn);
      cardActions.appendChild(copyFormulaBtn);

      var diagram = document.createElement("div");
      diagram.className = "diagram";
      diagram.innerHTML = renderIsomerDiagram(isomer, displayMode, "card");

      card.appendChild(header);
      card.appendChild(cardActions);
      card.appendChild(diagram);
      target.appendChild(card);
    }
  }

  var threeModulePromise = null;

  function loadThreeScriptFallback() {
    if (typeof window !== "undefined" && window.THREE) {
      return Promise.resolve(window.THREE);
    }
    if (typeof document === "undefined") {
      return Promise.reject(new Error("3D rendering needs a browser."));
    }
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector("script[data-three-fallback]");
      if (existing) {
        existing.addEventListener("load", function () {
          resolve(window.THREE);
        });
        existing.addEventListener("error", reject);
        return;
      }

      var script = document.createElement("script");
      script.src = "./vendor/three.min.js";
      script.async = true;
      script.setAttribute("data-three-fallback", "true");
      script.addEventListener("load", function () {
        if (window.THREE) {
          resolve(window.THREE);
        } else {
          reject(new Error("3D engine loaded without a global THREE object."));
        }
      });
      script.addEventListener("error", reject);
      document.head.appendChild(script);
    });
  }

  function loadThreeModule() {
    if (!threeModulePromise) {
      if (typeof location !== "undefined" && location.protocol === "file:") {
        threeModulePromise = loadThreeScriptFallback();
      } else {
        threeModulePromise = import("./vendor/three.module.min.js").catch(function () {
          return loadThreeScriptFallback();
        });
      }
    }
    return threeModulePromise;
  }

  function atomColor(element) {
    return {
      C: 0x2f8f83,
      H: 0xf8faf7,
      O: 0xe0524d,
      F: 0x7ddf9a,
      Cl: 0x5bbf58,
      Br: 0xa35b45,
      I: 0x7c5aa6
    }[element] || 0x8aa09a;
  }

  function atomRadius(element) {
    return {
      H: 0.13,
      O: 0.24,
      F: 0.22,
      Cl: 0.28,
      Br: 0.31,
      I: 0.34
    }[element] || 0.25;
  }

  function renderCylinderBetween(THREE, scene, start, end, radius, color) {
    var direction = new THREE.Vector3().subVectors(end, start);
    var length = direction.length();
    if (!length) {
      return;
    }
    var geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
    var material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.48, metalness: 0.08 });
    var cylinder = new THREE.Mesh(geometry, material);
    cylinder.position.copy(start).add(end).multiplyScalar(0.5);
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    scene.add(cylinder);
  }

  function mountMolecule3D(container, THREE) {
    if (!container || container.getAttribute("data-rendered") === "true") {
      return;
    }
    container.setAttribute("data-rendered", "true");

    var model = JSON.parse(decodeURIComponent(container.getAttribute("data-molecule-model") || "%7B%22atoms%22%3A%5B%5D%2C%22bonds%22%3A%5B%5D%7D"));
    container.innerHTML = "";
    var scene = new THREE.Scene();
    var group = new THREE.Group();
    scene.add(group);

    var points = [];
    var atomSpheres = [];
    for (var i = 0; i < model.atoms.length; i += 1) {
      var atom = model.atoms[i];
      var point = new THREE.Vector3(atom.x, atom.y, atom.z);
      points.push(point);
      var geometry = new THREE.SphereGeometry(atomRadius(atom.element), 24, 16);
      var material = new THREE.MeshStandardMaterial({
        color: atomColor(atom.element),
        roughness: 0.38,
        metalness: atom.element === "Br" || atom.element === "I" ? 0.16 : 0.04
      });
      var sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(point);
      sphere.userData = { element: atom.element, label: atom.label };
      group.add(sphere);
      atomSpheres.push(sphere);
    }

    for (var b = 0; b < model.bonds.length; b += 1) {
      var bond = model.bonds[b];
      renderCylinderBetween(THREE, group, points[bond.from], points[bond.to], bond.order > 1 ? 0.045 : 0.055, 0x87938f);
    }

    // Add text labels for non-carbon atoms
    if (typeof THREE.Sprite !== "undefined" && typeof THREE.SpriteMaterial !== "undefined" && typeof THREE.CanvasTexture !== "undefined") {
      for (var li = 0; li < model.atoms.length; li += 1) {
        if (model.atoms[li].element !== "C") {
          var canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 32;
          var ctx = canvas.getContext("2d");
          ctx.font = "bold 22px Arial";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(model.atoms[li].label, 32, 16);
          var texture = new THREE.CanvasTexture(canvas);
          var spriteMat = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
          var sprite = new THREE.Sprite(spriteMat);
          sprite.position.copy(points[li]);
          sprite.position.y += 0.35;
          sprite.scale.set(0.5, 0.25, 1);
          group.add(sprite);
        }
      }
    }

    var box = new THREE.Box3().setFromObject(group);
    var size = new THREE.Vector3();
    var center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    group.position.sub(center);

    var width = container.clientWidth || 720;
    var height = container.clientHeight || 420;
    var camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    var span = Math.max(size.x, size.y, size.z, 2);
    var camDist = span * 2.8;
    camera.position.set(0, 0.5, camDist);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x315e7c, 2.3));
    var key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(2.8, 4, 5);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x8ff5df, 1.1);
    fill.position.set(-4, -2, 3);
    scene.add(fill);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(width, height, false);
    container.appendChild(renderer.domElement);

    // Orbit controls (minimal implementation for touch/mouse)
    var isDragging = false;
    var prevMouse = { x: 0, y: 0 };
    var spherical = { theta: 0, phi: Math.PI / 6, radius: camDist };

    function updateCamera() {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);
    }

    function onPointerDown(e) {
      isDragging = true;
      var touch = e.touches ? e.touches[0] : e;
      prevMouse = { x: touch.clientX, y: touch.clientY };
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      var touch = e.touches ? e.touches[0] : e;
      var dx = touch.clientX - prevMouse.x;
      var dy = touch.clientY - prevMouse.y;
      prevMouse = { x: touch.clientX, y: touch.clientY };
      spherical.theta -= dx * 0.008;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + dy * 0.008));
      updateCamera();
    }

    function onPointerUp() { isDragging = false; }

    function onWheel(e) {
      e.preventDefault();
      spherical.radius = Math.max(span * 0.8, Math.min(span * 6, spherical.radius * (1 + e.deltaY * 0.001)));
      updateCamera();
    }

    container.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    container.addEventListener("touchstart", onPointerDown, { passive: true });
    container.addEventListener("touchmove", onPointerMove, { passive: false });
    container.addEventListener("touchend", onPointerUp);
    container.addEventListener("wheel", onWheel, { passive: false });

    updateCamera();

    function resize() {
      var nextWidth = container.clientWidth || width;
      var nextHeight = container.clientHeight || height;
      if (nextWidth === width && nextHeight === height) {
        return;
      }
      width = nextWidth;
      height = nextHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    var autoRotate = true;
    function animate() {
      if (!document.body.contains(container)) {
        renderer.dispose();
        container.removeEventListener("mousedown", onPointerDown);
        container.removeEventListener("touchstart", onPointerDown);
        container.removeEventListener("touchmove", onPointerMove);
        container.removeEventListener("touchend", onPointerUp);
        container.removeEventListener("wheel", onWheel);
        return;
      }
      resize();
      if (autoRotate && !isDragging) {
        spherical.theta += 0.004;
        updateCamera();
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();
  }

  function render3DCanvases(scope) {
    if (typeof document === "undefined") {
      return;
    }
    var targets = (scope || document).querySelectorAll(".molecule-3d[data-molecule-model]");
    if (!targets.length) {
      return;
    }
    loadThreeModule()
      .then(function (THREE) {
        for (var i = 0; i < targets.length; i += 1) {
          mountMolecule3D(targets[i], THREE);
        }
      })
      .catch(function () {
        for (var i = 0; i < targets.length; i += 1) {
          targets[i].innerHTML = "<span>3D could not load. Check your connection and try again.</span>";
        }
      });
  }

  var hasMounted = false;

  function mount() {
    if (hasMounted) {
      return;
    }
    hasMounted = true;
    var form = document.querySelector("[data-formula-form]");
    var input = document.querySelector("[data-formula-input]");
    var analyzeButton = form ? form.querySelector('button[type="submit"]') : null;
    var results = document.querySelector("[data-results]");
    var resultsSection = document.querySelector("[data-results-section]");
    var progress = document.querySelector("[data-analysis-progress]");
    var resultsTitle = document.querySelector("[data-results-title]");
    var countLabel = document.querySelector("[data-count-label]");
    var modeButtons = document.querySelectorAll("[data-mode]");
    var viewButtons = document.querySelectorAll("[data-view-mode]");
    var modeSelect = document.querySelector("[data-mode-select]");
    var viewSelect = document.querySelector("[data-view-select]");
    var themeSelect = document.querySelector("[data-theme-select]");
    var settingsDrawer = document.querySelector(".settings-drawer");
    var viewer = document.querySelector("[data-compound-viewer]");
    var viewerPanel = viewer ? viewer.querySelector(".viewer-panel") : null;
    var viewerTitle = document.querySelector("[data-viewer-title]");
    var viewerMeta = document.querySelector("[data-viewer-meta]");
    var viewerDiagram = document.querySelector("[data-viewer-diagram]");
    var viewerClose = document.querySelector("[data-viewer-close]");
    var viewerFullscreen = document.querySelector("[data-viewer-fullscreen]");
    var tour = document.querySelector("[data-tour]");
    var tourOpen = document.querySelector("[data-tour-open]");
    var tourClose = document.querySelector("[data-tour-close]");
    var popup = document.querySelector("[data-analysis-popup]");
    var popupTitle = document.querySelector("[data-popup-title]");
    var popupMessage = document.querySelector("[data-popup-message]");
    var popupHints = document.querySelector("[data-popup-hints]");
    var popupClose = document.querySelector("[data-popup-close]");
    var shareOpen = document.querySelector("[data-share-open]");
    var shareSheet = document.querySelector("[data-share-sheet]");
    var shareClose = document.querySelector("[data-share-close]");
    var shareUrlInput = document.querySelector("[data-share-url]");
    var shareCopy = document.querySelector("[data-copy-share]");
    var shareQr = document.querySelector("[data-qr-code]");
    var shareStatus = document.querySelector("[data-share-status]");
    var nativeShare = document.querySelector("[data-native-share]");
    var socialLinks = document.querySelectorAll("[data-social-share]");
    var installButton = document.querySelector("[data-install-app]");
    var installSheet = document.querySelector("[data-install-sheet]");
    var installClose = document.querySelector("[data-install-close]");
    var installSteps = document.querySelector("[data-install-steps]");
    var recentList = document.querySelector("[data-recent-list]");
    var params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
    var themeStorageKey = "hydrocarbon-theme";
    var selectedMode = params.get("family") || "auto";
    var requestedView = params.get("view");
    var displayMode = requestedView === "bondline" || requestedView === "3d" ? requestedView : "atom";
    var selectedTheme = isValidChoice(readStoredSetting("hydrocarbon-theme", "auto"), ["auto", "light", "dark"], "auto");
    var initialQuery = params.get("q") || params.get("query") || "";
    var currentAnalysis = null;
    var currentViewer3D = null;
    var tourStorageKey = "hydrocarbon-isomer-tour-seen";
    var recentStorageKey = "hydrocarbon-recent-inputs";
    var analyzeTimer = null;
    var deferredInstallPrompt = null;
    var searchCount = 0;

    function readStoredSetting(key, fallback) {
      try {
        return localStorage.getItem(key) || fallback;
      } catch (error) {
        return fallback;
      }
    }

    function writeStoredSetting(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        // Visual settings are optional when storage is blocked.
      }
    }

    function isValidChoice(value, choices, fallback) {
      return choices.indexOf(value) !== -1 ? value : fallback;
    }

     function systemPrefersDark() {
      return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
    }

    function setCustomSelectValue(wrapper, value) {
      if (!wrapper) {
        return;
      }
      var valueSpan = wrapper.querySelector("[data-select-value]");
      var options = wrapper.querySelectorAll("[data-select-option]");
      for (var i = 0; i < options.length; i += 1) {
        var opt = options[i];
        var isSelected = opt.getAttribute("data-select-option") === value;
        opt.setAttribute("data-selected", isSelected ? "true" : "false");
        opt.setAttribute("aria-selected", isSelected ? "true" : "false");
        opt.tabIndex = isSelected ? 0 : -1;
        if (isSelected && valueSpan) {
          valueSpan.textContent = opt.textContent.trim();
        }
      }
    }

    function initCustomSelect(wrapper, onChange) {
      if (!wrapper) {
        return;
      }
      var trigger = wrapper.querySelector("[data-select-trigger]");
      var menu = wrapper.querySelector("[data-select-menu]");
      var options = wrapper.querySelectorAll("[data-select-option]");

      function isMenuOpen() {
        return menu && !menu.hidden;
      }

      function setMenuOpen(open) {
        if (!menu) {
          return;
        }
        menu.hidden = !open;
        menu.setAttribute("data-hidden", open ? "false" : "true");
        wrapper.setAttribute("data-open", open ? "true" : "false");
        if (trigger) {
          trigger.setAttribute("aria-expanded", open ? "true" : "false");
        }
      }

      function focusOption(index) {
        if (!options.length) {
          return;
        }
        var boundedIndex = (index + options.length) % options.length;
        options[boundedIndex].focus();
      }

      if (trigger) {
        trigger.addEventListener("click", function (e) {
          e.stopPropagation();
          var otherSelects = document.querySelectorAll("[data-select]");
          for (var j = 0; j < otherSelects.length; j += 1) {
            if (otherSelects[j] !== wrapper) {
              var otherMenu = otherSelects[j].querySelector("[data-select-menu]");
              var otherTrigger = otherSelects[j].querySelector("[data-select-trigger]");
              if (otherMenu) {
                otherMenu.hidden = true;
                otherMenu.setAttribute("data-hidden", "true");
              }
              otherSelects[j].setAttribute("data-open", "false");
              if (otherTrigger) {
                otherTrigger.setAttribute("aria-expanded", "false");
              }
            }
          }
          setMenuOpen(!isMenuOpen());
        });
        trigger.addEventListener("keydown", function (event) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setMenuOpen(true);
            var selectedIndex = 0;
            for (var j = 0; j < options.length; j += 1) {
              if (options[j].getAttribute("aria-selected") === "true") {
                selectedIndex = j;
                break;
              }
            }
            focusOption(selectedIndex);
          } else if (event.key === "Escape" && isMenuOpen()) {
            setMenuOpen(false);
          }
        });
      }

      for (var i = 0; i < options.length; i += 1) {
        options[i].setAttribute("role", "option");
        options[i].tabIndex = -1;
        options[i].addEventListener("click", function () {
          var val = this.getAttribute("data-select-option");
          setCustomSelectValue(wrapper, val);
          setMenuOpen(false);
          if (trigger) {
            trigger.focus();
          }
          if (typeof onChange === "function") {
            onChange(val);
          }
        });
      }

      if (menu) {
        menu.addEventListener("keydown", function (event) {
          var activeIndex = Array.prototype.indexOf.call(options, event.target);
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            focusOption(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            focusOption(event.key === "Home" ? 0 : options.length - 1);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setMenuOpen(false);
            if (trigger) {
              trigger.focus();
            }
          }
        });
      }

      document.addEventListener("click", function () {
        if (isMenuOpen()) {
          setMenuOpen(false);
        }
      });
    }

    function setMode(mode) {
      selectedMode = mode || "auto";
      for (var i = 0; i < modeButtons.length; i += 1) {
        modeButtons[i].classList.toggle("active", modeButtons[i].getAttribute("data-mode") === selectedMode);
      }
        if (modeSelect) {
        setCustomSelectValue(modeSelect, selectedMode);
      }
    }

    function setDisplayMode(mode) {
      displayMode = mode || "atom";
      for (var i = 0; i < viewButtons.length; i += 1) {
        viewButtons[i].classList.toggle("active", viewButtons[i].getAttribute("data-view-mode") === displayMode);
      }
        if (viewSelect) {
        setCustomSelectValue(viewSelect, displayMode);
      }
    }

    function setTheme(theme) {
      selectedTheme = theme || "auto";
      var isDark = selectedTheme === "dark" || (selectedTheme === "auto" && systemPrefersDark());
      document.body.classList.toggle("theme-dark", isDark);
      document.body.classList.toggle("theme-light", !isDark);
      if (themeSelect) {
        setCustomSelectValue(themeSelect, selectedTheme);
      }
      writeStoredSetting(themeStorageKey, selectedTheme);
    }

    function loadRecentInputs() {
      try {
        var parsed = JSON.parse(localStorage.getItem(recentStorageKey) || "[]");
        if (!Array.isArray(parsed)) {
          return [];
        }
        return parsed.filter(function (item) {
          return typeof item === "string" && item.trim();
        }).slice(0, 8);
      } catch (error) {
        return [];
      }
    }

    function saveRecentInputs(items) {
      try {
        localStorage.setItem(recentStorageKey, JSON.stringify(items.slice(0, 8)));
      } catch (error) {
        // Recent inputs are a convenience; the app still works when storage is blocked.
      }
    }

    var HISTORY_CLOCK_ICON =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/></svg>';
    var HISTORY_REMOVE_ICON =
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    // The history dropdown behaves like a browser's: it only opens while the
    // empty search field has focus, and it never competes with the suggestions.
    function historyShouldOpen(items) {
      return Boolean(
        recentList &&
        input &&
        items.length &&
        document.activeElement === input &&
        !input.value.trim() &&
        !(suggestionsDropdown && !suggestionsDropdown.hidden)
      );
    }

    function renderRecentInputs() {
      if (!recentList) {
        return;
      }
      recentList.innerHTML = "";
      var items = loadRecentInputs();
      if (!historyShouldOpen(items)) {
        recentList.hidden = true;
        return;
      }

      var head = document.createElement("div");
      head.className = "history-head";
      var heading = document.createElement("span");
      heading.textContent = "Recent searches";
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "history-clear";
      clear.setAttribute("data-recent-clear", "");
      clear.textContent = "Clear all";
      head.appendChild(heading);
      head.appendChild(clear);
      recentList.appendChild(head);

      for (var i = 0; i < items.length; i += 1) {
        var row = document.createElement("div");
        row.className = "history-row";

        var pick = document.createElement("button");
        pick.type = "button";
        pick.className = "history-pick";
        pick.setAttribute("data-recent-value", items[i]);
        pick.innerHTML = HISTORY_CLOCK_ICON + '<span class="history-text"></span>';
        pick.querySelector(".history-text").textContent = items[i];

        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "history-remove";
        remove.setAttribute("data-recent-remove", items[i]);
        remove.setAttribute("aria-label", "Remove " + items[i] + " from recent searches");
        remove.innerHTML = HISTORY_REMOVE_ICON;

        row.appendChild(pick);
        row.appendChild(remove);
        recentList.appendChild(row);
      }
      recentList.hidden = false;
    }

    function forgetRecentInput(value) {
      var key = normalizeName(value);
      saveRecentInputs(loadRecentInputs().filter(function (item) {
        return normalizeName(item) !== key;
      }));
      renderRecentInputs();
    }

    function rememberRecentInput(value, analysis) {
      var trimmed = String(value || "").trim();
      if (!trimmed || !analysis || analysis.status !== "ok") {
        return;
      }

      var items = loadRecentInputs();
      var key = normalizeName(trimmed);
      items = items.filter(function (item) {
        return normalizeName(item) !== key;
      });
      items.unshift(trimmed);
      saveRecentInputs(items);
      renderRecentInputs();
    }

    function closeAnalysisPopup() {
      if (popup) {
        popup.hidden = true;
      }
    }

    function openAnalysisPopup(analysis) {
      if (!popup || !analysis || (analysis.status !== "unsupported" && analysis.status !== "error")) {
        return;
      }
      popupTitle.textContent = analysis.popupTitle || (analysis.status === "error" ? "That input needs a tweak" : "I cannot display that one yet");
      popupMessage.textContent = analysis.message || "Try a supported formula or hydrocarbon name.";
      popupHints.innerHTML = "";
      var suggestions = analysis.suggestions || [];
      var renderedActions = new Set();
      if (suggestions.length) {
        var suggestionLabel = document.createElement("span");
        suggestionLabel.className = "popup-suggestion-label";
        suggestionLabel.textContent = analysis.suggestionLabel || "Did you mean one of these?";
        popupHints.appendChild(suggestionLabel);
        for (var s = 0; s < suggestions.length; s += 1) {
          var suggestion = document.createElement("button");
          suggestion.type = "button";
          suggestion.setAttribute("data-popup-example", suggestions[s]);
          suggestion.textContent = suggestions[s];
          popupHints.appendChild(suggestion);
          renderedActions.add(normalizeName(suggestions[s]));
        }
      }
      var hints = analysis.hints || ["Try C5H12", "Try isobutane", "Try pent-2-ene"];
      for (var i = 0; i < hints.length; i += 1) {
        var isAction = /^Try\s+/i.test(hints[i]);
        var hint = document.createElement(isAction ? "button" : "span");
        if (isAction) {
          var example = hints[i].replace(/^Try\s+/i, "");
          if (renderedActions.has(normalizeName(example))) {
            continue;
          }
          hint.type = "button";
          hint.setAttribute("data-popup-example", example);
          renderedActions.add(normalizeName(example));
        }
        hint.textContent = hints[i];
        popupHints.appendChild(hint);
      }
      popup.hidden = false;
    }

    function buildShareUrl() {
      if (typeof location === "undefined") {
        return "";
      }
      var url = new URL(location.href);
      url.hash = "";
      url.search = "";
      var query = input ? input.value.trim() : "";
      if (query) {
        url.searchParams.set("q", query);
      }
      if (selectedMode && selectedMode !== "auto") {
        url.searchParams.set("family", selectedMode);
      }
      if (displayMode && displayMode !== "atom") {
        url.searchParams.set("view", displayMode);
      }
      return url.toString();
    }

    function buildShareText() {
      var query = input ? input.value.trim() : "";
      if (query) {
        return "Explore " + query + " with Hydrocarbon Isomer Explorer.";
      }
      return "Explore hydrocarbon isomers from formulas, IUPAC names, and common names.";
    }

    function updateShareSheet() {
      var url = buildShareUrl();
      var text = buildShareText();
      if (shareUrlInput) {
        shareUrlInput.value = url;
        shareUrlInput.setAttribute("value", url);
      }
      if (shareQr) {
        try {
          if (typeof qrcode === "function") {
            var qr = qrcode(0, "M");
            qr.addData(url);
            qr.make();
            shareQr.src = qr.createDataURL(6, 8);
          } else {
            shareQr.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=" + encodeURIComponent(url);
          }
        } catch (error) {
          shareQr.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=" + encodeURIComponent(url);
        }
      }
      if (nativeShare) {
        nativeShare.hidden = !(navigator && navigator.share);
      }
      if (shareStatus) {
        shareStatus.textContent = "";
      }

      var encodedUrl = encodeURIComponent(url);
      var encodedText = encodeURIComponent(text);
      var shareTargets = {
        whatsapp: "https://wa.me/?text=" + encodedText + "%20" + encodedUrl,
        x: "https://twitter.com/intent/tweet?text=" + encodedText + "&url=" + encodedUrl,
        facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodedUrl,
        telegram: "https://t.me/share/url?url=" + encodedUrl + "&text=" + encodedText,
        linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + encodedUrl,
        email: "mailto:?subject=" + encodeURIComponent("Hydrocarbon Isomer Explorer") + "&body=" + encodedText + "%0A%0A" + encodedUrl
      };
      for (var i = 0; i < socialLinks.length; i += 1) {
        var key = socialLinks[i].getAttribute("data-social-share");
        if (shareTargets[key]) {
          socialLinks[i].setAttribute("href", shareTargets[key]);
        }
      }
    }

    function openShareSheet() {
      if (!shareSheet) {
        return;
      }
      updateShareSheet();
      shareSheet.hidden = false;
    }

    function closeShareSheet() {
      if (shareSheet) {
        shareSheet.hidden = true;
      }
    }

    function copyShareUrl() {
      var url = shareUrlInput ? shareUrlInput.value : buildShareUrl();
      var afterCopy = function () {
        if (shareStatus) {
          shareStatus.textContent = "Link copied.";
        }
      };
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(afterCopy).catch(function () {
          if (shareStatus) {
            shareStatus.textContent = "Copy failed. Select the link and copy it manually.";
          }
        });
        return;
      }
      if (shareUrlInput) {
        shareUrlInput.focus();
        shareUrlInput.select();
        try {
          document.execCommand("copy");
          afterCopy();
        } catch (error) {
          if (shareStatus) {
            shareStatus.textContent = "Select the link and copy it manually.";
          }
        }
      }
    }

    function shareFromDevice() {
      if (!navigator || !navigator.share) {
        return;
      }
      navigator
        .share({
          title: "Hydrocarbon Isomer Explorer",
          text: buildShareText(),
          url: buildShareUrl()
        })
        .then(function () {
          closeShareSheet();
        })
        .catch(function () {});
    }

    function isInstalledDisplay() {
      return (
        (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches) ||
        (navigator && navigator.standalone)
      );
    }

    function updateInstallButton() {
      if (!installButton) {
        return;
      }
      installButton.hidden = isInstalledDisplay();
    }

    function isIosDevice() {
      return navigator && /iphone|ipad|ipod/i.test(navigator.userAgent || "");
    }

    function openInstallSheet() {
      if (!installSheet) {
        return;
      }
      if (installSteps) {
        var middleStep = isIosDevice()
          ? "Tap Share, then choose Add to Home Screen."
          : "Open the browser menu, then choose Install app.";
        installSteps.innerHTML =
          '<article><span>01</span><p>Open this page in your browser.</p></article>' +
          '<article><span>02</span><p>' + middleStep + "</p></article>" +
          '<article><span>03</span><p>Launch Isomer Explorer from the new icon.</p></article>';
      }
      installSheet.hidden = false;
    }

    function closeInstallSheet() {
      if (installSheet) {
        installSheet.hidden = true;
      }
    }

    function installApp() {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(function () {
          deferredInstallPrompt = null;
          updateInstallButton();
        });
        return;
      }
      openInstallSheet();
    }

    function setAnalyzing(active) {
      document.body.classList.toggle("is-analyzing", active);
      if (analyzeButton) {
        analyzeButton.disabled = active;
        analyzeButton.classList.toggle("is-loading", active);
        analyzeButton.setAttribute("aria-label", active ? "Analyzing" : "Search");
        analyzeButton.setAttribute("title", active ? "Analyzing" : "Search");
        var submitLabel = analyzeButton.querySelector("[data-submit-label]");
        if (submitLabel) {
          submitLabel.textContent = active
            ? "Analyzing"
            : submitLabel.getAttribute("data-idle-label") || "Go";
        }
      }
      if (progress) {
        progress.hidden = !active;
      }
    }

    function shouldAutoScroll() {
      return typeof matchMedia !== "undefined" && matchMedia("(max-width: 760px)").matches;
    }

    function scrollToResults() {
      if (!resultsSection || !shouldAutoScroll()) {
        return;
      }
      var targetTop = Math.max(0, resultsSection.getBoundingClientRect().top + window.pageYOffset - 8);
      window.scrollTo(0, targetTop);
    }

    function run(options) {
      options = options || {};
      closeAnalysisPopup();
      setAnalyzing(false);
      if (!input.value.trim()) {
        currentAnalysis = { status: "idle" };
        renderResults(results, countLabel, currentAnalysis, resultsTitle, displayMode);
        return;
      }
      currentAnalysis = analyzeQuery(input.value, selectedMode);
      renderResults(results, countLabel, currentAnalysis, resultsTitle, displayMode);
      if (options.remember) {
        rememberRecentInput(input.value, currentAnalysis);
      }
      if (!options.silent && (currentAnalysis.status === "unsupported" || currentAnalysis.status === "error")) {
        openAnalysisPopup(currentAnalysis);
      }
      if (options.scroll) {
        scrollToResults();
      }
    }

    function queueRun(options) {
      options = options || {};
      if (analyzeTimer) {
        clearTimeout(analyzeTimer);
      }
      closeAnalysisPopup();
      if (!input.value.trim()) {
        run(options);
        return;
      }
      // Prune caches to prevent memory leaks
      pruneCache(plantedCache);
      pruneCache(rootCache);
      pruneCache(aromaticCache);
      setAnalyzing(true);
      renderResults(results, countLabel, { status: "idle" }, resultsTitle, displayMode);
      if (countLabel) {
        countLabel.textContent = "Building structure cards...";
      }
      if (options.scroll) {
        scrollToResults();
      }
      analyzeTimer = setTimeout(function () {
        analyzeTimer = null;
        run(options);
        autoCollapseSettings();
      }, 360);
    }

    function openCompoundViewer(index) {
      if (!viewer || !currentAnalysis || currentAnalysis.status !== "ok") {
        return;
      }
      var isomer = currentAnalysis.isomers[index];
      if (!isomer) {
        return;
      }

      viewerTitle.textContent = isomer.name;
      viewerMeta.textContent =
        currentAnalysis.formula +
        " | " +
        currentAnalysis.familyLabel +
        " | " +
        (displayMode === "bondline" ? "Bond-line view" : displayMode === "3d" ? "Interactive 3D view" : "Atom-label view");
      viewer.hidden = false;
      viewerDiagram.innerHTML = renderIsomerDiagram(isomer, displayMode, "viewer");
      if (displayMode === "3d") {
        var viewerContainer = viewerDiagram.querySelector(".mol-viewer-3d");
        if (!viewerContainer || typeof MoleculeViewer3D === "undefined") {
          viewerDiagram.innerHTML = '<p class="viewer-error" role="alert">The interactive 3D viewer is unavailable. Try another view mode.</p>';
          return;
        }
        try {
          var modelDataAttr = viewerContainer.getAttribute("data-molecule-model");
          var model = JSON.parse(decodeURIComponent(modelDataAttr || ""));
          currentViewer3D = new MoleculeViewer3D();
          currentViewer3D.init(viewerContainer);
          currentViewer3D.loadModel(model);
        } catch (error) {
          if (currentViewer3D) {
            currentViewer3D.dispose();
            currentViewer3D = null;
          }
          console.error("Could not open the 3D structure viewer.", error);
          viewerDiagram.innerHTML = '<p class="viewer-error" role="alert">The 3D structure could not be displayed. Try another view mode.</p>';
          return;
        }

        var rotationButton = viewerDiagram.querySelector("[data-3d-rotation]");
        var resetButton = viewerDiagram.querySelector("[data-3d-reset]");
        if (rotationButton) {
          rotationButton.addEventListener("click", function () {
            if (!currentViewer3D) return;
            var rotating = currentViewer3D.toggleRotation();
            rotationButton.textContent = rotating ? "Pause rotation" : "Resume rotation";
            rotationButton.setAttribute("aria-pressed", rotating ? "true" : "false");
          });
        }
        if (resetButton) {
          resetButton.addEventListener("click", function () {
            if (currentViewer3D) currentViewer3D.resetView();
          });
        }
      }
    }

    function closeCompoundViewer() {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      }
      if (viewer) {
        viewer.hidden = true;
      }
      if (currentViewer3D) {
        currentViewer3D.dispose();
        currentViewer3D = null;
      }
      if (viewerDiagram) {
        viewerDiagram.innerHTML = "";
      }
    }

    var tourSteps = [
      { target: "[data-formula-input]", title: "Search for compounds", description: "Enter a formula like C<sub>5</sub>H<sub>12</sub> or a name like isobutane, toluene, or ethanol." },
      { target: "[data-examples-track]", title: "Quick examples", description: "Tap any example chip to instantly see its isomers." },
      { target: ".settings-grid", title: "Customize your view", description: "Choose a mode (alkane, aromatic, etc.), a theme, and how to view structures — atom labels, bond-line, or 3D." },
      { target: "[data-results-section]", title: "Browse the results", description: "Each card shows an isomer with its IUPAC name, formula, and structure diagram." },
      { target: "[data-compound-viewer]", title: "Open for a closer look", description: "Tap Open on any card for a full-screen view with atom labels, bond-line, or interactive 3D modes." }
    ];

    var currentTourStep = 0;

    function openTour() {
      if (!tour) {
        return;
      }
      currentTourStep = 0;
      renderTourStep();
      tour.hidden = false;
    }

    function closeTour() {
      if (tour) {
        tour.hidden = true;
      }
      clearTourHighlight();
      try {
        localStorage.setItem(tourStorageKey, "true");
      } catch (error) {
        // Storage can be unavailable in strict browser modes.
      }
    }

    function clearTourHighlight() {
      var prev = document.querySelector("[data-tour-highlight]");
      if (prev) {
        prev.removeAttribute("data-tour-highlight");
      }
    }

    function scrollToTourTarget(selector) {
      var el = document.querySelector(selector);
      if (!el) {
        return false;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      return true;
    }

    function renderTourStep() {
      if (!tour) {
        return;
      }
      clearTourHighlight();

      var step = tourSteps[currentTourStep];
      if (!step) {
        closeTour();
        return;
      }

      var targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.setAttribute("data-tour-highlight", "true");
      }

      var popoverTitle = tour.querySelector("[data-tour-title]");
      var popoverDesc = tour.querySelector("[data-tour-description]");
      if (popoverTitle) {
        popoverTitle.textContent = step.title;
      }
      if (popoverDesc) {
        popoverDesc.innerHTML = '<p class="tour-description">' + step.description + "</p>";
      }

      var progress = tour.querySelector("[data-tour-progress]");
      if (progress) {
        progress.innerHTML = "";
        for (var pi = 0; pi < tourSteps.length; pi += 1) {
          var dot = document.createElement("span");
          dot.className = "tour-progress-dot";
          if (pi === currentTourStep) {
            dot.classList.add("active");
          }
          progress.appendChild(dot);
        }
      }

      scrollToTourTarget(step.target);

      var prevBtn = tour.querySelector("[data-tour-prev]");
      var nextBtn = tour.querySelector("[data-tour-next]");
      if (prevBtn) {
        prevBtn.disabled = currentTourStep === 0;
      }
      if (nextBtn) {
        nextBtn.textContent = currentTourStep === tourSteps.length - 1 ? "Finish" : "Next";
      }
    }

    var tourNextBtn = null;
    var tourPrevBtn = null;

    function bindTourNav() {
      if (!tour) {
        return;
      }
      tourNextBtn = tour.querySelector("[data-tour-next]");
      tourPrevBtn = tour.querySelector("[data-tour-prev]");

      if (tourPrevBtn) {
        tourPrevBtn.addEventListener("click", function () {
          if (currentTourStep > 0) {
            currentTourStep -= 1;
            renderTourStep();
          }
        });
      }

      if (tourNextBtn) {
        tourNextBtn.addEventListener("click", function () {
          currentTourStep += 1;
          if (currentTourStep >= tourSteps.length) {
            closeTour();
          } else {
            renderTourStep();
          }
        });
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      queueRun({ remember: true, scroll: true });
    });

    for (var m = 0; m < modeButtons.length; m += 1) {
      modeButtons[m].addEventListener("click", function (event) {
        setMode(event.currentTarget.getAttribute("data-mode"));
        run();
      });
    }

    for (var v = 0; v < viewButtons.length; v += 1) {
      viewButtons[v].addEventListener("click", function (event) {
        setDisplayMode(event.currentTarget.getAttribute("data-view-mode"));
        run();
      });
    }

    if (modeSelect) {
      initCustomSelect(modeSelect, function (val) {
        setMode(val);
        run();
      });
    }

    if (viewSelect) {
      initCustomSelect(viewSelect, function (val) {
        setDisplayMode(val);
        run();
      });
    }

    if (themeSelect) {
      initCustomSelect(themeSelect, function (val) {
        setTheme(val);
      });
    }

    if (results) {
      results.addEventListener("click", function (event) {
        var button = event.target.closest("[data-open-compound]");
        if (button) {
          openCompoundViewer(Number(button.getAttribute("data-open-compound")));
        }
      });
    }

    if (viewerClose) {
      viewerClose.addEventListener("click", closeCompoundViewer);
    }

    if (viewerFullscreen) {
      viewerFullscreen.addEventListener("click", function () {
        if (viewerPanel && viewerPanel.requestFullscreen) {
          viewerPanel.requestFullscreen().catch(function () {});
        }
      });
    }

    if (viewer) {
      viewer.addEventListener("click", function (event) {
        if (event.target === viewer) {
          closeCompoundViewer();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && viewer && !viewer.hidden) {
        closeCompoundViewer();
      }
      if (event.key === "Escape" && popup && !popup.hidden) {
        closeAnalysisPopup();
      }
      if (event.key === "Escape" && shareSheet && !shareSheet.hidden) {
        closeShareSheet();
      }
      if (event.key === "Escape" && installSheet && !installSheet.hidden) {
        closeInstallSheet();
      }
      if (event.key === "Escape" && recentList && !recentList.hidden) {
        recentList.hidden = true;
      }
      if (event.key === "Escape" && suggestionsDropdown && !suggestionsDropdown.hidden) {
        suggestionsDropdown.hidden = true;
      }
    });

    var surprisePool = [
      "isobutane", "C5H12", "C8H10", "C6H6", "C3H8",
      "C4H8", "C4H6", "C7H16", "C10H22",
      "C5H11Br", "C2H5OH", "C3H9N",
      "isopropyl bromide", "1-bromo-4-ethyl-6-methylnonane",
      "methanamine", "2-bromopropane", "propan-2-ol", "toluene",
      "hex-2-ene", "but-1-yne", "2-methylpentane",
      "C6H12", "CH4", "C2H4", "C2H2"
    ];

    var exampleButtons = document.querySelectorAll("[data-example]");
    for (var i = 0; i < exampleButtons.length; i += 1) {
      exampleButtons[i].addEventListener("click", function (event) {
        var val = event.currentTarget.getAttribute("data-example");
        if (val === "surprise") {
          val = surprisePool[Math.floor(Math.random() * surprisePool.length)];
        }
        input.value = val;
        setMode(event.currentTarget.getAttribute("data-example-mode") || "auto");
        queueRun({ remember: true, scroll: true });
        input.focus();
      });
    }

    // --- Examples carousel: deliberate, user-controlled scrolling ---
    var examplesTrack = document.querySelector("[data-examples-track]");
    var carouselNavPrev = document.querySelector("[data-examples-scroll='prev']");
    var carouselNavNext = document.querySelector("[data-examples-scroll='next']");
    var examplesStatus = document.querySelector("[data-examples-status]");
    var examplesProgress = document.querySelector("[data-examples-progress]");

    if (examplesTrack) {
      function updateCarouselNav() {
        if (!examplesTrack) {
          return;
        }
        var overflow = examplesTrack.scrollWidth > examplesTrack.clientWidth + 1;
        examplesTrack.setAttribute("data-overflow", overflow);
        if (carouselNavPrev) {
          carouselNavPrev.disabled = !overflow || examplesTrack.scrollLeft <= 8;
        }
        if (carouselNavNext) {
          carouselNavNext.disabled = !overflow || examplesTrack.scrollLeft >= examplesTrack.scrollWidth - examplesTrack.clientWidth - 8;
        }
        var cards = examplesTrack.querySelectorAll("[data-example]");
        if (examplesStatus && cards.length) {
          var trackBounds = examplesTrack.getBoundingClientRect();
          var firstVisible = 0;
          for (var i = 0; i < cards.length; i += 1) {
            if (cards[i].getBoundingClientRect().right > trackBounds.left + 4) {
              firstVisible = i;
              break;
            }
          }
          examplesStatus.textContent = String(firstVisible + 1).padStart(2, "0") + " / " + String(cards.length).padStart(2, "0");
        }
        if (examplesProgress) {
          var progress = examplesTrack.scrollWidth <= examplesTrack.clientWidth
            ? 100
            : (examplesTrack.scrollLeft + examplesTrack.clientWidth) / examplesTrack.scrollWidth * 100;
          examplesProgress.style.width = Math.min(100, progress) + "%";
        }
      }

      function scrollExamples(direction) {
        var firstCard = examplesTrack.querySelector("[data-example]");
        var gap = parseFloat(getComputedStyle(examplesTrack).columnGap) || 0;
        var step = firstCard ? firstCard.getBoundingClientRect().width + gap : examplesTrack.clientWidth * 0.75;
        examplesTrack.scrollBy({ left: direction * Math.max(step, examplesTrack.clientWidth * 0.65), behavior: "smooth" });
      }

      if (carouselNavPrev) {
        carouselNavPrev.addEventListener("click", function () { scrollExamples(-1); });
      }
      if (carouselNavNext) {
        carouselNavNext.addEventListener("click", function () { scrollExamples(1); });
      }
      examplesTrack.addEventListener("scroll", updateCarouselNav, { passive: true });
      window.addEventListener("resize", updateCarouselNav);
      updateCarouselNav();
    }

    // Copy name/formula button handler (event delegation)
    if (results) {
      results.addEventListener("click", function (event) {
        var copyBtn = event.target.closest("[data-copy-name]");
        if (!copyBtn) {
          copyBtn = event.target.closest("[data-copy-formula]");
        }
        if (!copyBtn) {
          return;
        }
        var textToCopy = copyBtn.getAttribute("data-copy-name") || copyBtn.getAttribute("data-copy-formula") || "";
        textToCopy = textToCopy.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, '"').replace(/&#39;/g, "'");
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy).then(function () {
            copyBtn.textContent = "Copied!";
            copyBtn.classList.add("copied");
            setTimeout(function () {
              copyBtn.classList.remove("copied");
              copyBtn.textContent = copyBtn.hasAttribute("data-copy-name") ? "Copy name" : "Copy formula";
            }, 1500);
          });
        } else {
          copyBtn.textContent = "Copied!";
          copyBtn.classList.add("copied");
          setTimeout(function () {
            copyBtn.classList.remove("copied");
            copyBtn.textContent = copyBtn.hasAttribute("data-copy-name") ? "Copy name" : "Copy formula";
          }, 1500);
        }
      });
    }

    if (recentList) {
      // Keep the field focused while the pointer is used inside the dropdown.
      recentList.addEventListener("mousedown", function (event) {
        if (event.target.closest("button")) {
          event.preventDefault();
        }
      });

      recentList.addEventListener("click", function (event) {
        if (event.target.closest("[data-recent-clear]")) {
          saveRecentInputs([]);
          renderRecentInputs();
          if (input) {
            input.focus();
          }
          return;
        }

        var remove = event.target.closest("[data-recent-remove]");
        if (remove) {
          forgetRecentInput(remove.getAttribute("data-recent-remove"));
          return;
        }

        var item = event.target.closest("[data-recent-value]");
        if (!item) {
          return;
        }
        input.value = item.getAttribute("data-recent-value");
        queueRun({ remember: true, scroll: true });
        input.focus();
      });
    }

    if (popupClose) {
      popupClose.addEventListener("click", closeAnalysisPopup);
    }

    if (popup) {
      popup.addEventListener("click", function (event) {
        if (event.target === popup) {
          closeAnalysisPopup();
        }
      });
    }

    if (popupHints) {
      popupHints.addEventListener("click", function (event) {
        var button = event.target.closest("[data-popup-example]");
        if (!button) {
          return;
        }
        input.value = button.getAttribute("data-popup-example");
        setMode("auto");
        closeAnalysisPopup();
        queueRun({ remember: true, scroll: true });
        input.focus();
      });
    }

    if (shareOpen) {
      shareOpen.addEventListener("click", openShareSheet);
    }

    if (shareClose) {
      shareClose.addEventListener("click", closeShareSheet);
    }

    if (shareSheet) {
      shareSheet.addEventListener("click", function (event) {
        if (event.target === shareSheet) {
          closeShareSheet();
        }
      });
    }

    if (shareCopy) {
      shareCopy.addEventListener("click", copyShareUrl);
    }

    if (nativeShare) {
      nativeShare.addEventListener("click", shareFromDevice);
    }

    if (installButton) {
      installButton.addEventListener("click", installApp);
    }

    if (installClose) {
      installClose.addEventListener("click", closeInstallSheet);
    }

    if (installSheet) {
      installSheet.addEventListener("click", function (event) {
        if (event.target === installSheet) {
          closeInstallSheet();
        }
      });
    }

     if (tourOpen) {
      tourOpen.addEventListener("click", openTour);
    }

    if (tourClose) {
      tourClose.addEventListener("click", closeTour);
    }

    if (tour) {
      tour.addEventListener("click", function (event) {
        if (!event.target.closest("[data-tour-popover]")) {
          closeTour();
        }
      });
    }

    bindTourNav();

    // --- Autocomplete suggestions ---
    var suggestionsDropdown = document.querySelector("[data-suggestions-dropdown]");
    var inputDebounceTimer = null;

    function showSuggestions() {
      if (!suggestionsDropdown || !input) return;
      var val = input.value.trim();
      if (val.length < 2) { suggestionsDropdown.hidden = true; return; }
      suggestionsDropdown.innerHTML = "";
      var hasSuggestions = false;

      // Formula-based suggestions: show all matching families for the entered formula
      if (isFormulaInput(val)) {
        var formulaMatches = suggestFormulaFamilies(val, selectedMode);
        if (formulaMatches.length) {
          for (var fi = 0; fi < formulaMatches.length; fi += 1) {
            var fbtn = document.createElement("button");
            fbtn.type = "button";
            fbtn.className = "suggestion-formula";
            fbtn.innerHTML = "<strong>" + escapeHtml(formulaMatches[fi].formula) + "</strong> &mdash; " + escapeHtml(formulaMatches[fi].label);
            fbtn.setAttribute("data-suggestion-value", formulaMatches[fi].formula);
            fbtn.setAttribute("data-suggestion-family", formulaMatches[fi].family);
            suggestionsDropdown.appendChild(fbtn);
            hasSuggestions = true;
          }
        }
      }

      // Name-based suggestions
      var matches = suggestNames(val, selectedMode, 6);
      for (var si = 0; si < matches.length; si += 1) {
        var btn = document.createElement("button");
        btn.type = "button";
        var highlighted = matches[si].substring(0, val.length);
        btn.innerHTML = "<strong>" + escapeHtml(highlighted) + "</strong>" + escapeHtml(matches[si].substring(val.length));
        btn.setAttribute("data-suggestion-value", matches[si]);
        suggestionsDropdown.appendChild(btn);
        hasSuggestions = true;
      }

      if (!hasSuggestions) { suggestionsDropdown.hidden = true; return; }
      suggestionsDropdown.hidden = false;
    }

    if (input) {
      input.addEventListener("focus", renderRecentInputs);
      input.addEventListener("blur", function () {
        if (recentList) {
          recentList.hidden = true;
        }
      });
      input.addEventListener("input", function () {
        renderRecentInputs();
        clearTimeout(inputDebounceTimer);
        inputDebounceTimer = setTimeout(function () {
          showSuggestions();
          // The suggestions state changed, so the history dropdown gets a
          // second chance to open (e.g. after clearing the field).
          renderRecentInputs();
        }, 180);
      });
    }

    if (suggestionsDropdown) {
      suggestionsDropdown.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-suggestion-value]");
        if (!btn) return;
        input.value = btn.getAttribute("data-suggestion-value");
        var familyAttr = btn.getAttribute("data-suggestion-family");
        if (familyAttr) {
          setMode(familyAttr);
        }
        suggestionsDropdown.hidden = true;
        queueRun({ remember: true, scroll: true });
        input.focus();
      });
    }

    // Hide suggestions and history on outside click. Targets detached by a
    // re-render (clear/remove) are ignored so the dropdown is not closed by
    // the very interaction that just refreshed it.
    document.addEventListener("click", function (e) {
      if (suggestionsDropdown && !suggestionsDropdown.contains(e.target) && e.target !== input) {
        suggestionsDropdown.hidden = true;
      }
      if (
        recentList &&
        e.target !== input &&
        (e.target.isConnected !== false) &&
        !recentList.contains(e.target)
      ) {
        recentList.hidden = true;
      }
    });

    // --- Auto-collapse settings after 2+ searches ---
    function autoCollapseSettings() {
      searchCount++;
      if (searchCount >= 2 && settingsDrawer) {
        settingsDrawer.open = false;
      }
    }

    setMode(selectedMode);
    setDisplayMode(displayMode);
    setTheme(selectedTheme);
    if (initialQuery && input) {
      input.value = initialQuery;
    }
    if (typeof matchMedia !== "undefined") {
      var darkPreference = matchMedia("(prefers-color-scheme: dark)");
      var updateSystemTheme = function () {
        if (selectedTheme === "auto") {
          setTheme("auto");
        }
      };
      if (darkPreference.addEventListener) {
        darkPreference.addEventListener("change", updateSystemTheme);
      } else if (darkPreference.addListener) {
        darkPreference.addListener(updateSystemTheme);
      }
    }
    if (settingsDrawer && typeof matchMedia !== "undefined" && matchMedia("(max-width: 760px)").matches) {
      settingsDrawer.open = false;
    }
    updateInstallButton();
    if (typeof window !== "undefined") {
      window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        updateInstallButton();
      });
      window.addEventListener("appinstalled", function () {
        deferredInstallPrompt = null;
        updateInstallButton();
      });
    }
    if (navigator && navigator.serviceWorker && typeof location !== "undefined" && location.protocol !== "file:") {
      navigator.serviceWorker.register("./service-worker.js").catch(function () {});
    }
    run({ silent: true });

    if (params.get("open") === "0") {
      openCompoundViewer(0);
    }

    var skipTour = typeof location !== "undefined" && new URLSearchParams(location.search).get("tour") === "off";
    try {
      if (!skipTour && !localStorage.getItem(tourStorageKey)) {
        openTour();
      }
    } catch (error) {
      if (!skipTour) {
        openTour();
      }
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", mount);
  }

    return {
    MAX_CARBONS: MAX_CARBONS,
    parseFormula: parseFormula,
    analyzeFormula: analyzeFormula,
    analyzeName: analyzeName,
    analyzeQuery: analyzeQuery,
    parseAcyclicHaloalkaneName: parseAcyclicHaloalkaneName,
    parseAcyclicIupacName: parseAcyclicIupacName,
    parseAromaticIupacName: parseAromaticIupacName,
    parseCarboxylicAcidName: parseCarboxylicAcidName,
    parseAldehydeName: parseAldehydeName,
    parseKetoneName: parseKetoneName,
    parseAmideName: parseAmideName,
    parseAmineName: parseAmineName,
    parseEtherName: parseEtherName,
    parseEsterName: parseEsterName,
    parseNitrileName: parseNitrileName,
    parseNitroName: parseNitroName,
    generateAlkaneIsomers: generateAlkaneIsomers,
    generateBicyclicIsomers: generateBicyclicIsomers,
    fusedAromaticIsomers: fusedAromaticIsomers,
    generateUnsaturatedAcyclicIsomers: generateUnsaturatedAcyclicByBondOrder,
    generateAromaticIsomers: generateAromaticIsomers,
    nameAlkane: nameAlkane,
    nameUnsaturatedAcyclic: nameUnsaturatedAcyclic,
    molecule3DMarkup: molecule3DMarkup,
    molecule3DModel: molecule3DModel,
    buildDiagramSvg: buildDiagramSvg
  };
});
