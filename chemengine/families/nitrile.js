/****************************************************************************
 * Nitrile family generator.
 *
 * Supported input domain:
 *   - Saturated mononitriles with one -C-triple-bond-N group.
 *   - Formula pattern: CnH2n-1N with one nitrogen.
 *   - Carbon count must be at least 2 and at most MAX_CARBONS.
 *
 * Enumeration approach:
 *   - The nitrile carbon is part of the carbon skeleton, so we enumerate all
 *     saturated alkane skeletons and put the triple-bonded nitrogen on every
 *     terminal carbon (degree <= 1): degree + 3 bonds fills carbon's valence,
 *     leaving no hydrogens on the cyano carbon.
 *   - The nitrogen is a bond-order-3 attachment, so formulas, diagrams, and
 *     the 3D model all account for the C#N triple bond automatically.
 *   - Deduplicate with a symmetry-aware canonical form of skeleton plus
 *     attachment position.
 *   - Name through the shared functional-group namer: the cyano carbon is
 *     always C1 of the parent chain (butanenitrile, 2-methylpropanenitrile,
 *     ethanenitrile, ...).
 *
 * Known limitations:
 *   - Only one nitrile group per molecule.
 *   - Only saturated acyclic carbon skeletons are used.
 *   - Stereochemistry is not enumerated.
 ******************************************************************************/

(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.nitrile = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var weightedValence = helpers.weightedValence;
    var derivativeCanonicalWithAttachments = helpers.derivativeCanonicalWithAttachments;
    var formulaFromDerivativeGraph = helpers.formulaFromDerivativeGraph;
    var cloneAdjacency = helpers.cloneAdjacency;
    var functionalGroupBest = helpers.functionalGroupBest;
    var compareStrings = helpers.compareStrings;

    return function generateNitrileIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 2 || carbonCount > MAX_CARBONS) {
        throw new Error("Nitrile carbon count must be between 2 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);

      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;

        for (var atom = 0; atom < adjacency.length; atom += 1) {
          // Cyano carbon: one carbon neighbour at most, plus the triple bond.
          if (adjacency[atom].length > 1) continue;
          if (weightedValence(adjacency, atom, null) + 3 > 4) continue;

          var attachments = [{
            atom: atom,
            element: "N",
            label: "N",
            kind: "nitrile",
            hydrogens: 0,
            bondOrder: 3
          }];

          var canonical = derivativeCanonicalWithAttachments(adjacency, attachments);
          if (seen.has(canonical)) continue;

          var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
          var naming = functionalGroupBest(adjacency, atom, "nitrile");
          if (!naming) continue;

          seen.set(canonical, {
            family: "nitrile",
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
