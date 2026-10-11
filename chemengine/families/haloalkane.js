(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.haloalkane = function (generateSubstitutedAlkane) {
    return function generateHaloalkaneIsomers(carbonCount, element) {
      return generateSubstitutedAlkane(carbonCount, {
        kind: "haloalkane",
        element: element,
        label: element,
        hydrogens: 0
      });
    };
  };
})(typeof self !== "undefined" ? self : this);
