(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.alcohol = function (generateSubstitutedAlkane) {
    return function generateAlcoholIsomers(carbonCount) {
      return generateSubstitutedAlkane(carbonCount, {
        kind: "alcohol",
        element: "O",
        label: "OH",
        hydrogens: 1
      });
    };
  };
})(typeof self !== "undefined" ? self : this);
