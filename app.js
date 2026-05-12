(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HydrocarbonApp = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_CARBONS = 12;
  var plantedCache = new Map();
  var rootCache = new Map();
  var aromaticCache = new Map();
  var nameIndexCache = null;

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
    aromatic: {
      label: "Aromatic",
      description: "Single benzene-ring alkyl aromatics. Positional isomers around the ring are counted.",
      pattern: "CnH2n-6"
    }
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

  function normalizeFormula(input) {
    return String(input || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/_/g, "")
      .replace(/[{}]/g, "")
      .replace(/\u2080/g, "0")
      .replace(/\u2081/g, "1")
      .replace(/\u2082/g, "2")
      .replace(/\u2083/g, "3")
      .replace(/\u2084/g, "4")
      .replace(/\u2085/g, "5")
      .replace(/\u2086/g, "6")
      .replace(/\u2087/g, "7")
      .replace(/\u2088/g, "8")
      .replace(/\u2089/g, "9");
  }

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

  function isFormulaInput(input) {
    var formula = normalizeFormula(input);
    return /^[CHch0-9]+$/.test(formula) && /[Cc]/.test(formula) && /[Hh]/.test(formula);
  }

  function formatFormula(carbon, hydrogen) {
    return "C" + (carbon === 1 ? "" : carbon) + "H" + (hydrogen === 1 ? "" : hydrogen);
  }

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

  function parseFormula(input) {
    var formula = normalizeFormula(input);
    if (!formula) {
      throw new Error("Enter a hydrocarbon formula, for example C5H12.");
    }

    var totals = { C: 0, H: 0 };
    var token = /([A-Za-z])(\d*)/g;
    var match;
    var cursor = 0;

    while ((match = token.exec(formula)) !== null) {
      if (match.index !== cursor) {
        throw new Error("Formula contains an unexpected character near \"" + formula.slice(cursor) + "\".");
      }

      var element = match[1].toUpperCase();
      if (element !== "C" && element !== "H") {
        throw new Error("Only carbon and hydrogen are supported in this app.");
      }

      var count = match[2] ? Number(match[2]) : 1;
      if (!Number.isInteger(count) || count < 1) {
        throw new Error("Element counts must be positive whole numbers.");
      }

      totals[element] += count;
      cursor = token.lastIndex;
    }

    if (cursor !== formula.length) {
      throw new Error("Formula contains an unexpected character near \"" + formula.slice(cursor) + "\".");
    }

    if (totals.C < 1 || totals.H < 1) {
      throw new Error("A hydrocarbon formula must include both carbon and hydrogen.");
    }

    return {
      carbon: totals.C,
      hydrogen: totals.H,
      formula: formatFormula(totals.C, totals.H)
    };
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

  function generateAlkaneIsomers(carbonCount) {
    if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
      throw new Error("Carbon count must be between 1 and " + MAX_CARBONS + ".");
    }

    var seen = new Map();
    var candidates = rootForms(carbonCount);
    for (var i = 0; i < candidates.length; i += 1) {
      var adjacency = parseRootedTree(candidates[i]);
      var isValid = adjacency.every(function (neighbors) {
        return neighbors.length <= 4;
      });
      if (!isValid) {
        continue;
      }

      var canonical = freeCanonical(adjacency);
      if (!seen.has(canonical)) {
        seen.set(canonical, { canonical: canonical, adjacency: adjacency });
      }
    }

    return Array.from(seen.values());
  }

  function rootedCanonicalWeighted(adjacency, node, parent, edgeOrders) {
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

  function canPlaceMultipleBond(adjacency, a, b, bondOrder) {
    var edgeOrders = new Map();
    edgeOrders.set(edgeKey(a, b), bondOrder);
    return weightedValence(adjacency, a, edgeOrders) <= 4 && weightedValence(adjacency, b, edgeOrders) <= 4;
  }

  function generateUnsaturatedAcyclicIsomers(carbonCount, bondOrder) {
    if (!Number.isInteger(carbonCount) || carbonCount < 2 || carbonCount > MAX_CARBONS) {
      throw new Error("Carbon count must be between 2 and " + MAX_CARBONS + ".");
    }

    var seen = new Map();
    var skeletons = generateAlkaneIsomers(carbonCount);
    for (var i = 0; i < skeletons.length; i += 1) {
      var adjacency = skeletons[i].adjacency;
      for (var atom = 0; atom < adjacency.length; atom += 1) {
        for (var j = 0; j < adjacency[atom].length; j += 1) {
          var neighbor = adjacency[atom][j];
          if (neighbor < atom || !canPlaceMultipleBond(adjacency, atom, neighbor, bondOrder)) {
            continue;
          }

          var edgeOrders = new Map();
          edgeOrders.set(edgeKey(atom, neighbor), bondOrder);
          var canonical = freeCanonicalWeighted(adjacency, edgeOrders);
          if (!seen.has(canonical)) {
            seen.set(canonical, {
              canonical: canonical,
              adjacency: adjacency,
              edgeOrders: edgeOrders,
              multipleBond: [atom, neighbor],
              bondOrder: bondOrder
            });
          }
        }
      }
    }

    return Array.from(seen.values());
  }

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

  function generateAromaticIsomers(carbonCount) {
    if (!Number.isInteger(carbonCount) || carbonCount < 6 || carbonCount > MAX_CARBONS) {
      throw new Error("Aromatic mode supports C6 through C" + MAX_CARBONS + ".");
    }

    if (aromaticCache.has(carbonCount)) {
      return aromaticCache.get(carbonCount);
    }

    var sideChainCarbons = carbonCount - 6;
    if (sideChainCarbons === 0) {
      var benzeneName = nameAromaticRing([null, null, null, null, null, null]);
      var benzene = [{
        canonical: "benzene",
        name: benzeneName.name,
        sequence: benzeneName.sequence,
        substituents: []
      }];
      aromaticCache.set(carbonCount, benzene);
      return benzene;
    }

    var options = aromaticAlkylOptions(sideChainCarbons);
    var seen = new Map();

    function walk(position, remaining, sequence) {
      if (position === 6) {
        if (remaining === 0) {
          var canonical = canonicalRingToken(sequence);
          if (!seen.has(canonical)) {
            var naming = nameAromaticRing(sequence);
            seen.set(canonical, {
              canonical: canonical,
              name: naming.name,
              sequence: naming.sequence,
              substituents: naming.substituents
            });
          }
        }
        return;
      }

      sequence.push(null);
      walk(position + 1, remaining, sequence);
      sequence.pop();

      for (var i = 0; i < options.length; i += 1) {
        if (options[i].size <= remaining) {
          sequence.push(options[i]);
          walk(position + 1, remaining - options[i].size, sequence);
          sequence.pop();
        }
      }
    }

    walk(0, sideChainCarbons, []);
    var result = Array.from(seen.values()).sort(function (a, b) {
      return compareStrings(a.name, b.name);
    });
    aromaticCache.set(carbonCount, result);
    return result;
  }

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

  function atomLabel(adjacency, atom, edgeOrders) {
    var hydrogens = 4 - weightedValence(adjacency, atom, edgeOrders);
    if (hydrogens <= 0) {
      return "C";
    }
    if (hydrogens === 1) {
      return "CH";
    }
    return "CH" + hydrogens;
  }

  function layoutBranch(adjacency, node, parent, coords, x, y, direction, depth) {
    coords.set(node, { x: x, y: y });
    var children = adjacency[node].filter(function (next) {
      return next !== parent;
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
        depth + 1
      );
    }
  }

  function layoutBondLineBranch(adjacency, node, parent, coords, x, y, direction, depth) {
    coords.set(node, { x: x, y: y });
    var children = adjacency[node].filter(function (next) {
      return next !== parent;
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
        depth + 1
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

  function buildDiagramSvg(adjacency, chain, edgeOrders, viewMode) {
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
            1
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
            1
          );
        }
      }
    }

    var values = Array.from(coords.values());
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

    var nodes = [];
    for (var atom = 0; atom < adjacency.length; atom += 1) {
      var point = coords.get(atom);
      if (isBondLine) {
        continue;
      } else {
        nodes.push(
          '<g><circle class="atom" cx="' + point.x + '" cy="' + point.y + '" r="22"></circle>' +
          '<text class="atom-label" x="' + point.x + '" y="' + point.y + '">' + atomLabel(adjacency, atom, edgeOrders) + "</text></g>"
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

  function buildAromaticDiagramSvg(isomer, viewMode) {
    var isBondLine = viewMode === "bondline";
    var center = { x: 170, y: 118 };
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
      '" viewBox="20 0 300 236">'
    ];

    for (var edge = 0; edge < 6; edge += 1) {
      parts.push(bondLineMarkup(ring[edge], ring[(edge + 1) % 6], 1));
    }
    parts.push('<circle class="aromatic-circle" cx="' + center.x + '" cy="' + center.y + '" r="31"></circle>');

    for (var atom = 0; atom < 6; atom += 1) {
      if (sequence[atom]) {
        parts.push(bondLineMarkup(ring[atom], substituentPoints[atom], 1));
        if (isBondLine) {
          parts.push(
            '<text class="bondline-substituent" x="' +
            substituentPoints[atom].x +
            '" y="' +
            substituentPoints[atom].y +
            '">' +
            sequence[atom].label +
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
            sequence[atom].label +
            "</text></g>"
          );
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

  function expectedHydrogenForFamily(carbon, family) {
    if (family === "alkane") {
      return carbon * 2 + 2;
    }
    if (family === "alkene") {
      return carbon * 2;
    }
    if (family === "alkyne") {
      return carbon * 2 - 2;
    }
    if (family === "aromatic") {
      return carbon * 2 - 6;
    }
    return null;
  }

  function familyMinimumCarbon(family) {
    if (family === "alkane") {
      return 1;
    }
    if (family === "alkene" || family === "alkyne") {
      return 2;
    }
    if (family === "aromatic") {
      return 6;
    }
    return 1;
  }

  function detectFamily(parsed) {
    if (parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "alkane")) {
      return "alkane";
    }
    if (parsed.carbon >= 2 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "alkene")) {
      return "alkene";
    }
    if (parsed.carbon >= 2 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "alkyne")) {
      return "alkyne";
    }
    if (parsed.carbon >= 6 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "aromatic")) {
      return "aromatic";
    }
    return null;
  }

  function unsupportedFormulaHints(parsed, family) {
    if (parsed.carbon > MAX_CARBONS) {
      return ["Use a supported IUPAC name for one structure", "Try C12H26 or smaller", "Keep Auto mode on"];
    }
    if (family && FAMILY_INFO[family]) {
      return ["Switch back to Auto", "Check the family formula " + FAMILY_INFO[family].pattern];
    }
    return ["Try Auto mode", "Try CnH2n+2 for alkanes", "Try a name like isobutane"];
  }

  function unsupportedFormula(parsed, dbe, family, message) {
    return {
      status: "unsupported",
      formula: parsed.formula,
      carbon: parsed.carbon,
      hydrogen: parsed.hydrogen,
      dbe: dbe,
      family: family,
      familyLabel: family && FAMILY_INFO[family] ? FAMILY_INFO[family].label : "Hydrocarbon",
      popupTitle: "I can read this formula, but cannot display it yet",
      hints: unsupportedFormulaHints(parsed, family),
      message: message
    };
  }

  function analyzeFormula(input, selectedFamily) {
    var parsed;
    try {
      parsed = parseFormula(input);
    } catch (error) {
      return { status: "error", message: error.message };
    }

    var maxHydrogen = parsed.carbon * 2 + 2;
    var dbeNumerator = maxHydrogen - parsed.hydrogen;

    if (dbeNumerator < 0) {
      return {
        status: "error",
        formula: parsed.formula,
        message: parsed.formula + " has more hydrogens than a valid open-chain hydrocarbon can hold."
      };
    }

    if (dbeNumerator % 2 !== 0) {
      return {
        status: "error",
        formula: parsed.formula,
        message: parsed.formula + " gives a half-integer unsaturation value, so it is not a valid neutral hydrocarbon formula."
      };
    }

    var dbe = dbeNumerator / 2;
    var family = selectedFamily && selectedFamily !== "auto" ? selectedFamily : detectFamily(parsed);

    if (!family || !FAMILY_INFO[family]) {
      return unsupportedFormula(
        parsed,
        dbe,
        null,
        parsed.formula +
          " does not match the built-in alkane, alkene, alkyne, or single-ring aromatic formulas."
      );
    }

    if (parsed.carbon < familyMinimumCarbon(family)) {
      return unsupportedFormula(
        parsed,
        dbe,
        family,
        FAMILY_INFO[family].label + " mode needs at least C" + familyMinimumCarbon(family) + "."
      );
    }

    if (parsed.hydrogen !== expectedHydrogenForFamily(parsed.carbon, family)) {
      return unsupportedFormula(
        parsed,
        dbe,
        family,
        parsed.formula + " does not match " + FAMILY_INFO[family].label.toLowerCase() + " formula " + FAMILY_INFO[family].pattern + "."
      );
    }

    if (parsed.carbon > MAX_CARBONS) {
      return unsupportedFormula(
        parsed,
        dbe,
        family,
        "This app currently enumerates each family up to C" +
          MAX_CARBONS +
          ". Larger formulas grow quickly and need a heavier cheminformatics backend."
      );
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
      isomers = generateUnsaturatedAcyclicIsomers(parsed.carbon, bondOrder).map(function (isomer) {
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
    }

    isomers.sort(function (a, b) {
      return compareStrings(a.name, b.name);
    });

    return {
      status: "ok",
      family: family,
      familyLabel: FAMILY_INFO[family].label,
      familyPattern: FAMILY_INFO[family].pattern,
      scope: FAMILY_INFO[family].description,
      formula: parsed.formula,
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

  function parseSubstituentPrefix(prefix, parentLength) {
    var text = normalizeName(prefix).replace(/-$/, "");
    var substituents = [];
    if (!text) {
      return substituents;
    }

    while (text.length) {
      var match = text.match(/^(\d+(?:,\d+)*)-(?:(di|tri|tetra|penta|hexa|hepta|octa|nona|deca)?(methyl|ethyl|propyl|butyl|pentyl|hexyl|heptyl|octyl|nonyl|decyl|undecyl|dodecyl))/);
      if (!match) {
        throw new Error("I can parse straight-chain alkyl branches such as 2-methyl or 4-ethyl, but this prefix is more complex.");
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

      for (var i = 0; i < locants.length; i += 1) {
        if (!Number.isInteger(locants[i]) || locants[i] < 1 || locants[i] > parentLength) {
          throw new Error("Substituent locants must be inside the parent chain.");
        }
        substituents.push({
          locant: locants[i],
          name: branchName,
          length: ALKYL_LENGTHS[branchName],
          sortKey: branchName
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
      buildLinearBranch(adjacency, substituents[i].locant - 1, substituents[i].length);
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
        sortKey: prefix
      }];
    } else {
      substituents = parseSubstituentPrefix(prefix, 6);
    }

    var occupied = new Set();
    var sequence = [null, null, null, null, null, null];
    var sideCarbons = 0;
    var sideHydrogens = 0;

    for (var i = 0; i < substituents.length; i += 1) {
      var sub = substituents[i];
      if (occupied.has(sub.locant)) {
        throw new Error("A benzene ring position cannot hold two alkyl substituents.");
      }
      occupied.add(sub.locant);
      sideCarbons += sub.length;
      sideHydrogens += sub.length * 2 + 1;
      sequence[sub.locant - 1] = {
        code: sub.name,
        size: sub.length,
        name: sub.name,
        sortKey: sub.sortKey,
        label: shortSubstituentLabel(sub.name)
      };
    }

    var carbon = 6 + sideCarbons;
    var hydrogen = 6 - substituents.length + sideHydrogens;

    return {
      status: "ok",
      family: "aromatic",
      familyLabel: FAMILY_INFO.aromatic.label,
      familyPattern: FAMILY_INFO.aromatic.pattern,
      scope:
        "Parsed as a single benzene-ring aromatic hydrocarbon with straight-chain alkyl substituents.",
      source: "parsed-name",
      queryName: original,
      matchedName: original,
      formula: formatFormula(carbon, hydrogen),
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
    var families = ["alkane", "alkene", "alkyne", "aromatic"];

    for (var f = 0; f < families.length; f += 1) {
      var family = families[f];
      for (var carbon = familyMinimumCarbon(family); carbon <= MAX_CARBONS; carbon += 1) {
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

  function suggestNames(input, selectedFamily) {
    var index = buildNameIndex();
    var loose = looseNameKey(input);
    var suggestions = [];
    var seen = new Set();

    for (var i = 0; i < index.entries.length && suggestions.length < 6; i += 1) {
      var entry = index.entries[i];
      if (selectedFamily && selectedFamily !== "auto" && entry.family !== selectedFamily) {
        continue;
      }
      var candidates = [entry.name].concat(entry.commonNames || []);
      for (var c = 0; c < candidates.length && suggestions.length < 6; c += 1) {
        var entryLoose = looseNameKey(candidates[c]);
        if ((entryLoose.indexOf(loose) !== -1 || loose.indexOf(entryLoose) !== -1) && !seen.has(candidates[c])) {
          suggestions.push(candidates[c]);
          seen.add(candidates[c]);
        }
      }
    }

    return suggestions;
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

      try {
        var parsed = parseAromaticIupacName(input) || parseAcyclicIupacName(input);
        if (parsed) {
          if (selectedFamily && selectedFamily !== "auto" && parsed.family !== selectedFamily) {
            return {
              status: "unsupported",
              formula: parsed.queryName,
              familyLabel: FAMILY_INFO[selectedFamily].label,
              message:
                parsed.queryName +
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
        return {
          status: "unsupported",
          formula: String(input || "").trim(),
          familyLabel: selectedFamily && selectedFamily !== "auto" && FAMILY_INFO[selectedFamily] ? FAMILY_INFO[selectedFamily].label : "Auto",
          popupTitle: "This name is close, but not displayable yet",
          hints: ["Try a supported IUPAC name", "Use Auto mode"],
          message: error.message
        };
      }

      var suggestions = suggestNames(input, selectedFamily);
      return {
        status: "unsupported",
        formula: String(input || "").trim(),
        familyLabel: selectedFamily && selectedFamily !== "auto" && FAMILY_INFO[selectedFamily] ? FAMILY_INFO[selectedFamily].label : "Auto",
        popupTitle: "I cannot draw that name yet",
        hints: suggestions.length ? suggestions : ["Try C5H12", "Try isobutane", "Try pent-2-ene"],
        message:
          "That name is not in the current supported hydrocarbon set. Try an IUPAC name such as pent-2-ene, ethylbenzene, or 2-methylpropane." +
          (suggestions.length ? " Close matches: " + suggestions.join(", ") + "." : "")
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

  function metric(label, value) {
    return '<div class="metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + "</strong></div>";
  }

  function renderIdleSummary(target) {
    if (!target) {
      return;
    }
    target.innerHTML =
      '<h2 class="status-title">Start with a formula or name</h2>' +
      '<p class="status-copy">Use Auto for most inputs. Common names like isobutane, neopentane, neooctane, toluene, and xylene aliases are understood.</p>' +
      '<div class="metric-grid">' +
      metric("Step 1", "Enter") +
      metric("Step 2", "Analyze") +
      metric("Step 3", "Inspect") +
      metric("Default view", "Atom labels") +
      "</div>";
  }

  function renderAnalyzingSummary(target, displayMode) {
    if (!target) {
      return;
    }
    target.innerHTML =
      '<h2 class="status-title">Analyzing structure</h2>' +
      '<p class="status-copy">Checking the formula or name, choosing the right hydrocarbon family, and preparing the structure cards.</p>' +
      '<div class="metric-grid">' +
      metric("Status", "Working") +
      metric("View", displayMode === "bondline" ? "Bond-line" : "Atom labels") +
      "</div>";
  }

  function renderSummary(target, analysis) {
    if (!target) {
      return;
    }

    if (analysis.status === "idle") {
      renderIdleSummary(target);
      return;
    }

    if (analysis.status === "error") {
      target.innerHTML =
        '<h2 class="status-title">Check the formula</h2>' +
        '<p class="status-copy">' +
        escapeHtml(analysis.message) +
        "</p>";
      return;
    }

    if (analysis.status === "unsupported") {
      var unsupportedMetrics =
        analysis.carbon !== undefined
          ? metric("Carbons", analysis.carbon) +
            metric("Hydrogens", analysis.hydrogen) +
            metric("DBE", analysis.dbe) +
            metric("Mode", analysis.familyLabel || "Auto")
          : metric("Mode", analysis.familyLabel || "Auto");
      target.innerHTML =
        '<h2 class="status-title">' +
        escapeHtml(analysis.formula) +
        "</h2>" +
        '<p class="status-copy">' +
        escapeHtml(analysis.message) +
        "</p>" +
        '<div class="metric-grid">' +
        unsupportedMetrics +
        "</div>";
      return;
    }

    target.innerHTML =
      '<h2 class="status-title">' +
      escapeHtml(analysis.formula) +
      "</h2>" +
      '<p class="status-copy">' +
      escapeHtml(analysis.scope) +
      "</p>" +
      '<div class="metric-grid">' +
      metric("Carbons", analysis.carbon) +
      metric("Hydrogens", analysis.hydrogen) +
      metric("DBE", analysis.dbe) +
      metric("Family", analysis.familyLabel) +
      metric("Formula", analysis.familyPattern) +
      metric(analysis.parsedOnly || analysis.nameOnly ? "Structure" : "Isomers", analysis.isomers.length) +
      (analysis.source === "name" || analysis.source === "parsed-name" ? metric("Input", analysis.matchedAlias ? analysis.matchedAlias : analysis.matchedName) : "") +
      "</div>" +
      (analysis.parsedOnly
        ? '<p class="notice">This structure was parsed directly from the name. Full isomer enumeration is still limited to formulas through C' +
          MAX_CARBONS +
          ".</p>"
        : analysis.nameOnly
        ? '<p class="notice">This name resolves to one structure. Enter ' +
          escapeHtml(analysis.formula) +
          " if you want the full formula isomer list.</p>"
        : '<p class="notice">The app counts constitutional isomers. Stereoisomers, conformers, and non-selected family alternatives with the same formula are not counted separately.</p>');
  }

  function renderIsomerDiagram(isomer, displayMode) {
    return isomer.family === "aromatic"
      ? buildAromaticDiagramSvg(isomer, displayMode)
      : buildDiagramSvg(isomer.adjacency, isomer.chain, isomer.edgeOrders, displayMode);
  }

  function renderResults(target, countLabel, analysis, titleTarget, displayMode) {
    if (!target) {
      return;
    }

    target.innerHTML = "";
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
          ? "Parsed IUPAC hydrocarbon structure"
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
    if (titleTarget && (analysis.parsedOnly || analysis.nameOnly)) {
      titleTarget.textContent = "Compound";
    }

    for (var i = 0; i < analysis.isomers.length; i += 1) {
      var isomer = analysis.isomers[i];
      var card = document.createElement("article");
      card.className = "isomer-card";
      card.style.setProperty("--card-index", String(i));
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

      var diagram = document.createElement("div");
      diagram.className = "diagram";
      diagram.innerHTML = renderIsomerDiagram(isomer, displayMode);

      card.appendChild(header);
      card.appendChild(diagram);
      target.appendChild(card);
    }
  }

  function mount() {
    var form = document.querySelector("[data-formula-form]");
    var input = document.querySelector("[data-formula-input]");
    var analyzeButton = form ? form.querySelector('button[type="submit"]') : null;
    var summary = document.querySelector("[data-summary]");
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
    var recentList = document.querySelector("[data-recent-list]");
    var recentPanel = document.querySelector("[data-recent-inputs]");
    var recentButtons = document.querySelector("[data-recent-buttons]");
    var params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
    var themeStorageKey = "hydrocarbon-theme";
    var selectedMode = params.get("family") || "auto";
    var displayMode = params.get("view") === "bondline" ? "bondline" : "atom";
    var selectedTheme = params.get("theme") || readStoredSetting(themeStorageKey, "light");
    var currentAnalysis = null;
    var tourStorageKey = "hydrocarbon-isomer-tour-seen";
    var recentStorageKey = "hydrocarbon-recent-inputs";
    var analyzeTimer = null;

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

    function setMode(mode) {
      selectedMode = mode || "auto";
      for (var i = 0; i < modeButtons.length; i += 1) {
        modeButtons[i].classList.toggle("active", modeButtons[i].getAttribute("data-mode") === selectedMode);
      }
      if (modeSelect) {
        modeSelect.value = selectedMode;
      }
    }

    function setDisplayMode(mode) {
      displayMode = mode || "atom";
      for (var i = 0; i < viewButtons.length; i += 1) {
        viewButtons[i].classList.toggle("active", viewButtons[i].getAttribute("data-view-mode") === displayMode);
      }
      if (viewSelect) {
        viewSelect.value = displayMode;
      }
    }

    function setTheme(theme) {
      selectedTheme = isValidChoice(theme || "light", ["light", "dark", "system"], "light");
      var useDark = selectedTheme === "dark" || (selectedTheme === "system" && systemPrefersDark());
      document.body.classList.toggle("theme-dark", useDark);
      document.body.classList.toggle("theme-light", !useDark);
      if (themeSelect) {
        themeSelect.value = selectedTheme;
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

    function renderRecentInputs() {
      var items = loadRecentInputs();
      if (recentList) {
        recentList.innerHTML = "";
        for (var i = 0; i < items.length; i += 1) {
          var option = document.createElement("option");
          option.value = items[i];
          recentList.appendChild(option);
        }
      }

      if (!recentPanel || !recentButtons) {
        return;
      }
      recentButtons.innerHTML = "";
      recentPanel.hidden = !items.length;
      for (var r = 0; r < items.length; r += 1) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = items[r];
        button.setAttribute("data-recent-value", items[r]);
        recentButtons.appendChild(button);
      }
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
      var hints = analysis.hints || ["Try C5H12", "Try isobutane", "Try pent-2-ene"];
      for (var i = 0; i < hints.length; i += 1) {
        var isAction = /^Try\s+/i.test(hints[i]);
        var hint = document.createElement(isAction ? "button" : "span");
        if (isAction) {
          hint.type = "button";
          hint.setAttribute("data-popup-example", hints[i].replace(/^Try\s+/i, ""));
        }
        hint.textContent = hints[i];
        popupHints.appendChild(hint);
      }
      popup.hidden = false;
    }

    function setAnalyzing(active) {
      document.body.classList.toggle("is-analyzing", active);
      if (analyzeButton) {
        analyzeButton.disabled = active;
        analyzeButton.textContent = active ? "Analyzing" : "Analyze";
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
      if (!input.value.trim()) {
        setAnalyzing(false);
        currentAnalysis = { status: "idle" };
        renderSummary(summary, currentAnalysis);
        renderResults(results, countLabel, currentAnalysis, resultsTitle, displayMode);
        return;
      }
      currentAnalysis = analyzeQuery(input.value, selectedMode);
      renderSummary(summary, currentAnalysis);
      renderResults(results, countLabel, currentAnalysis, resultsTitle, displayMode);
      setAnalyzing(false);
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
      setAnalyzing(true);
      renderAnalyzingSummary(summary, displayMode);
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
      viewerMeta.textContent = currentAnalysis.formula + " | " + currentAnalysis.familyLabel + " | " + (displayMode === "bondline" ? "Bond-line view" : "Atom-label view");
      viewerDiagram.innerHTML = renderIsomerDiagram(isomer, displayMode);
      viewer.hidden = false;
    }

    function closeCompoundViewer() {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      }
      if (viewer) {
        viewer.hidden = true;
      }
    }

    function openTour() {
      if (tour) {
        tour.hidden = false;
      }
    }

    function closeTour() {
      if (tour) {
        tour.hidden = true;
      }
      try {
        localStorage.setItem(tourStorageKey, "true");
      } catch (error) {
        // Storage can be unavailable in strict browser modes.
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
      modeSelect.addEventListener("change", function (event) {
        setMode(event.currentTarget.value);
        run();
      });
    }

    if (viewSelect) {
      viewSelect.addEventListener("change", function (event) {
        setDisplayMode(event.currentTarget.value);
        run();
      });
    }

    if (themeSelect) {
      themeSelect.addEventListener("change", function (event) {
        setTheme(event.currentTarget.value);
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
    });

    var exampleButtons = document.querySelectorAll("[data-example]");
    for (var i = 0; i < exampleButtons.length; i += 1) {
      exampleButtons[i].addEventListener("click", function (event) {
        input.value = event.currentTarget.getAttribute("data-example");
        setMode(event.currentTarget.getAttribute("data-example-mode") || "auto");
        queueRun({ remember: true, scroll: true });
        input.focus();
      });
    }

    if (recentButtons) {
      recentButtons.addEventListener("click", function (event) {
        var button = event.target.closest("[data-recent-value]");
        if (!button) {
          return;
        }
        input.value = button.getAttribute("data-recent-value");
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

    if (tourOpen) {
      tourOpen.addEventListener("click", openTour);
    }

    if (tourClose) {
      tourClose.addEventListener("click", closeTour);
    }

    if (tour) {
      tour.addEventListener("click", function (event) {
        if (event.target === tour) {
          closeTour();
        }
      });
    }

    setMode(selectedMode);
    setDisplayMode(displayMode);
    setTheme(selectedTheme);
    renderRecentInputs();
    if (typeof matchMedia !== "undefined") {
      var darkPreference = matchMedia("(prefers-color-scheme: dark)");
      var updateSystemTheme = function () {
        if (selectedTheme === "system") {
          setTheme("system");
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
    parseAcyclicIupacName: parseAcyclicIupacName,
    parseAromaticIupacName: parseAromaticIupacName,
    generateAlkaneIsomers: generateAlkaneIsomers,
    generateUnsaturatedAcyclicIsomers: generateUnsaturatedAcyclicIsomers,
    generateAromaticIsomers: generateAromaticIsomers,
    nameAlkane: nameAlkane,
    nameUnsaturatedAcyclic: nameUnsaturatedAcyclic,
    buildDiagramSvg: buildDiagramSvg
  };
});
