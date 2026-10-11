(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.formula = function (halogens) {
    function normalizeFormula(input) {
      return String(input || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/_/g, "")
        .replace(/[{}]/g, "")
        .replace(/\u2080/g, "0")
        .replace(/\u2081/g, "1")
        .replace(/\u2082/g, "2")
        .replace(/\u2083/g, "3")
        .replace(/\u2084/g, "4")
        .replace(/\u2085/g, "5")
        .replace(/\u2086/g, "6")
        .replace(/\u2087/g, "7")
        .replace(/\u2088/g, "8")
        .replace(/\u2089/g, "9");
    }

    function formatFormula(carbon, hydrogen) {
      return "C" + (carbon === 1 ? "" : carbon) + "H" + (hydrogen === 1 ? "" : hydrogen);
    }

    function formatMolecularFormula(elements) {
      var order = ["C", "H", "N", "Br", "Cl", "F", "I", "O"];
      var pieces = [];
      for (var i = 0; i < order.length; i += 1) {
        var element = order[i];
        var count = elements[element] || 0;
        if (count > 0) pieces.push(element + (count === 1 ? "" : count));
      }
      return pieces.join("");
    }

    function parseFormula(input) {
      var formula = normalizeFormula(input);
      if (!formula) {
        throw new Error("Enter a formula, for example C5H12, C5H11Br, or C2H5OH.");
      }

      var totals = { C: 0, H: 0, O: 0, F: 0, Cl: 0, Br: 0, I: 0, N: 0 };
      var cursor = 0;
      while (cursor < formula.length) {
        var two = formula.slice(cursor, cursor + 2).toLowerCase();
        var symbol = "";
        if (two === "br") {
          symbol = "Br";
          cursor += 2;
        } else if (two === "cl") {
          symbol = "Cl";
          cursor += 2;
        } else {
          var one = formula[cursor];
          if (!/[A-Za-z]/.test(one)) {
            throw new Error("Formula contains an unexpected character near \"" + formula.slice(cursor) + "\".");
          }
          symbol = one.toUpperCase();
          cursor += 1;
        }

        if (!Object.prototype.hasOwnProperty.call(totals, symbol)) {
          throw new Error("Only C, H, N, O, F, Cl, Br, and I are supported in this app.");
        }

        var digitStart = cursor;
        while (cursor < formula.length && /[0-9]/.test(formula[cursor])) cursor += 1;
        var digits = formula.slice(digitStart, cursor);
        var count = digits ? Number(digits) : 1;
        if (!Number.isSafeInteger(count) || count < 1) {
          throw new Error("Element counts must be positive whole numbers.");
        }

        var nextTotal = totals[symbol] + count;
        if (!Number.isSafeInteger(nextTotal)) {
          throw new Error("Element counts must be positive whole numbers.");
        }
        totals[symbol] = nextTotal;
      }

      if (totals.C < 1 || totals.H < 1) {
        throw new Error("A hydrocarbon or derivative formula must include both carbon and hydrogen.");
      }

      return {
        carbon: totals.C,
        hydrogen: totals.H,
        oxygen: totals.O,
        halogen: halogens.reduce(function (sum, element) {
          return sum + totals[element];
        }, 0),
        elements: totals,
        formula: formatMolecularFormula(totals)
      };
    }

    function isFormulaInput(input) {
      var formula = normalizeFormula(input);
      if (!/^[A-Za-z0-9]+$/.test(formula) || !/[0-9]/.test(formula)) return false;
      try {
        parseFormula(formula);
        return true;
      } catch (error) {
        return /^[Cc](?:\d|[Hh]|[Oo]|[Ff]|[Ii]|[Bb][Rr]|[Cc][Ll])/.test(formula);
      }
    }

    return {
      normalizeFormula: normalizeFormula,
      formatFormula: formatFormula,
      formatMolecularFormula: formatMolecularFormula,
      parseFormula: parseFormula,
      isFormulaInput: isFormulaInput
    };
  };
})(typeof self !== "undefined" ? self : this);
