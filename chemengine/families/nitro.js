/****************************************************************************
 * Nitroalkane family generator.
 *
 * Supported input domain:
 *   - Saturated nitroalkanes with one -NO2 group.
 *   - Formula pattern: CnH2n+1NO2 with one nitrogen and two oxygens.
 *   - Carbon count must be at least 1 and at most MAX_CARBONS.
 *
 * Enumeration approach:
 *   - Enumerate all saturated alkane skeletons and attach the nitro group to
 *     every carbon that can accept a fourth bond (degree <= 3, so tertiary
 *     carbons such as 2-nitro-2-methylpropane are included).
 *   - The nitro group is one attachment carrying extra atoms (N + 2 O), so
 *     formulas count three heteroatoms while the diagram shows the NO2 label
 *     and the 3D model builds the real -N(=O)2 unit.
 *   - Name through the shared functional-group namer, treating nitro as an
 *     ordinary prefix substituent (nitromethane, 2-nitropropane, ...).
 *
 * Known limitations:
 *   - Only one nitro group per molecule.
 *   - Only saturated acyclic carbon skeletons are used.
 *   - Stereochemistry is not enumerated.
 ******************************************************************************/

(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.nitro = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var weightedValence = helpers.weightedValence;
    var derivativeCanonicalWithAttachments = helpers.derivativeCanonicalWithAttachments;
    var formulaFromDerivativeGraph = helpers.formulaFromDerivativeGraph;
    var cloneAdjacency = helpers.cloneAdjacency;
    var functionalGroupBest = helpers.functionalGroupBest;
    var compareStrings = helpers.compareStrings;

    return function generateNitroIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
        throw new Error("Nitro carbon count must be between 1 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);

      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;

        for (var atom = 0; atom < adjacency.length; atom += 1) {
          if (adjacency[atom].length >= 4) continue;
          if (weightedValence(adjacency, atom, null) + 1 > 4) continue;

          var attachments = [{
            atom: atom,
            element: "N",
            label: "NO\u2082",
            kind: "nitro",
            hydrogens: 0,
            bondOrder: 1,
            extraElements: { O: 2 }
          }];

          var canonical = derivativeCanonicalWithAttachments(adjacency, attachments);
          if (seen.has(canonical)) continue;

          var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
          var naming = functionalGroupBest(adjacency, atom, "nitro");
          if (!naming) continue;

          seen.set(canonical, {
            family: "nitro",
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
