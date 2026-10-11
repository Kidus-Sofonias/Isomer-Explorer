(function (root) {
  "use strict";

  var modules = root.HydrocarbonEngineAlgorithms || (root.HydrocarbonEngineAlgorithms = {});

  modules.fusedAromatic = function (helpers) {
    var edgeKey = helpers.edgeKey;
    var formulaFromGraph = helpers.formulaFromGraph;

    function perfectMatchingEdges(adjacency) {
      var matching = [];
      var occupied = new Set();

      function walk() {
        var atom = -1;
        for (var i = 0; i < adjacency.length; i += 1) {
          if (!occupied.has(i)) {
            atom = i;
            break;
          }
        }
        if (atom === -1) return true;
        occupied.add(atom);
        for (var j = 0; j < adjacency[atom].length; j += 1) {
          var neighbor = adjacency[atom][j];
          if (occupied.has(neighbor)) continue;
          occupied.add(neighbor);
          matching.push([atom, neighbor]);
          if (walk()) return true;
          matching.pop();
          occupied.delete(neighbor);
        }
        occupied.delete(atom);
        return false;
      }

      return walk() ? matching.map(function (edge) { return edge.slice(); }) : null;
    }

    return function fusedAromaticIsomers(carbonCount) {
      var ringCenters;
      var names;
      var formula;
      if (carbonCount === 10) {
        ringCenters = [[0, 0], [2.598076, 0]];
        names = ["naphthalene"];
        formula = "C10H8";
      } else if (carbonCount === 14) {
        ringCenters = [
          [[0, 0], [2.598076, 0], [5.196152, 0]],
          [[0, 0], [2.598076, 0], [3.897114, 2.25]]
        ];
        names = ["anthracene", "phenanthrene"];
        formula = "C14H10";
      } else {
        return [];
      }

      if (carbonCount === 10) ringCenters = [ringCenters];
      var isomers = [];
      for (var systemIndex = 0; systemIndex < ringCenters.length; systemIndex += 1) {
        var adjacency = [];
        var coordinates = [];
        var pointToIndex = new Map();
        var edges = new Set();

        function getVertex(x, y) {
          var key = Math.round(x * 1000) + ":" + Math.round(y * 1000);
          if (pointToIndex.has(key)) return pointToIndex.get(key);
          var index = adjacency.length;
          pointToIndex.set(key, index);
          adjacency.push([]);
          coordinates.push({ x: x, y: y });
          return index;
        }

        for (var ring = 0; ring < ringCenters[systemIndex].length; ring += 1) {
          var center = ringCenters[systemIndex][ring];
          var vertices = [];
          for (var vertex = 0; vertex < 6; vertex += 1) {
            var angle = (30 + vertex * 60) * Math.PI / 180;
            vertices.push(getVertex(center[0] + 1.5 * Math.cos(angle), center[1] + 1.5 * Math.sin(angle)));
          }
          for (var side = 0; side < 6; side += 1) {
            var from = vertices[side];
            var to = vertices[(side + 1) % 6];
            var edge = edgeKey(from, to);
            if (edges.has(edge)) continue;
            edges.add(edge);
            adjacency[from].push(to);
            adjacency[to].push(from);
          }
        }

        var matching = perfectMatchingEdges(adjacency);
        if (!matching) continue;
        var edgeOrders = new Map();
        for (var mi = 0; mi < matching.length; mi += 1) {
          edgeOrders.set(edgeKey(matching[mi][0], matching[mi][1]), 2);
        }
        var actualFormula = formulaFromGraph(adjacency, edgeOrders);
        if (actualFormula !== formula) continue;
        var minX = Math.min.apply(null, coordinates.map(function (point) { return point.x; }));
        var minY = Math.min.apply(null, coordinates.map(function (point) { return point.y; }));
        var maxX = Math.max.apply(null, coordinates.map(function (point) { return point.x; }));
        var maxY = Math.max.apply(null, coordinates.map(function (point) { return point.y; }));
        var normalized = coordinates.map(function (point) {
          return {
            x: (point.x - (minX + maxX) / 2) * 75,
            y: (point.y - (minY + maxY) / 2) * 75
          };
        });
        isomers.push({
          family: "fused_aromatic",
          canonical: names[systemIndex],
          adjacency: adjacency,
          edgeOrders: edgeOrders,
          name: names[systemIndex],
          commonNames: [],
          chain: null,
          substituents: [],
          formula: actualFormula,
          coordinates: normalized
        });
      }
      return isomers;
    };
  };
})(typeof self !== "undefined" ? self : this);
