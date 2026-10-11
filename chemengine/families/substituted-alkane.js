(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.substitutedAlkane = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var weightedValence = helpers.weightedValence;
    var derivativeCanonical = helpers.derivativeCanonical;
    var formulaFromDerivativeGraph = helpers.formulaFromDerivativeGraph;
    var cloneAdjacency = helpers.cloneAdjacency;
    var derivativeName = helpers.derivativeName;
    var nameAlkane = helpers.nameAlkane;
    var compareStrings = helpers.compareStrings;

    return function generateMonosubstitutedAlkaneIsomers(carbonCount, attachment) {
      if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
        throw new Error("Carbon count must be between 1 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);
      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;
        for (var atom = 0; atom < adjacency.length; atom += 1) {
          if (weightedValence(adjacency, atom, null) >= 4) continue;
          var canonical = derivativeCanonical(adjacency, atom, attachment);
          if (seen.has(canonical)) continue;
          var attachments = [{
            atom: atom,
            element: attachment.element,
            label: attachment.label,
            kind: attachment.kind,
            hydrogens: attachment.hydrogens || 0
          }];
          var formulaInfo = formulaFromDerivativeGraph(adjacency, attachments, null);
          var naming = nameAlkane(adjacency);
          seen.set(canonical, {
            family: attachment.kind,
            canonical: canonical,
            adjacency: cloneAdjacency(adjacency),
            edgeOrders: null,
            attachments: attachments,
            name: derivativeName(adjacency, atom, attachment),
            commonNames: [],
            chain: naming.chain,
            substituents: naming.substituents,
            formula: formulaInfo.formula
          });
        }
      }

      return Array.from(seen.values()).sort(function (a, b) {
        return compareStrings(a.name, b.name);
      });
    };
  };
})(typeof self !== "undefined" ? self : this);
