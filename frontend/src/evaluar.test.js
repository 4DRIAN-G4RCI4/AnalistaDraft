import test from "node:test";
import assert from "node:assert/strict";
import { evaluar } from "./evaluar.js";

const v = (estado, gl, gv, extra = {}) => ({
  estado, jugado: 60, descanso: false,
  local: { goles: gl, corners: 4, tirosPuerta: 3, tiros: 9 },
  visita: { goles: gv, corners: 5, tirosPuerta: 2, tiros: 7 },
  eventos: [], ...extra,
});

test("resultado: se decide al final", () => {
  assert.equal(evaluar("Visita", v("in", 0, 1)), "pendiente");
  assert.equal(evaluar("Visita", v("post", 0, 1)), "si");
  assert.equal(evaluar("Local o empate", v("post", 0, 1)), "no");
});

test("más/menos: se cumple o falla en cuanto se pasa la línea", () => {
  assert.equal(evaluar("Más de 0.5 goles", v("in", 0, 1)), "si");
  assert.equal(evaluar("Menos de 0.5 goles", v("in", 0, 1)), "no");
  assert.equal(evaluar("Menos de 2.5 goles", v("in", 0, 1)), "pendiente");
  assert.equal(evaluar("Menos de 2.5 goles", v("post", 0, 1)), "si");
  assert.equal(evaluar("Visita más de 1.5 goles", v("post", 0, 1)), "no");
  assert.equal(evaluar("Más de 8.5 corners", v("in", 0, 0)), "si"); // 4 + 5
  assert.equal(evaluar("Local menos de 3.5 corners", v("in", 0, 0)), "no");
});

test("ambos anotan, goleador, tarjetas y primer tiempo", () => {
  assert.equal(evaluar("Ambos anotan", v("in", 1, 1)), "si");
  assert.equal(evaluar("No ambos anotan", v("post", 0, 2)), "si");
  const ev = [{ tipo: "gol", minuto: "40'", local: true, jugador: "Pérez" }, { tipo: "amarilla", minuto: "50'", local: false, jugador: "X" }];
  assert.equal(evaluar("Pérez anota", v("in", 1, 0, { eventos: ev })), "si");
  assert.equal(evaluar("Gómez anota", v("post", 1, 0, { eventos: ev })), "no");
  assert.equal(evaluar("Más de 0.5 tarjetas", v("in", 1, 0, { eventos: ev })), "si");
  assert.equal(evaluar("Más de 0.5 goles en 1T", v("in", 1, 0, { eventos: ev })), "si");
  assert.equal(evaluar("Más de 1.5 goles en 1T", v("in", 1, 0, { eventos: ev })), "no"); // ya va el 2T
  assert.equal(evaluar("Más de 0.5 goles en 2T", v("in", 1, 0, { eventos: ev })), "pendiente");
  assert.equal(evaluar("Pérez 2+ tiros", v("in", 1, 0)), null);
});
