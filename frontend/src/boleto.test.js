import test from "node:test";
import assert from "node:assert/strict";
import { analizarBoleto, probManual } from "./boleto.js";

test("boleto vacío no se analiza", () => {
  assert.equal(analizarBoleto([]), null);
});

test("probabilidad = producto, valor esperado con momio de la casa", () => {
  const b = analizarBoleto(
    [
      { partidoId: "1", partido: "A vs B", mercado: "Local", prob: 0.5 },
      { partidoId: "2", partido: "C vs D", mercado: "Más de 1.5 goles", prob: 0.8 },
    ],
    { monto: 15, momio: 3 },
  );
  assert.ok(Math.abs(b.prob - 0.4) < 1e-12);
  assert.ok(Math.abs(b.valorEsperado - 0.2) < 1e-12);
  assert.equal(b.retorno, 45);
  assert.ok(b.alertas.some((a) => a.includes("Mayor riesgo")));
});

test("momio irreal contra la cuota justa genera alerta, no 'valor'", () => {
  const b = analizarBoleto([{ partidoId: "1", partido: "A vs B", mercado: "Local", prob: 0.5 }], { momio: 6 });
  assert.ok(b.alertas.some((a) => a.includes("mucho mayor que la cuota justa")));
  assert.ok(!b.balance.some((x) => x.includes("paga más de lo justo")));
});

test("detecta momios microscópicos, partidos repetidos y selecciones manuales", () => {
  const b = analizarBoleto([
    { partidoId: "1", partido: "A vs B", mercado: "Más de 0.5 goles", prob: 0.95 },
    { partidoId: "1", partido: "A vs B", mercado: "Menos de 6.5 goles", prob: 0.99 },
    { partidoId: "2", partido: "C vs D", mercado: "Corners +8.5", prob: probManual(1.5), manual: true },
  ]);
  assert.ok(b.balance.some((x) => x.includes("microscópicos")));
  assert.ok(b.alertas.some((x) => x.includes("varias selecciones")));
  assert.ok(b.alertas.some((x) => x.includes("sin modelo")));
  assert.equal(b.cuotaCasa, null);
});
