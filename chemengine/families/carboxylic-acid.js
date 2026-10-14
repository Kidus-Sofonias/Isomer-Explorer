/****************************************************************************
 * Carboxylic acid family generator.
 *
 * Supported input domain:
 *   - Saturated monocarboxylic acids with one -COOH group.
 *   - Formula pattern: CnH2nO2 with two oxygens.
 *   - Carbon count must be at least 1 and at most MAX_CARBONS.
 *
 * Enumeration approach:
 *   - The carboxyl carbon is part of the carbon skeleton, so we enumerate all
 *     saturated alkane skeletons and make every terminal carbon (degree <= 1)
 *     the carboxyl centre: it carries a double-bonded oxygen (2 bonds) and a
 *     hydroxyl (1 bond), which exactly fills carbon's valence.
 *   - Deduplicate with a symmetry-aware canonical form of skeleton plus the
 *     two attachment positions.
 *   - Name through the shared functional-group namer: the carboxyl carbon is
 *     always C1 of the parent chain (butanoic acid, 2-methylpropanoic acid,
 *     methanoic acid, ...).
 *
 * Known limitations:
 *   - Only one -COOH group per molecule.
 *   - Only saturated acyclic carbon skeletons are used.
 *   - Stereochemistry is not enumerated.
 ******************************************************************************/

(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.carboxylicAcid = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var weightedValence = helpers.weightedValence;
    var derivativeCanonicalWithAttachments = helpers.derivativeCanonicalWithAttachments;
    var formulaFromDerivativeGraph = helpers.formulaFromDerivativeGraph;
    var cloneAdjacency = helpers.cloneAdjacency;
    var functionalGroupBest = helpers.functionalGroupBest;
    var compareStrings = helpers.compareStrings;

    return function generateCarboxylicAcidIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
        throw new Error("Carboxylic acid carbon count must be between 1 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);

      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;

        for (var atom = 0; atom < adjacency.length; atom += 1) {
          // Carboxyl carbon: one carbon neighbour at most (or none for
          // methanoic acid); =O (2) + -OH (1) + C (1) fills the valence.
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
              element: "O",
              label: "OH",
              kind: "alcohol",
              hydrogens: 1,
              bondOrder: 1
            }
          ];

          var canonical = derivativeCanonicalWithAttachments(adjacency, attachments);
          if (seen.has(canonical)) continue;

          var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
          var naming = functionalGroupBest(adjacency, atom, "carboxylic acid");
          if (!naming) continue;

          seen.set(canonical, {
            family: "carboxylic acid",
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
