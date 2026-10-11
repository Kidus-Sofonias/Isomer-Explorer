(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.aromatic = function (helpers) {
    var MAX_CARBONS = helpers.MAX_CARBONS;
    var aromaticCache = helpers.aromaticCache;
    var aromaticAlkylOptions = helpers.aromaticAlkylOptions;
    var nameAromaticRing = helpers.nameAromaticRing;
    var canonicalRingToken = helpers.canonicalRingToken;
    var compareStrings = helpers.compareStrings;

    return function generateAromaticIsomers(carbonCount) {
      if (!Number.isInteger(carbonCount) || carbonCount < 6 || carbonCount > MAX_CARBONS) {
        throw new Error("Aromatic mode supports C6 through C" + MAX_CARBONS + ".");
      }

      if (aromaticCache.has(carbonCount)) {
        return aromaticCache.get(carbonCount);
      }

      var sideChainCarbons = carbonCount - 6;
      if (sideChainCarbons === 0) {
        var benzeneName = nameAromaticRing([null, null, null, null, null, null]);
        var benzene = [{
          canonical: "benzene",
          name: benzeneName.name,
          sequence: benzeneName.sequence,
          substituents: []
        }];
        aromaticCache.set(carbonCount, benzene);
        return benzene;
      }

      var options = aromaticAlkylOptions(sideChainCarbons);
      var seen = new Map();

      function walk(position, remaining, sequence) {
        if (position === 6) {
          if (remaining === 0) {
            var canonical = canonicalRingToken(sequence);
            if (!seen.has(canonical)) {
              var naming = nameAromaticRing(sequence);
              seen.set(canonical, {
                canonical: canonical,
                name: naming.name,
                sequence: naming.sequence,
                substituents: naming.substituents
              });
            }
          }
          return;
        }

        sequence.push(null);
        walk(position + 1, remaining, sequence);
        sequence.pop();

        for (var i = 0; i < options.length; i += 1) {
          if (options[i].size <= remaining) {
            sequence.push(options[i]);
            walk(position + 1, remaining - options[i].size, sequence);
            sequence.pop();
          }
        }
      }

      walk(0, sideChainCarbons, []);
      var result = Array.from(seen.values()).sort(function (a, b) {
        return compareStrings(a.name, b.name);
      });
      aromaticCache.set(carbonCount, result);
      return result;
    };
  };
})(typeof self !== "undefined" ? self : this);
