import test from "node:test";
import assert from "node:assert/strict";
import { opuesto } from "./mercados.js";

test("opuesto: la otra cara de una selección con línea", () => {
  assert.equal(opuesto("Más de 8.5 corners"), "Menos de 8.5 corners");
  assert.equal(opuesto("Menos de 2.5 goles"), "Más de 2.5 goles");

  // conserva el equipo y lo que va después de la línea
  assert.equal(opuesto("Local más de 1.5 goles"), "Local menos de 1.5 goles");
  assert.equal(opuesto("Visita menos de 0.5 goles"), "Visita más de 0.5 goles");
  assert.equal(opuesto("Más de 1.5 goles en 1T"), "Menos de 1.5 goles en 1T");

  // "más" en minúscula (va después del equipo) se mantiene en minúscula
  assert.equal(opuesto("Local más de 2.5 corners"), "Local menos de 2.5 corners");

  // dar la vuelta dos veces devuelve el original
  for (const m of ["Más de 9.5 corners", "Local menos de 1.5 goles", "Menos de 3.5 tarjetas"]) {
    assert.equal(opuesto(opuesto(m)), m);
  }

  // los mercados sin línea no tienen contraparte que mostrar
  for (const m of ["Local", "Empate", "Ambos anotan", "Messi anota", "Descanso/Final: Local/Visita", "Gol en ambos tiempos"]) {
    assert.equal(opuesto(m), null);
  }
});
