/****************************************************************************
 * Ester family generator.
 *
 * Supported input domain:
 *   - Saturated monoesters with one -COOR group.
 *   - Formula pattern: CnH2nO2 with two oxygens.
 *   - Carbon count must be at least 2 and at most MAX_CARBONS.
 *
 * Enumeration approach:
 *   - An ester R-C(=O)-O-R' splits into an acid part (the carboxyl carbon
 *     plus the acyl alkyl group) and an alcohol part (the ester alkyl group).
 *   - Enumerate every ordered split of the carbon count, take all saturated
 *     skeletons for both parts, and bond them through a real oxygen node
 *     with a real terminal C=O double bond - the same explicit carbon +
 *     oxygen graph model the ether family uses.
 *   - Deduplicate with a colour-refinement canonical form of the combined
 *     graph (complete for trees, which these graphs always are).
 *   - Name as "alkyl alkanoate": the alcohol part becomes the radical
 *     (methyl, propan-2-yl, ...) and the acid part the carboxylate stem.
 *
 * Known limitations:
 *   - Only one ester group per molecule.
 *   - Only saturated acyclic skeletons are used.
 *   - Stereochemistry is not enumerated.
 ******************************************************************************/


(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.ester = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var weightedValence = helpers.weightedValence;
    var cloneAdjacency = helpers.cloneAdjacency;
    var nameAlkaneAtAnchor = helpers.nameAlkaneAtAnchor;
    var compareStrings = helpers.compareStrings;
    var etherCanonicalKey = helpers.etherCanonicalKey;
    var etherFormulaForGraph = helpers.etherFormulaForGraph;

    function edgeKey(a, b) {
      return a < b ? a + "-" + b : b + "-" + a;
    }

    // Combined graph: acid part (carboxyl carbon last-bonded), then the
    // carbonyl oxygen, the bridging oxygen, then the alcohol part. Every
    // atom is a real node so valence, formula, diagrams, and the 3D model
    // all work without special cases.
    function buildEsterGraph(acidSide, alcoholSide) {
      var adjacency = [];
      var elements = [];
      var i;

      for (i = 0; i < acidSide.adjacency.length; i += 1) {
        adjacency.push(acidSide.adjacency[i].slice());
        elements.push("C");
      }
      var carbonylIndex = acidSide.anchor;

      var oxygenTerminalIndex = adjacency.length;
      adjacency.push([]);
      elements.push("O");

      var oxygenBridgeIndex = adjacency.length;
      adjacency.push([]);
      elements.push("O");

      var offset = adjacency.length;
      for (i = 0; i < alcoholSide.adjacency.length; i += 1) {
        adjacency.push(alcoholSide.adjacency[i].map(function (neighbor) {
          return neighbor + offset;
        }));
        elements.push("C");
      }

      adjacency[carbonylIndex].push(oxygenTerminalIndex);
      adjacency[oxygenTerminalIndex].push(carbonylIndex);
      adjacency[carbonylIndex].push(oxygenBridgeIndex);
      adjacency[oxygenBridgeIndex].push(carbonylIndex);

      var alcoholAnchor = alcoholSide.anchor + offset;
      adjacency[oxygenBridgeIndex].push(alcoholAnchor);
      adjacency[alcoholAnchor].push(oxygenBridgeIndex);

      var edgeOrders = new Map();
      edgeOrders.set(edgeKey(carbonylIndex, oxygenTerminalIndex), 2);

      return {
        adjacency: adjacency,
        elements: elements,
        edgeOrders: edgeOrders,
        carbonylIndex: carbonylIndex,
        offset: offset
      };
    }

    function radicalName(naming) {
      if (naming.anchorLocant === 1) {
        return naming.name.replace(/ane$/, "yl");
      }
      return naming.name.replace(/ane$/, "an-" + naming.anchorLocant + "-yl");
    }

    // "methyl propanoate", "propan-2-yl ethanoate", "2-methylpropanoate"...
    function nameEster(acidSide, alcoholSide) {
      var acidNaming = nameAlkaneAtAnchor(acidSide.adjacency, acidSide.anchor);
      var alcoholNaming = nameAlkaneAtAnchor(alcoholSide.adjacency, alcoholSide.anchor);
      var acidName = acidNaming.name.replace(/e$/, "") + "oate";
      return {
        name: radicalName(alcoholNaming) + " " + acidName,
        chain: acidNaming.chain.slice(),
        substituents: acidNaming.substituents,
        acidNaming: acidNaming,
        alcoholNaming: alcoholNaming
      };
    }

    var skeletonCache = new Map();
    function skeletonsFor(count) {
      if (!skeletonCache.has(count)) {
        skeletonCache.set(count, generateAlkaneIsomers(count));
      }
      return skeletonCache.get(count);
    }

    function generateEsterIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 2 || carbonCount > MAX_CARBONS) {
        throw new Error("Ester carbon count must be between 2 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();

      for (var acidCarbons = 1; acidCarbons <= carbonCount - 1; acidCarbons += 1) {
        var alcoholCarbons = carbonCount - acidCarbons;
        var acidSkeletons = skeletonsFor(acidCarbons);
        var alcoholSkeletons = skeletonsFor(alcoholCarbons);

        for (var ai = 0; ai < acidSkeletons.length; ai += 1) {
          var acidAdjacency = acidSkeletons[ai].adjacency;
          for (var aa = 0; aa < acidAdjacency.length; aa += 1) {
            // The carboxyl carbon may hold one carbon neighbour at most.
            if (acidAdjacency[aa].length > 1) continue;
            if (weightedValence(acidAdjacency, aa, null) + 3 > 4) continue;
            var acidSide = { adjacency: acidAdjacency, anchor: aa };

            for (var oi = 0; oi < alcoholSkeletons.length; oi += 1) {
              var alcoholAdjacency = alcoholSkeletons[oi].adjacency;
              for (var oa = 0; oa < alcoholAdjacency.length; oa += 1) {
                if (alcoholAdjacency[oa].length >= 4) continue;
                var alcoholSide = { adjacency: alcoholAdjacency, anchor: oa };

                var built = buildEsterGraph(acidSide, alcoholSide);
                var key = etherCanonicalKey(built.adjacency, built.elements);
                if (seen.has(key)) continue;

                var naming = nameEster(acidSide, alcoholSide);
                seen.set(key, {
                  family: "ester",
                  canonical: key,
                  adjacency: built.adjacency,
                  edgeOrders: built.edgeOrders,
                  attachments: null,
                  elements: built.elements,
                  name: naming.name,
                  commonNames: [],
                  chain: naming.chain,
                  substituents: naming.substituents,
                  formula: etherFormulaForGraph(built.adjacency, built.elements, built.edgeOrders)
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

    // Exposed for parseEsterName in app.js so parsed names are rebuilt and
    // re-labelled through exactly the same code paths as generated isomers.
    generateEsterIsomers.buildEsterGraph = buildEsterGraph;
    generateEsterIsomers.nameEster = nameEster;

    return generateEsterIsomers;
  };
})(typeof self !== "undefined" ? self : this);
