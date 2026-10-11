(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.cycloalkene = function (helpers) {
    var generateCycloalkaneIsomers = helpers.generateCycloalkaneIsomers;
    var adjacencyWithRingBond = helpers.adjacencyWithRingBond;
    var findRingNodes = helpers.findRingNodes;
    var cloneEdgeOrders = helpers.cloneEdgeOrders;
    var edgeKey = helpers.edgeKey;
    var weightedValence = helpers.weightedValence;
    var canonicalUnicyclicWeighted = helpers.canonicalUnicyclicWeighted;
    var nameCycloalkeneGraph = helpers.nameCycloalkeneGraph;
    var cloneAdjacency = helpers.cloneAdjacency;
    var compareStrings = helpers.compareStrings;

    return function generateCycloalkeneIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 4 || carbonCount > 8) {
        throw new Error("Cycloalkene enumeration supports C4 through C8.");
      }

      var seen = new Map();
      var monocyclic = generateCycloalkaneIsomers(carbonCount);
      for (var i = 0; i < monocyclic.length; i += 1) {
        var ring = monocyclic[i];
        var cyclicAdjacency = adjacencyWithRingBond(ring.adjacency, ring.ringBond);
        var cycleNodes = findRingNodes(cyclicAdjacency);
        for (var atomIndex = 0; atomIndex < cycleNodes.length; atomIndex += 1) {
          var atom = cycleNodes[atomIndex];
          var ringNeighbors = cyclicAdjacency[atom].filter(function (neighbor) {
            return cycleNodes.indexOf(neighbor) !== -1 && neighbor > atom;
          });
          for (var neighborIndex = 0; neighborIndex < ringNeighbors.length; neighborIndex += 1) {
            var neighbor = ringNeighbors[neighborIndex];
            var edgeOrders = cloneEdgeOrders(ring.edgeOrders);
            edgeOrders.set(edgeKey(atom, neighbor), 2);
            if (cyclicAdjacency.some(function (_, carbon) {
              return weightedValence(cyclicAdjacency, carbon, edgeOrders) > 4;
            })) continue;

            var canonical = canonicalUnicyclicWeighted(cyclicAdjacency, edgeOrders);
            if (seen.has(canonical)) continue;
            var naming = nameCycloalkeneGraph(cyclicAdjacency, edgeOrders);
            if (!naming) continue;
            seen.set(canonical, {
              family: "cycloalkene",
              canonical: canonical,
              adjacency: cloneAdjacency(ring.adjacency),
              edgeOrders: edgeOrders,
              ringBond: ring.ringBond.slice(),
              name: naming.name,
              commonNames: [],
              chain: null,
              substituents: naming.substituents
            });
          }
        }
      }
      return Array.from(seen.values()).sort(function (a, b) {
        return compareStrings(a.name, b.name);
      });
    };
  };
})(typeof self !== "undefined" ? self : this);
