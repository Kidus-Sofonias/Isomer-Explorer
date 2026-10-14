(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.diene = function (helpers) {
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var edgeKey = helpers.edgeKey;
    var weightedValence = helpers.weightedValence;
    var allLongestChainsContainingEdges = helpers.allLongestChainsContainingEdges;
    var buildDieneNameCandidate = helpers.buildDieneNameCandidate;
    var compareDieneNameCandidates = helpers.compareDieneNameCandidates;
    var freeCanonicalWeighted = helpers.freeCanonicalWeighted;
    var cloneAdjacency = helpers.cloneAdjacency;
    var compareStrings = helpers.compareStrings;

    return function generateDieneIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 4 || carbonCount > 10) {
        throw new Error("Acyclic diene enumeration supports C4 through C10.");
      }

      var seen = new Map();
      var skeletons = generateAlkaneIsomers(carbonCount);
      for (var i = 0; i < skeletons.length; i += 1) {
        var adjacency = skeletons[i].adjacency;
        var edges = [];
        for (var atom = 0; atom < adjacency.length; atom += 1) {
          for (var neighborIndex = 0; neighborIndex < adjacency[atom].length; neighborIndex += 1) {
            var neighbor = adjacency[atom][neighborIndex];
            if (neighbor > atom) edges.push([atom, neighbor]);
          }
        }

        for (var first = 0; first < edges.length; first += 1) {
          for (var second = first + 1; second < edges.length; second += 1) {
            var doubleBonds = [edges[first], edges[second]];
            var edgeOrders = new Map();
            edgeOrders.set(edgeKey(doubleBonds[0][0], doubleBonds[0][1]), 2);
            edgeOrders.set(edgeKey(doubleBonds[1][0], doubleBonds[1][1]), 2);
            if (adjacency.some(function (_, carbon) {
              return weightedValence(adjacency, carbon, edgeOrders) > 4;
            })) continue;

            var chains = allLongestChainsContainingEdges(adjacency, doubleBonds);
            if (!chains.length) continue;
            var nameCandidates = [];
            var memo = new Map();
            for (var chainIndex = 0; chainIndex < chains.length; chainIndex += 1) {
              nameCandidates.push(buildDieneNameCandidate(adjacency, chains[chainIndex], doubleBonds, memo));
              nameCandidates.push(buildDieneNameCandidate(adjacency, chains[chainIndex].slice().reverse(), doubleBonds, memo));
            }
            nameCandidates.sort(compareDieneNameCandidates);
            var canonical = freeCanonicalWeighted(adjacency, edgeOrders);
            if (seen.has(canonical)) continue;
            seen.set(canonical, {
              family: "diene",
              canonical: canonical,
              adjacency: cloneAdjacency(adjacency),
              edgeOrders: edgeOrders,
              multipleBonds: doubleBonds.map(function (edge) { return edge.slice(); }),
              name: nameCandidates[0].name,
              commonNames: [],
              chain: nameCandidates[0].chain,
              substituents: nameCandidates[0].substituents
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
