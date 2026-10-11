(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.familyRules = function (config) {
    var MAX_CARBONS = config.MAX_CARBONS;
    var HALOGENS = config.HALOGENS;

    function expectedHydrogenForFamily(carbon, family) {
      if (family === "alkane") return carbon * 2 + 2;
      if (family === "alkene") return carbon * 2;
      if (family === "alkyne") return carbon * 2 - 2;
      if (family === "cycloalkane") return carbon * 2;
      if (family === "aromatic") return carbon * 2 - 6;
      if (family === "haloalkane") return carbon * 2 + 1;
      if (family === "alcohol" || family === "ether") return carbon * 2 + 2;
      if (family === "ester" || family === "carboxylic acid") return carbon * 2;
      if (family === "aldehyde" || family === "ketone") return carbon * 2;
      if (family === "amine") return carbon * 2 + 3;
      if (family === "cycloalkene" || family === "diene" || family === "bicyclic") return carbon * 2 - 2;
      if (family === "fused_aromatic") return carbon === 10 ? 8 : carbon === 14 ? 10 : null;
      if (family === "nitrile") return carbon * 2 - 1;
      if (family === "nitro" || family === "amide") return carbon * 2 + 1;
      return null;
    }

    function familyMinimumCarbon(family) {
      if (family === "alkane" || family === "haloalkane" || family === "alcohol" ||
          family === "carboxylic acid" || family === "aldehyde" || family === "amine" ||
          family === "nitro" || family === "amide") return 1;
      if (family === "alkene" || family === "alkyne" || family === "ester" ||
          family === "ether" || family === "nitrile") return 2;
      if (family === "cycloalkane") return 3;
      if (family === "cycloalkene" || family === "diene") return 4;
      if (family === "bicyclic") return 5;
      if (family === "aromatic") return 6;
      if (family === "fused_aromatic") return 10;
      return 1;
    }

    function familyMaximumCarbon(family) {
      if (family === "diene" || family === "cycloalkene") return 8;
      if (family === "bicyclic") return 5;
      if (family === "fused_aromatic") return 14;
      return MAX_CARBONS;
    }

    function halogenElements(parsed) {
      return HALOGENS.filter(function (element) {
        return parsed.elements && parsed.elements[element] > 0;
      });
    }

    function hasOnlyCarbonHydrogen(parsed) {
      return (parsed.oxygen || 0) === 0 &&
        (parsed.elements.N || 0) === 0 &&
        (parsed.halogen || 0) === 0;
    }

    function formulaMatchesFamily(parsed, family) {
      var expectedHydrogen = expectedHydrogenForFamily(parsed.carbon, family);
      if (expectedHydrogen !== null && parsed.hydrogen !== expectedHydrogen) return false;
      if (family === "general_heteroatom") return !hasOnlyCarbonHydrogen(parsed);
      if (family === "fused_aromatic") {
        return hasOnlyCarbonHydrogen(parsed) &&
          ((parsed.carbon === 10 && parsed.hydrogen === 8) ||
           (parsed.carbon === 14 && parsed.hydrogen === 10));
      }
      if (family === "bicyclic") {
        return hasOnlyCarbonHydrogen(parsed) &&
          parsed.hydrogen === parsed.carbon * 2 - 2;
      }
      if (family === "haloalkane") return parsed.halogen === 1 && parsed.oxygen === 0;
      if (family === "alcohol") return parsed.oxygen === 1 && parsed.halogen === 0 && (parsed.elements.N || 0) === 0;
      if (family === "ester" || family === "carboxylic acid") {
        return parsed.oxygen === 2 && parsed.halogen === 0 && (parsed.elements.N || 0) === 0;
      }
      if (family === "aldehyde" || family === "ketone" || family === "ether") {
        return parsed.oxygen === 1 && parsed.halogen === 0 && (parsed.elements.N || 0) === 0;
      }
      if (family === "amine" || family === "nitrile") {
        return (parsed.elements.N || 0) === 1 && parsed.oxygen === 0 && parsed.halogen === 0;
      }
      if (family === "nitro") return (parsed.elements.N || 0) === 1 && parsed.oxygen === 2 && parsed.halogen === 0;
      if (family === "amide") return (parsed.elements.N || 0) === 1 && parsed.oxygen === 1 && parsed.halogen === 0;
      return hasOnlyCarbonHydrogen(parsed);
    }

    function detectFamily(parsed) {
      if (formulaMatchesFamily(parsed, "haloalkane")) return "haloalkane";
      if (formulaMatchesFamily(parsed, "alcohol")) return "alcohol";
      if (formulaMatchesFamily(parsed, "amine")) return "amine";
      if (formulaMatchesFamily(parsed, "nitrile")) return "nitrile";
      if (formulaMatchesFamily(parsed, "nitro")) return "nitro";
      if (formulaMatchesFamily(parsed, "amide")) return "amide";
      if (parsed.oxygen > 0 && !parsed.halogen && (parsed.elements.N || 0) === 0) {
        var expectedHydrogen = expectedHydrogenForFamily(parsed.carbon, "aldehyde");
        if (parsed.oxygen === 1 && parsed.hydrogen === expectedHydrogen) return "aldehyde";
        if (parsed.oxygen === 2 && parsed.hydrogen === expectedHydrogen) {
          return parsed.carbon === 1 ? "carboxylic acid" : "ester";
        }
        if (parsed.oxygen === 1 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "ether")) {
          return "ether";
        }
      }
      if (!hasOnlyCarbonHydrogen(parsed)) return "general_heteroatom";
      if (formulaMatchesFamily(parsed, "fused_aromatic")) return "fused_aromatic";
      if (parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "alkane")) return "alkane";
      if (parsed.carbon >= 2 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "alkene")) return "alkene";
      if (parsed.carbon >= 2 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "alkyne")) return "alkyne";
      if (parsed.carbon >= 6 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "aromatic")) return "aromatic";
      if (parsed.carbon >= 3 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "cycloalkane")) return "cycloalkane";
      if (parsed.carbon >= 4 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "cycloalkene")) return "cycloalkene";
      if (parsed.carbon >= 4 && parsed.hydrogen === expectedHydrogenForFamily(parsed.carbon, "diene")) return "diene";
      return "general_hydrocarbon";
    }

    function formulaElementsForFamily(carbon, hydrogen, family, halogen) {
      var elements = { C: carbon, H: hydrogen, N: 0, Br: 0, Cl: 0, F: 0, I: 0, O: 0 };
      if (family === "haloalkane") {
        elements[halogen || "Br"] = 1;
      } else if (family === "alcohol" || family === "ether" || family === "aldehyde" || family === "ketone") {
        elements.O = 1;
      } else if (family === "ester" || family === "carboxylic acid" || family === "nitro") {
        elements.O = 2;
        if (family === "nitro") elements.N = 1;
      } else if (family === "amine" || family === "nitrile") {
        elements.N = 1;
      } else if (family === "amide") {
        elements.N = 1;
        elements.O = 1;
      }
      return elements;
    }

    return {
      expectedHydrogenForFamily: expectedHydrogenForFamily,
      familyMinimumCarbon: familyMinimumCarbon,
      familyMaximumCarbon: familyMaximumCarbon,
      halogenElements: halogenElements,
      hasOnlyCarbonHydrogen: hasOnlyCarbonHydrogen,
      formulaMatchesFamily: formulaMatchesFamily,
      detectFamily: detectFamily,
      formulaElementsForFamily: formulaElementsForFamily
    };
  };
})(typeof self !== "undefined" ? self : this);
