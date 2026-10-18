import test from "node:test";
import assert from "node:assert/strict";
import { evaluar, evaluarParlay, progreso } from "./evaluar.js";

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
  const ev = [
    { tipo: "gol", minuto: "40'", local: true, jugador: "Pérez" },
    { tipo: "gol", minuto: "70'", local: false, jugador: "Gómez" },
    { tipo: "amarilla", minuto: "50'", local: false, jugador: "X" },
  ];
  assert.equal(evaluar("Pérez anota", v("in", 1, 1, { eventos: ev })), "si");
  assert.equal(evaluar("Hernández anota", v("post", 1, 1, { eventos: ev })), "no");
  assert.equal(evaluar("Más de 0.5 tarjetas", v("in", 1, 1, { eventos: ev })), "si");
  assert.equal(evaluar("Más de 0.5 goles en 1T", v("in", 1, 1, { eventos: ev })), "si");
  assert.equal(evaluar("Más de 1.5 goles en 1T", v("in", 1, 1, { eventos: ev })), "no"); // ya va el 2T con solo 1 gol en 1T
  assert.equal(evaluar("Gol en ambos tiempos", v("in", 1, 1, { eventos: ev })), "si");
  assert.equal(evaluar("Local anota en 1T", v("in", 1, 1, { eventos: ev })), "si");
  assert.equal(evaluar("Visita anota en 1T", v("in", 1, 1, { eventos: ev })), "no");
  assert.equal(evaluar("Empate al descanso", v("in", 1, 1, { eventos: ev })), "no");
  assert.equal(evaluar("Pérez 2+ tiros", v("in", 1, 0)), null);
});

test("evaluarParlay: sigue vivo, se cae o se cobra", () => {
  const parlay = {
    tipo: "factible",
    piernas: [
      { mercado: "Más de 0.5 goles" },
      { mercado: "Más de 8.5 corners" },
      { mercado: "Local o empate" },
    ],
  };

  // Partido en juego: 2 cumplidas, 1 pendiente -> general pendiente (sigue vivo)
  const vivoEnJuego = v("in", 1, 0); // 4+5 corners = 9 corners
  const res1 = evaluarParlay(parlay, vivoEnJuego);
  assert.equal(res1.estadoGeneral, "pendiente");
  assert.equal(res1.piernas[0].estadoVivo, "si");
  assert.equal(res1.piernas[1].estadoVivo, "si");
  assert.equal(res1.piernas[2].estadoVivo, "pendiente");

  // Partido post con derrota local -> se cae
  const vivoPostPerdio = v("post", 0, 1);
  const res2 = evaluarParlay(parlay, vivoPostPerdio);
  assert.equal(res2.estadoGeneral, "no");
  assert.equal(res2.piernas[2].estadoVivo, "no");

  // Partido post con victoria local -> se cobra
  const vivoPostGano = v("post", 2, 0);
  const res3 = evaluarParlay(parlay, vivoPostGano);
  assert.equal(res3.estadoGeneral, "si");
});


test("progreso: valor actual y línea para la barra", () => {
  const partido = v("in", 2, 1, {
    eventos: [
      { tipo: "amarilla", local: true, minuto: "20'" },
      { tipo: "amarilla", local: false, minuto: "35'" },
      { tipo: "gol", local: true, minuto: "10'" },
    ],
  });

  // goles del partido: 2+1 = 3
  assert.deepEqual(progreso("Más de 2.5 goles", partido), { valor: 3, linea: 2.5, mas: true });
  // goles de un solo equipo
  assert.deepEqual(progreso("Local más de 1.5 goles", partido), { valor: 2, linea: 1.5, mas: true });
  // "menos de" marca mas:false para que la barra apunte hacia abajo
  assert.deepEqual(progreso("Visita menos de 2.5 goles", partido), { valor: 1, linea: 2.5, mas: false });
  // corners: 4 local + 5 visita
  assert.deepEqual(progreso("Más de 8.5 corners", partido), { valor: 9, linea: 8.5, mas: true });
  // tarjetas salen de los eventos, no del marcador
  assert.deepEqual(progreso("Más de 1.5 tarjetas", partido), { valor: 2, linea: 1.5, mas: true });
  // tiros a puerta de un equipo
  assert.deepEqual(progreso("Local más de 2.5 tiros a puerta", partido), { valor: 3, linea: 2.5, mas: true });

  // los mercados sin línea no llevan barra
  assert.equal(progreso("Ambos anotan", partido), null);
  assert.equal(progreso("Local", partido), null);
  assert.equal(progreso("Local anota en 2T", partido), null);
});
