(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.cycloalkane = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var edgeKey = helpers.edgeKey;
    var adjacencyWithRingBond = helpers.adjacencyWithRingBond;
    var canonicalUnicyclicWeighted = helpers.canonicalUnicyclicWeighted;
    var cloneAdjacency = helpers.cloneAdjacency;

    return function generateCycloalkaneIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 2 || carbonCount > MAX_CARBONS) {
        throw new Error("Carbon count must be between 2 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);
      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;
        var n = adjacency.length;
        for (var a = 0; a < n; a += 1) {
          for (var b = a + 1; b < n; b += 1) {
            if (adjacency[a].indexOf(b) !== -1) continue;
            if (adjacency[a].length >= 4 || adjacency[b].length >= 4) continue;

            var edgeOrders = new Map();
            edgeOrders.set(edgeKey(a, b), 1);
            var cyclicAdjacency = adjacencyWithRingBond(adjacency, [a, b]);
            var canonical = canonicalUnicyclicWeighted(cyclicAdjacency, edgeOrders);
            if (!seen.has(canonical)) {
              seen.set(canonical, {
                canonical: canonical,
                adjacency: cloneAdjacency(adjacency),
                edgeOrders: edgeOrders,
                ringBond: [a, b],
                bondOrder: 1
              });
            }
          }
        }
      }

      return Array.from(seen.values());
    };
  };
})(typeof self !== "undefined" ? self : this);
