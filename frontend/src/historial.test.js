import test from "node:test";
import assert from "node:assert/strict";
import { ganadoras, resumen } from "./historial.js";

test("historial: apuestas cumplidas por partido y resumen", () => {
  const rs = [
    { gf: 2, gc: 1, corners: 10 },
    { gf: 0, gc: 0, corners: null },
    { gf: NaN, gc: NaN, corners: null }, // sin marcador: se ignora
  ];
  assert.deepEqual(ganadoras(rs[0]), ["Gana", "Gana o empata", "Anota", "Más de 1.5 goles", "Más de 2.5 goles", "Menos de 3.5 goles", "Ambos anotan", "Más de 8.5 corners"]);
  assert.deepEqual(ganadoras(rs[1]), ["Gana o empata", "Menos de 3.5 goles"]);
  const r = resumen(rs);
  assert.deepEqual(r[0], { nombre: "Gana o empata", veces: 2, de: 2 });
  assert.deepEqual(r.find((x) => x.nombre === "Más de 8.5 corners"), { nombre: "Más de 8.5 corners", veces: 1, de: 1 });
});
