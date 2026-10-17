import test from "node:test";
import assert from "node:assert/strict";
import { lineas } from "./alineacion.js";

const j = (pos) => ({ pos, corto: pos });

test("lineas: 4-1-4-1 con portero, de izquierda a derecha", () => {
  const xi = ["G", "CD-L", "CD-R", "DM", "LB", "RB", "CM-L", "CM-R", "LM", "RM", "F"].map(j);
  const f = lineas(xi, "4-1-4-1");
  assert.deepEqual(f.map((x) => x.map((y) => y.pos)), [["G"], ["LB", "CD-L", "CD-R", "RB"], ["DM"], ["LM", "CM-L", "CM-R", "RM"], ["F"]]);
});

test("lineas: formación que no cuadra o sin portero = null", () => {
  const xi = ["G", "CD", "CD", "CD", "CD", "CM", "CM", "CM", "F", "F", "F"].map(j);
  assert.equal(lineas(xi, "4-4-2-1"), null);
  assert.equal(lineas(xi.slice(1).concat(j("F")), "4-3-3"), null);
  assert.equal(lineas(xi, null), null);
});
