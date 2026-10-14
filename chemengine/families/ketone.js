/****************************************************************************
 * Ketone family generator.
 *
 * Supported input domain:
 *   - Saturated monoketones with one C=O group inside a chain.
 *   - Formula pattern: CnH2nO with one oxygen.
 *   - Carbon count must be at least 3 and at most MAX_CARBONS.
 *
 * Enumeration approach:
 *   - Enumerate all saturated alkane skeletons for the given carbon count and
 *     place a double-bonded oxygen on every carbon with exactly two carbon
 *     neighbours (a ketone carbonyl is always internal: two carbons plus the
 *     double bond fill carbon's valence with no hydrogens left).
 *   - Deduplicate with a symmetry-aware canonical form of skeleton plus
 *     attachment position.
 *   - Name through the shared functional-group namer (butan-2-one,
 *     pentan-3-one, 3-methylbutan-2-one, ...): the principal chain contains
 *     the carbonyl and takes the lowest possible locant.
 *
 * Known limitations:
 *   - Only one carbonyl per molecule.
 *   - Only saturated acyclic carbon skeletons are used.
 *   - Stereochemistry is not enumerated.
 ******************************************************************************/

(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.ketone = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var weightedValence = helpers.weightedValence;
    var derivativeCanonicalWithAttachments = helpers.derivativeCanonicalWithAttachments;
    var formulaFromDerivativeGraph = helpers.formulaFromDerivativeGraph;
    var cloneAdjacency = helpers.cloneAdjacency;
    var functionalGroupBest = helpers.functionalGroupBest;
    var compareStrings = helpers.compareStrings;

    return function generateKetoneIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 3 || carbonCount > MAX_CARBONS) {
        throw new Error("Ketone carbon count must be between 3 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);

      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;

        for (var atom = 0; atom < adjacency.length; atom += 1) {
          // Exactly two carbon neighbours: degree 2 + C=O (2 bonds) = 4.
          if (adjacency[atom].length !== 2) continue;
          if (weightedValence(adjacency, atom, null) + 2 > 4) continue;

          var attachments = [{
            atom: atom,
            element: "O",
            label: "O",
            kind: "ketone",
            hydrogens: 0,
            bondOrder: 2
          }];

          var canonical = derivativeCanonicalWithAttachments(adjacency, attachments);
          if (seen.has(canonical)) continue;

          var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
          var naming = functionalGroupBest(adjacency, atom, "ketone");
          if (!naming) continue;

          seen.set(canonical, {
            family: "ketone",
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
