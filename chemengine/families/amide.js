/****************************************************************************
 * Primary amide family generator.
 *
 * Supported input domain:
 *   - Saturated monocarboxamides with one -CONH2 group.
 *   - Formula pattern: CnH2n+1NO with one nitrogen and one oxygen.
 *   - Carbon count must be at least 1 and at most MAX_CARBONS.
 *
 * Enumeration approach:
 *   - The carbonyl carbon is part of the carbon skeleton, so we enumerate all
 *     saturated alkane skeletons and make every terminal carbon (degree <= 1)
 *     the amide centre: it carries a double-bonded oxygen (2 bonds) and the
 *     amino nitrogen (1 bond), which exactly fills carbon's valence.
 *   - Name through the shared functional-group namer: the carbonyl carbon is
 *     always C1 of the parent chain (butanamide, ethanamide, methanamide, ...).
 *
 * Known limitations:
 *   - Only primary amides (-CONH2); N-substituted amides are not enumerated.
 *   - Only one amide group per molecule.
 *   - Only saturated acyclic carbon skeletons are used.
 *   - Stereochemistry is not enumerated.
 ******************************************************************************/

(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.amide = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var weightedValence = helpers.weightedValence;
    var derivativeCanonicalWithAttachments = helpers.derivativeCanonicalWithAttachments;
    var formulaFromDerivativeGraph = helpers.formulaFromDerivativeGraph;
    var cloneAdjacency = helpers.cloneAdjacency;
    var functionalGroupBest = helpers.functionalGroupBest;
    var compareStrings = helpers.compareStrings;

    return function generateAmideIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
        throw new Error("Amide carbon count must be between 1 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);

      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;

        for (var atom = 0; atom < adjacency.length; atom += 1) {
          // Amide carbon: one carbon neighbour at most (or none for
          // methanamide); =O (2) + -NH2 (1) + C (1) fills the valence.
          if (adjacency[atom].length > 1) continue;
          if (weightedValence(adjacency, atom, null) + 3 > 4) continue;

          var attachments = [
            {
              atom: atom,
              element: "O",
              label: "O",
              kind: "ketone",
              hydrogens: 0,
              bondOrder: 2
            },
            {
              atom: atom,
              element: "N",
              label: "NH\u2082",
              kind: "amine",
              hydrogens: 2,
              bondOrder: 1
            }
          ];

          var canonical = derivativeCanonicalWithAttachments(adjacency, attachments);
          if (seen.has(canonical)) continue;

          var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
          var naming = functionalGroupBest(adjacency, atom, "amide");
          if (!naming) continue;

          seen.set(canonical, {
            family: "amide",
            canonical: canonical,
            adjacency: cloneAdjacency(adjacency),
            edgeOrders: null,
            attachments: attachments,
            name: naming.name,
            commonNames: [],
            chain: naming.chain.slice(),
            substituents: naming.substituents,
            formula: formulaInfo.formula
          });
        }
      }

      var results = Array.from(seen.values());
      results.sort(function (a, b) {
        return compareStrings(a.name, b.name);
      });
      return results;
    };
  };
})(typeof self !== "undefined" ? self : this);
