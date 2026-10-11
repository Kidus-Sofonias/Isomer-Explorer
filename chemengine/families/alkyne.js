(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.alkyne = function (generateWithBondOrder) {
    return function generateAlkyneIsomers(carbonCount) {
      return generateWithBondOrder(carbonCount, 3);
    };
  };
})(typeof self !== "undefined" ? self : this);
