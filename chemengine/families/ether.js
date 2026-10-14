/****************************************************************************
 * Ether family generator.
 *
 * Supported input domain:
 *   - Saturated acyclic monoethers with exactly one C-O-C bridge.
 *   - Formula pattern: CnH2n+2O with exactly one oxygen.
 *   - Carbon count must be at least 2 and at most MAX_CARBONS.
 *
 * Enumeration approach:
 *   - Every acyclic ether splits at its oxygen into two alkyl fragments.
 *   - Enumerate every ordered split of the carbon count, take all alkane
 *     skeletons for both sides, and attach the oxygen to every carbon that can
 *     accept a fourth bond.
 *   - Deduplicate with a colour-refinement canonical form of the combined
 *     carbon+oxygen graph (complete for trees, which these graphs always are).
 *   - Name each structure as an alkoxyalkane: the larger alkyl group is the
 *     parent; ties go to the side whose C-O bond gets the lower locant.
 *
 * Known limitations:
 *   - Only one oxygen; no rings, no multiple bonds, no stereochemistry.
 *   - Common ("diethyl ether") and systematic ("1-methoxypropane") names are
 *     parsed in app.js through the helpers exposed on the returned function.
 ******************************************************************************/

(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.ether = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var formatMolecularFormula = helpers.formatMolecularFormula;
    var compareStrings = helpers.compareStrings;
    var nameAlkaneAtAnchor = helpers.nameAlkaneAtAnchor;

    function linearFragment(size) {
      var adjacency = [];
      for (var atom = 0; atom < size; atom += 1) {
        adjacency.push([]);
        if (atom > 0) {
          adjacency[atom - 1].push(atom);
          adjacency[atom].push(atom - 1);
        }
      }
      return adjacency;
    }

    function fragment(adjacency, anchor) {
      return { adjacency: adjacency, anchor: anchor };
    }

    // ------------------------------------------------------------------
    // Common alkyl group vocabulary used by the ".... ether" name parser.
    // ------------------------------------------------------------------
    var ALKYL_FRAGMENTS = {
      methyl: function () { return fragment(linearFragment(1), 0); },
      ethyl: function () { return fragment(linearFragment(2), 0); },
      propyl: function () { return fragment(linearFragment(3), 0); },
      "n-propyl": function () { return fragment(linearFragment(3), 0); },
      isopropyl: function () { return fragment([[1, 2], [0], [0]], 0); },
      butyl: function () { return fragment(linearFragment(4), 0); },
      "n-butyl": function () { return fragment(linearFragment(4), 0); },
      "sec-butyl": function () { return fragment([[1], [0, 2], [1, 3], [2]], 1); },
      isobutyl: function () { return fragment([[1], [0, 2, 3], [1], [1]], 0); },
      "tert-butyl": function () { return fragment([[1, 2, 3], [0], [0], [0]], 0); },
      "t-butyl": function () { return fragment([[1, 2, 3], [0], [0], [0]], 0); },
      "i-butyl": function () { return fragment([[1], [0, 2, 3], [1], [1]], 0); },
      "i-propyl": function () { return fragment([[1, 2], [0], [0]], 0); },
      pentyl: function () { return fragment(linearFragment(5), 0); },
      "n-pentyl": function () { return fragment(linearFragment(5), 0); },
      isopentyl: function () { return fragment([[1], [0, 2], [1, 3, 4], [2], [2]], 0); },
      neopentyl: function () { return fragment([[1], [0, 2, 3, 4], [1], [1], [1]], 0); }
    };

    function alkylFragment(token) {
      var build = ALKYL_FRAGMENTS[String(token || "").toLowerCase()];
      if (!build) {
        return null;
      }
      var built = build();
      return fragment(built.adjacency.map(function (neighbors) { return neighbors.slice(); }), built.anchor);
    }

    // ------------------------------------------------------------------
    // Combined graph: sideA, sideB, then the bridging oxygen as the last
    // node. The oxygen is a real atom in the adjacency so valence and
    // hydrogen counts work out without special cases.
    // ------------------------------------------------------------------
    function buildGraph(sideA, sideB) {
      var adjacency = [];
      var elements = [];
      var i;
      for (i = 0; i < sideA.adjacency.length; i += 1) {
        adjacency.push(sideA.adjacency[i].slice());
        elements.push("C");
      }
      var offsetB = sideA.adjacency.length;
      for (i = 0; i < sideB.adjacency.length; i += 1) {
        adjacency.push(sideB.adjacency[i].map(function (neighbor) { return neighbor + offsetB; }));
        elements.push("C");
      }
      var oxygenIndex = adjacency.length;
      adjacency.push([]);
      elements.push("O");

      var anchorA = sideA.anchor;
      var anchorB = sideB.anchor + offsetB;
      adjacency[anchorA].push(oxygenIndex);
      adjacency[anchorB].push(oxygenIndex);
      adjacency[oxygenIndex].push(anchorA);
      adjacency[oxygenIndex].push(anchorB);

      return {
        adjacency: adjacency,
        elements: elements,
        oxygenIndex: oxygenIndex,
        offsetB: offsetB
      };
    }

    // Colour refinement canonical form. One round of neighbour sorting per
    // atom, repeated over the graph diameter, is a complete isomorphism
    // invariant for trees - and an ether graph is always a tree. Colour
    // strings are interned to dense ids from one shared map so the keys stay
    // short: raw strings would grow exponentially with the graph diameter.
    var colorIntern = new Map();
    var nextColorId = 0;
    function internColor(str) {
      var existing = colorIntern.get(str);
      if (existing !== undefined) return existing;
      colorIntern.set(str, nextColorId);
      return nextColorId++;
    }

    function canonicalKey(adjacency, elements) {
      var nodeCount = adjacency.length;
      var colors = elements.map(internColor);
      for (var round = 0; round < nodeCount; round += 1) {
        var next = [];
        for (var node = 0; node < nodeCount; node += 1) {
          var neighborColors = adjacency[node].map(function (neighbor) {
            return colors[neighbor];
          });
          neighborColors.sort(function (a, b) { return a - b; });
          next.push(internColor(colors[node] + "(" + neighborColors.join(",") + ")"));
        }
        colors = next;
      }
      return colors.slice().sort(function (a, b) { return a - b; }).join(";");
    }

    // `edgeOrders` is optional: the ether graph has no double bonds, but the
    // ester generator reuses this helper for graphs containing a C=O, where a
    // carbon's hydrogen count must subtract the doubled bond order.
    function formulaForGraph(adjacency, elements, edgeOrders) {
      var counts = { C: 0, H: 0, O: 0, F: 0, Cl: 0, Br: 0, I: 0, N: 0 };
      for (var node = 0; node < adjacency.length; node += 1) {
        if (elements[node] === "C") {
          counts.C += 1;
          var valence = 0;
          for (var neighbor = 0; neighbor < adjacency[node].length; neighbor += 1) {
            var other = adjacency[node][neighbor];
            var order = 1;
            if (edgeOrders) {
              var key = node < other ? node + "-" + other : other + "-" + node;
              order = edgeOrders.get(key) || 1;
            }
            valence += order;
          }
          counts.H += 4 - valence;
        } else if (elements[node] === "O") {
          counts.O += 1;
        }
      }
      return formatMolecularFormula(counts);
    }

    // ------------------------------------------------------------------
    // Naming: alkoxyalkane.
    // ------------------------------------------------------------------
    function alkoxyName(naming) {
      if (naming.anchorLocant === 1) {
        return naming.name.replace(/ane$/, "") + "oxy";
      }
      return naming.name.replace(/ane$/, "an-" + naming.anchorLocant + "-yl") + "oxy";
    }

    function nameSides(sideA, sideB) {
      var namingA = nameAlkaneAtAnchor(sideA.adjacency, sideA.anchor);
      var namingB = nameAlkaneAtAnchor(sideB.adjacency, sideB.anchor);
      var carbonsA = sideA.adjacency.length;
      var carbonsB = sideB.adjacency.length;

      var parentIsA;
      if (carbonsA !== carbonsB) {
        parentIsA = carbonsA > carbonsB;
      } else if (namingA.anchorLocant !== namingB.anchorLocant) {
        parentIsA = namingA.anchorLocant < namingB.anchorLocant;
      } else {
        parentIsA = compareStrings(namingA.name, namingB.name) <= 0;
      }

      var parentNaming = parentIsA ? namingA : namingB;
      var childNaming = parentIsA ? namingB : namingA;
      var parentCarbons = parentIsA ? carbonsA : carbonsB;
      var oLocant = parentNaming.anchorLocant;

      // Small, symmetric ethers keep the traditional short names
      // ("methoxymethane", "ethoxyethane"); longer parents carry the 1-locant.
      var showLocant = !(oLocant === 1 && parentCarbons <= 2);

      var alkoxy = alkoxyName(childNaming);
      if (/\d/.test(alkoxy)) {
        alkoxy = "(" + alkoxy + ")";
      }
      var head = (showLocant ? oLocant + "-" : "") + alkoxy;
      if (/^\d/.test(parentNaming.name)) {
        // "2-methoxy-2-methylpropane" and "(2-methylpropoxy)-2-methylpropane"
        // need the hyphen; "(propan-2-yloxy)propane" does not.
        head += "-";
      }

      var offsetB = sideA.adjacency.length;
      var chain = parentIsA
        ? parentNaming.chain.slice()
        : parentNaming.chain.map(function (index) { return index + offsetB; });

      return {
        name: head + parentNaming.name,
        parentIsA: parentIsA,
        parentNaming: parentNaming,
        childNaming: childNaming,
        oLocant: oLocant,
        chain: chain,
        substituents: parentNaming.substituents
      };
    }

    // ------------------------------------------------------------------
    // Enumeration.
    // ------------------------------------------------------------------
    var skeletonCache = new Map();
    function skeletonsFor(count) {
      if (!skeletonCache.has(count)) {
        skeletonCache.set(count, generateAlkaneIsomers(count));
      }
      return skeletonCache.get(count);
    }

    function generateEtherIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 2 || carbonCount > MAX_CARBONS) {
        throw new Error("Ether carbon count must be between 2 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();

      for (var leftCount = 1; leftCount <= carbonCount - 1; leftCount += 1) {
        var rightCount = carbonCount - leftCount;
        var leftSkeletons = skeletonsFor(leftCount);
        var rightSkeletons = skeletonsFor(rightCount);

        for (var li = 0; li < leftSkeletons.length; li += 1) {
          var leftAdjacency = leftSkeletons[li].adjacency;
          for (var la = 0; la < leftAdjacency.length; la += 1) {
            if (leftAdjacency[la].length >= 4) continue;
            var leftSide = fragment(leftAdjacency, la);

            for (var ri = 0; ri < rightSkeletons.length; ri += 1) {
              var rightAdjacency = rightSkeletons[ri].adjacency;
              for (var ra = 0; ra < rightAdjacency.length; ra += 1) {
                if (rightAdjacency[ra].length >= 4) continue;
                var rightSide = fragment(rightAdjacency, ra);

                var built = buildGraph(leftSide, rightSide);
                var key = canonicalKey(built.adjacency, built.elements);
                if (seen.has(key)) continue;

                var naming = nameSides(leftSide, rightSide);
                seen.set(key, {
                  family: "ether",
                  canonical: key,
                  adjacency: built.adjacency,
                  edgeOrders: null,
                  attachments: null,
                  elements: built.elements,
                  name: naming.name,
                  commonNames: [],
                  chain: naming.chain,
                  substituents: naming.substituents,
                  formula: formulaForGraph(built.adjacency, built.elements)
                });
              }
            }
          }
        }
      }

      var results = Array.from(seen.values());
      results.sort(function (a, b) {
        return compareStrings(a.name, b.name);
      });
      return results;
    }

    // Exposed for parseEtherName in app.js so names are parsed, rebuilt and
    // re-labelled through exactly the same code paths as generated isomers.
    generateEtherIsomers.buildGraph = buildGraph;
    generateEtherIsomers.nameSides = nameSides;
    generateEtherIsomers.canonicalKey = canonicalKey;
    generateEtherIsomers.alkylFragment = alkylFragment;
    generateEtherIsomers.formulaForGraph = formulaForGraph;

    return generateEtherIsomers;
  };
})(typeof self !== "undefined" ? self : this);
