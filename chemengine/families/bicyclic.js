(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.bicyclic = function (helpers) {
    var generateAlkaneIsomers = helpers.generateAlkaneIsomers;
    var adjacencyWithRingBond = helpers.adjacencyWithRingBond;
    var canonicalGraphCode = helpers.canonicalGraphCode;
    var formulaFromGraph = helpers.formulaFromGraph;
    var formatFormula = helpers.formatFormula;
    var bicyclicName = helpers.bicyclicName;
    var graphLayout = helpers.graphLayout;
    var compareStrings = helpers.compareStrings;

    return function generateBicyclicIsomers(carbonCount) {
      if (carbonCount !== 5) {
        throw new Error("Bicyclic enumeration currently supports C5 only.");
      }

      var seen = new Map();
      var trees = generateAlkaneIsomers(carbonCount);
      for (var ti = 0; ti < trees.length; ti += 1) {
        var tree = trees[ti].adjacency;
        var possibleEdges = [];
        for (var left = 0; left < tree.length; left += 1) {
          for (var right = left + 1; right < tree.length; right += 1) {
            if (tree[left].indexOf(right) === -1) possibleEdges.push([left, right]);
          }
        }

        for (var first = 0; first < possibleEdges.length; first += 1) {
          var edgeA = possibleEdges[first];
          if (tree[edgeA[0]].length >= 4 || tree[edgeA[1]].length >= 4) continue;
          var withFirst = adjacencyWithRingBond(tree, edgeA);
          for (var second = first + 1; second < possibleEdges.length; second += 1) {
            var edgeB = possibleEdges[second];
            if (withFirst[edgeB[0]].length >= 4 || withFirst[edgeB[1]].length >= 4) continue;
            var adjacency = adjacencyWithRingBond(withFirst, edgeB);
            var canonical = canonicalGraphCode(adjacency, null);
            if (seen.has(canonical)) continue;
            var formulaInfo = formulaFromGraph(adjacency, null);
            if (formulaInfo !== formatFormula(carbonCount, carbonCount * 2 - 2)) continue;
            seen.set(canonical, {
              family: "bicyclic",
              canonical: canonical,
              adjacency: adjacency,
              edgeOrders: null,
              name: bicyclicName(adjacency),
              commonNames: [],
              chain: null,
              substituents: [],
              formula: formulaInfo,
              coordinates: graphLayout(adjacency)
            });
          }
        }
      }

      return Array.from(seen.values()).sort(function (a, b) {
        return compareStrings(a.name, b.name) || compareStrings(a.canonical, b.canonical);
      });
    };
  };
})(typeof self !== "undefined" ? self : this);
