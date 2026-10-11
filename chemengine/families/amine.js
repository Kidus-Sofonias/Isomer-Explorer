(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.amine = function (generateSubstitutedAlkane) {
    return function generatePrimaryAmineIsomers(carbonCount) {
      return generateSubstitutedAlkane(carbonCount, {
        kind: "amine",
        element: "N",
        label: "NH\u2082",
        hydrogens: 2
      });
    };
  };
})(typeof self !== "undefined" ? self : this);
