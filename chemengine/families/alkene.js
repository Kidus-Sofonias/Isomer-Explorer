(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.alkene = function (generateWithBondOrder) {
    return function generateAlkeneIsomers(carbonCount) {
      return generateWithBondOrder(carbonCount, 2);
    };
  };
})(typeof self !== "undefined" ? self : this);
