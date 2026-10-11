(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.alkane = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var rootForms = helpers.rootForms;
    var parseRootedTree = helpers.parseRootedTree;
    var freeCanonical = helpers.freeCanonical;

    return function generateAlkaneIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 1 || carbonCount > MAX_CARBONS) {
        throw new Error("Carbon count must be between 1 and " + MAX_CARBONS + ".");
      }

      var seen = new Map();
      var candidates = rootForms(carbonCount);
      for (var i = 0; i < candidates.length; i += 1) {
        var adjacency = parseRootedTree(candidates[i]);
        var isValid = adjacency.every(function (neighbors) {
          return neighbors.length <= 4;
        });
        if (!isValid) {
          continue;
        }

        var canonical = freeCanonical(adjacency);
        if (!seen.has(canonical)) {
          seen.set(canonical, { canonical: canonical, adjacency: adjacency });
        }
      }

      return Array.from(seen.values());
    };
  };
})(typeof self !== "undefined" ? self : this);
