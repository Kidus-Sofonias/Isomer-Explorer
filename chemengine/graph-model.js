(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.graphModel = function (halogens) {
    var SUPPORTED_ELEMENTS = { C: true, H: true, N: true, O: true, F: true, Cl: true, Br: true, I: true };
    var MAX_CARBON_VALENCE = 4;
    var MAX_OXYGEN_VALENCE = 2;
    var MAX_NITROGEN_VALENCE = 3;

    // A chemical graph is represented by:
    //   atoms: [{ element, label, id, hydrogens, charge }]
    //   bonds: [{ from, to, order, kind }]
    //
    // This model intentionally stays close to the engine's existing
    // adjacency/edgeOrders/attachments representation so the existing
    // families and UI can keep using their current data shape. The new
    // helpers here are used to validate and normalize that representation
    // and to make the engine's shared rules explicit and testable.

    function elementSupportsIsotope(element) {
      return SUPPORTED_ELEMENTS[element] && (element === "H" || element === "C" || element === "N" || element === "O" || element === "F" || element === "Cl" || element === "Br" || element === "I");
    }

    function makeAtom(element, id, options) {
      options = options || {};
      if (!SUPPORTED_ELEMENTS[element]) {
        throw new Error("Unsupported element: " + element);
      }
      var atom = {
        element: element,
        id: id != null ? String(id) : null,
        label: options.label != null ? String(options.label) : element,
        hydrogens: options.hydrogens != null ? options.hydrogens : null,
        charge: options.charge != null ? options.charge : null
      };
      if (atom.hydrogens !== null && !Number.isInteger(atom.hydrogens)) {
        throw new Error("Implicit hydrogen count must be an integer for " + element);
      }
      if (atom.hydrogens !== null && atom.hydrogens < 0) {
        throw new Error("Implicit hydrogen count cannot be negative for " + element);
      }
      if (atom.charge !== null && !Number.isInteger(atom.charge)) {
        throw new Error("Atom charge must be an integer for " + element);
      }
      return atom;
    }

    function makeBond(from, to, options) {
      options = options || {};
      if (from == null || to == null) {
        throw new Error("Bond endpoints must be provided");
      }
      if (from === to) {
        throw new Error("A bond cannot connect an atom to itself");
      }
      var bond = {
        from: from,
        to: to,
        order: options.order != null ? options.order : 1,
        kind: options.kind != null ? String(options.kind) : "single"
      };
      if (!Number.isInteger(bond.order) || bond.order < 1) {
        throw new Error("Bond order must be a positive integer");
      }
      if (bond.order > 3) {
        throw new Error("Bond order greater than 3 is not supported");
      }
      bond.kind = bond.kind.toLowerCase();
      if (bond.kind !== "single" && bond.kind !== "double" && bond.kind !== "triple" && bond.kind !== "aromatic" && bond.kind !== "coordinate") {
        throw new Error("Unsupported bond kind: " + options.kind);
      }
      if (bond.order > 1 && bond.kind === "coordinate") {
        throw new Error("Coordinate/dative bonds are represented as order 1 in this engine");
      }
      return bond;
    }

    function adjacencyFromAtomsBonds(atoms, bonds) {
      if (!Array.isArray(atoms)) {
        throw new Error("Atoms must be an array");
      }
      if (!Array.isArray(bonds)) {
        throw new Error("Bonds must be an array");
      }
      var adjacency = atoms.map(function () { return []; });
      var byId = new Map();
      atoms.forEach(function (atom, index) {
        if (atom.id != null) {
          if (byId.has(atom.id)) {
            throw new Error("Duplicate atom id: " + atom.id);
          }
          byId.set(atom.id, index);
        }
      });
      for (var i = 0; i < bonds.length; i += 1) {
        var bond = makeBond(bonds[i].from, bonds[i].to, bonds[i]);
        var fromIndex = bonds[i].from;
        var toIndex = bonds[i].to;
        if (typeof fromIndex !== "number" || !Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= atoms.length) {
          throw new Error("Bond from endpoint is out of range");
        }
        if (typeof toIndex !== "number" || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= atoms.length) {
          throw new Error("Bond to endpoint is out of range");
        }
        adjacency[fromIndex].push(toIndex);
        adjacency[toIndex].push(fromIndex);
      }
      return adjacency;
    }

    function indexOfAtomByElement(atoms, element) {
      for (var i = 0; i < atoms.length; i += 1) {
        if (atoms[i].element === element) {
          return i;
        }
      }
      return -1;
    }

    function inferHydrogensForAtom(atom, bonds, adjacency, atomIndex) {
      if (atom.hydrogens != null) {
        return atom.hydrogens;
      }
      if (atom.element === "H") {
        return 0;
      }
      if (!Number.isInteger(atomIndex) && atom.id != null && /^\d+$/.test(String(atom.id))) {
        atomIndex = Number(atom.id);
      }
      if (!Array.isArray(adjacency) || !Number.isInteger(atomIndex) ||
          atomIndex < 0 || atomIndex >= adjacency.length) {
        return null;
      }
      var allowed = allowedValenceFor(atom.element, atom.charge == null ? 0 : atom.charge);
      if (allowed == null) {
        return null;
      }
      var valence = 0;
      for (var i = 0; i < (bonds || []).length; i += 1) {
        var bond = bonds[i];
        if (bond.from === atomIndex || bond.to === atomIndex) {
          valence += bond.order == null ? 1 : bond.order;
        }
      }
      return Math.max(0, allowed - valence);
    }

    function byAtomIndex(atoms, id) {
      if (typeof id !== "number") {
        for (var i = 0; i < atoms.length; i += 1) {
          if (atoms[i].id === id || atoms[i].id == null && atoms[i].element === id) {
            return i;
          }
        }
        return -1;
      }
      return id;
    }

    function atomHydrogenCount(atom, bonds, adjacency, atomIndex) {
      return inferHydrogensForAtom(atom, bonds, adjacency, atomIndex);
    }

    function computeFormulaFromAtomsBonds(atoms, bonds, adjacency) {
      var elements = { C: 0, H: 0, N: 0, O: 0, F: 0, Cl: 0, Br: 0, I: 0 };
      for (var i = 0; i < atoms.length; i += 1) {
        var atom = atoms[i];
        elements[atom.element] = (elements[atom.element] || 0) + 1;
        var h = atomHydrogenCount(atom, bonds, adjacency, i);
        if (h != null) {
          elements.H += h;
        }
      }
      return elements;
    }

    function formatMolecularFormulaFromElements(elements) {
      var order = ["C", "H", "N", "Br", "Cl", "F", "I", "O"];
      var pieces = [];
      for (var i = 0; i < order.length; i += 1) {
        var element = order[i];
        var count = elements[element] || 0;
        if (count > 0) {
          pieces.push(element + (count === 1 ? "" : count));
        }
      }
      return pieces.join("");
    }

    function degreeOfUnsaturation(elements) {
      var c = elements.C || 0;
      var h = elements.H || 0;
      var n = elements.N || 0;
      var halogensTotal = (elements.F || 0) + (elements.Cl || 0) + (elements.Br || 0) + (elements.I || 0);
      var numerator = (2 * c + 2) - h - halogensTotal + n;
      if (numerator < 0 || numerator % 2 !== 0) {
        return null;
      }
      return numerator / 2;
    }

    function valenceOkForAtom(atom, bonds, adjacency, atomIndex) {
      if (!Number.isInteger(atomIndex) && atom.id != null && /^\d+$/.test(String(atom.id))) {
        atomIndex = Number(atom.id);
      }
      if (!Array.isArray(adjacency) || !Number.isInteger(atomIndex) ||
          atomIndex < 0 || atomIndex >= adjacency.length) {
        return false;
      }
      var allowed = allowedValenceFor(atom.element, atom.charge == null ? 0 : atom.charge);
      if (allowed == null) {
        return false;
      }
      var valence = 0;
      for (var i = 0; i < (bonds || []).length; i += 1) {
        var bond = bonds[i];
        if (bond.from === atomIndex || bond.to === atomIndex) {
          valence += bond.order == null ? 1 : bond.order;
        }
      }
      var hydrogens = atomHydrogenCount(atom, bonds, adjacency, atomIndex);
      return hydrogens != null && valence + hydrogens <= allowed;
    }

    function bondBetween(bonds, a, b) {
      for (var i = 0; i < (bonds || []).length; i += 1) {
        var bond = bonds[i];
        if ((bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)) {
          return bond;
        }
      }
      return null;
    }

    function graphIsConnected(atoms, adjacency) {
      if (!atoms.length) {
        return true;
      }
      var visited = new Set();
      var stack = [0];
      visited.add(0);
      while (stack.length) {
        var node = stack.pop();
        for (var i = 0; i < adjacency[node].length; i += 1) {
          var neighbor = adjacency[node][i];
          if (visited.has(neighbor)) {
            continue;
          }
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
      return visited.size === atoms.length;
    }

    function canonicalAtomSign(atom, bonds, adjacency, atoms) {
      var element = atom.element;
      var valence = 0;
      var index = atoms.indexOf(atom);
      if (index >= 0 && adjacency) {
        for (var i = 0; i < adjacency[index].length; i += 1) {
          var neighborIndex = adjacency[index][i];
          var bond = bondBetween(bonds, index, neighborIndex);
          valence += bond ? bond.order : 1;
        }
      }
      var h = atomHydrogenCount(atom, bonds, adjacency, index);
      var charge = atom.charge != null ? atom.charge : 0;
      return element + ":" + valence + ":" + h + ":" + charge;
    }

    // ---- Ring detection -----------------------------------------------------
    //
    // cycleCount uses the cyclomatic number (edges - vertices + connected
    // components), which is exact for every graph: bridges, fused rings, and
    // spiro centres all count their independent cycles. atomsInRings prunes
    // degree-0/1 vertices iteratively, so only vertices lying on or inside
    // cycles survive; a tree prunes down to an empty set.

    function cycleCount(adjacency) {
      if (!Array.isArray(adjacency) || !adjacency.length) {
        return 0;
      }
      var vertices = adjacency.length;
      var edgeCount = 0;
      for (var i = 0; i < vertices; i += 1) {
        edgeCount += adjacency[i].length;
      }
      edgeCount /= 2;

      var components = 0;
      var visited = new Array(vertices);
      for (var start = 0; start < vertices; start += 1) {
        if (visited[start]) continue;
        components += 1;
        visited[start] = true;
        var stack = [start];
        while (stack.length) {
          var node = stack.pop();
          var neighbors = adjacency[node];
          for (var n = 0; n < neighbors.length; n += 1) {
            if (!visited[neighbors[n]]) {
              visited[neighbors[n]] = true;
              stack.push(neighbors[n]);
            }
          }
        }
      }
      return edgeCount - vertices + components;
    }

    function hasRing(adjacency) {
      return cycleCount(adjacency) > 0;
    }

    function atomsInRings(adjacency) {
      if (!Array.isArray(adjacency) || !adjacency.length) {
        return [];
      }
      var inRing = adjacency.map(function () { return true; });
      var degree = adjacency.map(function (neighbors) { return neighbors.length; });
      var queue = [];
      for (var i = 0; i < adjacency.length; i += 1) {
        if (degree[i] <= 1) queue.push(i);
      }
      while (queue.length) {
        var node = queue.pop();
        if (!inRing[node]) continue;
        inRing[node] = false;
        var neighbors = adjacency[node];
        for (var n = 0; n < neighbors.length; n += 1) {
          var neighbor = neighbors[n];
          if (!inRing[neighbor]) continue;
          degree[neighbor] -= 1;
          if (degree[neighbor] <= 1) queue.push(neighbor);
        }
      }
      return inRing;
    }

    // ---- Whole-molecule validation ------------------------------------------
    //
    // validateMolecule is the engine's structural-correctness gate for an
    // explicit atoms+bonds model. It checks that every bond endpoint exists,
    // that no bond loops or duplicates another, that the graph is fully
    // connected, that every atom obeys its element's valence ceiling
    // (charge-adjusted), and — when an expectation is given — that the
    // element counts implied by the structure match the expected formula.
    // It returns { ok, problems[], formula, rings, ringAtoms } and never a
    // "best effort" pass: anything questionable lists itself in problems.

    function allowedValenceFor(element, charge) {
      if (charge === 0) {
        return element === "C" ? MAX_CARBON_VALENCE
          : element === "O" ? MAX_OXYGEN_VALENCE
          : element === "N" ? MAX_NITROGEN_VALENCE
          : element === "H" || element === "F" || element === "Cl" || element === "Br" || element === "I" ? 1
          : null;
      }
      if (charge === 1) {
        if (element === "C") return 3;
        if (element === "N") return 4;
        if (element === "O") return 3;
        return null;
      }
      if (charge === -1) {
        if (element === "C") return 3;
        if (element === "N") return 2;
        if (element === "O") return 1;
        return null;
      }
      return null;
    }

    function edgePairKey(a, b) {
      return a < b ? a + "-" + b : b + "-" + a;
    }

    function validateMolecule(atoms, bonds, expectations) {
      expectations = expectations || {};
      if (!Array.isArray(atoms) || !atoms.length) {
        return { ok: false, problems: ["A molecule needs at least one atom"] };
      }
      if (!Array.isArray(bonds)) {
        return { ok: false, problems: ["Bonds must be an array"] };
      }

      var problems = [];
      var seenEdges = new Map();
      var i;
      var seenAtomIds = new Set();
      for (i = 0; i < atoms.length; i += 1) {
        var currentAtom = atoms[i];
        if (!currentAtom || !SUPPORTED_ELEMENTS[currentAtom.element]) {
          problems.push("Atom " + i + " has unsupported element " + (currentAtom && currentAtom.element));
          continue;
        }
        if (currentAtom.id != null) {
          var atomId = String(currentAtom.id);
          if (seenAtomIds.has(atomId)) {
            problems.push("Duplicate atom id: " + atomId);
          }
          seenAtomIds.add(atomId);
        }
        if (currentAtom.hydrogens != null &&
            (!Number.isInteger(currentAtom.hydrogens) || currentAtom.hydrogens < 0)) {
          problems.push("Atom " + i + " has an invalid implicit hydrogen count");
        }
        if (currentAtom.charge != null && !Number.isInteger(currentAtom.charge)) {
          problems.push("Atom " + i + " has an invalid formal charge");
        }
      }
      if (problems.length) {
        return { ok: false, problems: problems };
      }
      for (i = 0; i < bonds.length; i += 1) {
        var from = bonds[i].from;
        var to = bonds[i].to;
        if (!Number.isInteger(from) || from < 0 || from >= atoms.length) {
          problems.push("Bond " + i + " has an out-of-range 'from' endpoint");
          continue;
        }
        if (!Number.isInteger(to) || to < 0 || to >= atoms.length) {
          problems.push("Bond " + i + " has an out-of-range 'to' endpoint");
          continue;
        }
        if (from === to) {
          problems.push("Bond " + i + " connects atom " + from + " to itself");
          continue;
        }
        try {
          makeBond(from, to, bonds[i]);
        } catch (error) {
          problems.push("Bond " + i + ": " + error.message);
          continue;
        }
        var key = edgePairKey(from, to);
        if (seenEdges.has(key)) {
          problems.push("Duplicate bond between atoms " + from + " and " + to);
        }
        seenEdges.set(key, true);
      }

      if (problems.length) {
        return { ok: false, problems: problems };
      }

      var adjacency = adjacencyFromAtomsBonds(atoms, bonds);
      if (!graphIsConnected(atoms, adjacency)) {
        problems.push("The molecule graph is not fully connected");
      }

      var valences = atoms.map(function () { return 0; });
      for (i = 0; i < bonds.length; i += 1) {
        valences[bonds[i].from] += bonds[i].order || 1;
        valences[bonds[i].to] += bonds[i].order || 1;
      }
      for (i = 0; i < atoms.length; i += 1) {
        var atom = atoms[i];
        var allowed = allowedValenceFor(atom.element, atom.charge != null ? atom.charge : 0);
        if (allowed == null) {
          problems.push("Atom " + i + " (" + atom.element + ") has an unsupported formal charge");
          continue;
        }
        var implicitHydrogens = atomHydrogenCount(atom, bonds, adjacency, i);
        if (implicitHydrogens == null) {
          problems.push("Atom " + i + " (" + atom.element + ") has an unknown implicit hydrogen count");
        } else if (valences[i] + implicitHydrogens > allowed) {
          problems.push("Atom " + i + " (" + atom.element + ") has valence " +
            (valences[i] + implicitHydrogens) + " above its allowed maximum " + allowed);
        }
      }

      if (problems.length) {
        return { ok: false, problems: problems };
      }

      var elements = computeFormulaFromAtomsBonds(atoms, bonds, adjacency);
      if (expectations.formula) {
        var observed = formatMolecularFormulaFromElements(elements);
        if (observed !== expectations.formula) {
          problems.push("Structure implies " + observed + " but the query is " + expectations.formula);
        }
      } else if (expectations.elements) {
        for (var element in expectations.elements) {
          if (Object.prototype.hasOwnProperty.call(expectations.elements, element) &&
              (elements[element] || 0) !== (expectations.elements[element] || 0)) {
            problems.push("Structure implies " + (elements[element] || 0) + " " + element + " atoms but " + (expectations.elements[element] || 0) + " were expected");
          }
        }
      }

      return {
        ok: problems.length === 0,
        problems: problems,
        formula: formatMolecularFormulaFromElements(elements),
        rings: cycleCount(adjacency),
        ringAtoms: atomsInRings(adjacency)
      };
    }

    function canonicalAtomSignature(atoms, bonds, adjacency) {
      var signs = [];
      for (var i = 0; i < atoms.length; i += 1) {
        signs.push(canonicalAtomSign(atoms[i], bonds, adjacency, atoms));
      }
      signs.sort();
      return signs.join("|");
    }

    return {
      SUPPORTED_ELEMENTS: SUPPORTED_ELEMENTS,
      elementSupportsIsotope: elementSupportsIsotope,
      makeAtom: makeAtom,
      makeBond: makeBond,
      adjacencyFromAtomsBonds: adjacencyFromAtomsBonds,
      indexOfAtomByElement: indexOfAtomByElement,
      inferHydrogensForAtom: inferHydrogensForAtom,
      atomHydrogenCount: atomHydrogenCount,
      computeFormulaFromAtomsBonds: computeFormulaFromAtomsBonds,
      formatMolecularFormulaFromElements: formatMolecularFormulaFromElements,
      degreeOfUnsaturation: degreeOfUnsaturation,
      valenceOkForAtom: valenceOkForAtom,
      bondBetween: bondBetween,
      graphIsConnected: graphIsConnected,
      canonicalAtomSignature: canonicalAtomSignature,
      cycleCount: cycleCount,
      hasRing: hasRing,
      atomsInRings: atomsInRings,
      allowedValenceFor: allowedValenceFor,
      validateMolecule: validateMolecule
    };
  };
})(typeof self !== "undefined" ? self : this);
