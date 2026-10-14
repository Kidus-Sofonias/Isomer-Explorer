/****************************************************************************
 * Aldehyde family generator.
 *
 * Supported input domain:
 *   - Saturated monoaldehydes with one -CHO group.
 *   - Formula pattern: CnH2nO with one oxygen.
 *   - Carbon count must be at least 1 and at most MAX_CARBONS.
 *
 * Enumeration approach:
 *   - The aldehyde carbon is part of the carbon skeleton, so we enumerate all
 *     saturated alkane skeletons for the given carbon count and place a
 *     double-bonded oxygen on every carbon that can accept it: terminal
 *     carbons (degree <= 1) only, because -CHO must end a chain.
 *   - The carbonyl oxygen is a bond-order-2 attachment; the anchor carbon's
 *     remaining valence supplies the formyl hydrogen automatically.
 *   - Deduplicate by a canonical form of the skeleton plus the attachment
 *     position (symmetry aware), never by the display name.
 *   - Name through the shared functional-group namer (2-methylpropanal,
 *     pentanal, methanal, ...).
 *
 * Known limitations:
 *   - Only one aldehyde group per molecule.
 *   - Only saturated acyclic carbon skeletons are used.
 *   - Stereochemistry is not enumerated.
 ******************************************************************************/

(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.aldehyde = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var weightedValence = helpers.weightedValence;
    var derivativeCanonicalWithAttachments = helpers.derivativeCanonicalWithAttachments;
    var formulaFromDerivativeGraph = helpers.formulaFromDerivativeGraph;
    var cloneAdjacency = helpers.cloneAdjacency;
    var functionalGroupBest = helpers.functionalGroupBest;
    var compareStrings = helpers.compareStrings;

    return function generateAldehydeIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
        throw new Error("Aldehyde carbon count must be between 1 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);

      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;

        for (var atom = 0; atom < adjacency.length; atom += 1) {
          // The carbonyl carbon may hold one carbon neighbour (or none, for
          // methanal); anything deeper would be a ketone, not an aldehyde.
          if (adjacency[atom].length > 1) continue;
          if (weightedValence(adjacency, atom, null) + 2 > 4) continue;

          var attachments = [{
            atom: atom,
            element: "O",
            label: "O",
            kind: "aldehyde",
            hydrogens: 0,
            bondOrder: 2
          }];

          var canonical = derivativeCanonicalWithAttachments(adjacency, attachments);
          if (seen.has(canonical)) continue;

          var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
          var naming = functionalGroupBest(adjacency, atom, "aldehyde");
          if (!naming) continue;

          seen.set(canonical, {
            family: "aldehyde",
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
