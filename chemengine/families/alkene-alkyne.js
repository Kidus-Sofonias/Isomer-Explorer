(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.alkeneAlkyne = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var canPlaceMultipleBond = helpers.canPlaceMultipleBond;
    var edgeKey = helpers.edgeKey;
    var freeCanonicalWeighted = helpers.freeCanonicalWeighted;

    return function generateUnsaturatedAcyclicIsomers(carbonCount, bondOrder) {
      if (!Number.isInteger(carbonCount) || carbonCount < 2 || carbonCount > MAX_CARBONS) {
        throw new Error("Carbon count must be between 2 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);
      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;
        for (var atom = 0; atom < adjacency.length; atom += 1) {
          for (var j = 0; j < adjacency[atom].length; j += 1) {
            var neighbor = adjacency[atom][j];
            if (neighbor < atom || !canPlaceMultipleBond(adjacency, atom, neighbor, bondOrder)) {
              continue;
            }

            var edgeOrders = new Map();
            edgeOrders.set(edgeKey(atom, neighbor), bondOrder);
            var canonical = freeCanonicalWeighted(adjacency, edgeOrders);
            if (!seen.has(canonical)) {
              seen.set(canonical, {
                canonical: canonical,
                adjacency: adjacency,
                edgeOrders: edgeOrders,
                multipleBond: [atom, neighbor],
                bondOrder: bondOrder
              });
            }
          }
        }
      }

      return Array.from(seen.values());
    };
  };
})(typeof self !== "undefined" ? self : this);
