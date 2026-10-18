// Generación y armado de los 2 parlays de un partido: Factible (5 selecciones) y Soñador (buen pago).
// Funciona como cliente directo o fallback si el caché local del usuario no incluye aún p.resumen.parlays.
import { nombreMercado } from "./mercados.js";

export const ETIQUETAS_CATEGORIA = {
  resultado: "Resultado",
  goles: "Goles",
  equipoLocal: "Goles Local",
  equipoVisita: "Goles Visita",
  tiempos: "Tiempos",
  corners: "Corners",
  tarjetas: "Tarjetas",
  tirosPuerta: "Tiros a puerta",
  tiros: "Tiros",
  jugadores: "Jugador",
};

export function obtenerCandidatosPartido(p) {
  const { local: L, visita: V } = p;
  const modelo = p.modelo ?? p.probs;
  const candidatos = [];

  const agregar = (categoria, mercado, prob, infoExtra = {}) => {
    if (prob == null || isNaN(prob) || prob <= 0) return;
    const cuotaCasa = p.mercado?.[mercado]?.cuota ?? null;
    const cuota = cuotaCasa ?? (prob > 0.01 ? 1 / prob : 1);
    const modProb = modelo?.[mercado] ?? prob;
    const ventaja = cuotaCasa ? modProb - p.mercado[mercado].prob : 0;
    candidatos.push({
      partidoId: p.id,
      partido: p.titulo,
      fecha: p.fecha,
      mercado,
      nombre: nombreMercado(mercado, p),
      categoria,
      prob,
      cuota,
      cuotaCasa,
      ventaja,
      esValor: ventaja >= 0.03 && prob * cuota > 1,
      ...infoExtra,
    });
  };

  // 1. Categoría resultado (1X2 y Doble Oportunidad)
  for (const m of ["Local o empate", "Visita o empate", "Hay ganador (sin empate)", "Local", "Visita", "Empate"]) {
    if (p.probs?.[m] != null) agregar("resultado", m, p.probs[m]);
  }

  // 2. Categoría goles (totales y ambos anotan)
  for (const m of [
    "Más de 0.5 goles", "Más de 1.5 goles", "Más de 2.5 goles", "Más de 3.5 goles",
    "Menos de 2.5 goles", "Menos de 3.5 goles", "Menos de 4.5 goles",
    "Ambos anotan", "No ambos anotan",
  ]) {
    if (p.probs?.[m] != null) agregar("goles", m, p.probs[m]);
  }

  // 3. Categoría equipoLocal
  for (const l of [0.5, 1.5, 2.5]) {
    if (p.probs?.[`Local más de ${l} goles`] != null) agregar("equipoLocal", `Local más de ${l} goles`, p.probs[`Local más de ${l} goles`]);
    if (p.probs?.[`Local menos de ${l} goles`] != null) agregar("equipoLocal", `Local menos de ${l} goles`, p.probs[`Local menos de ${l} goles`]);
  }

  // 4. Categoría equipoVisita
  for (const l of [0.5, 1.5, 2.5]) {
    if (p.probs?.[`Visita más de ${l} goles`] != null) agregar("equipoVisita", `Visita más de ${l} goles`, p.probs[`Visita más de ${l} goles`]);
    if (p.probs?.[`Visita menos de ${l} goles`] != null) agregar("equipoVisita", `Visita menos de ${l} goles`, p.probs[`Visita menos de ${l} goles`]);
  }

  // 5. Categoría tiempos
  if (p.extras?.tiempos?.probs) {
    for (const [m, prob] of Object.entries(p.extras.tiempos.probs)) {
      agregar("tiempos", m, prob);
    }
  }

  // 6. Categorías de conteo (corners, tarjetas, tirosPuerta, tiros)
  for (const cat of ["corners", "tarjetas", "tirosPuerta", "tiros"]) {
    if (p.extras?.[cat]?.probs) {
      for (const [m, prob] of Object.entries(p.extras[cat].probs)) {
        agregar(cat, m, prob);
      }
    }
  }

  // 7. Categoría jugadores
  for (const [lado, e] of [["local", L], ["visita", V]]) {
    for (const j of p.goleadores?.[lado] ?? []) {
      if (j.puerta1 != null) agregar("jugadores", `${j.nombre} 1+ tiros a puerta`, j.puerta1, { jugador: j.nombre, equipoLado: lado });
      if (j.prob != null) agregar("jugadores", `${j.nombre} anota`, j.prob, { jugador: j.nombre, equipoLado: lado });
      if (j.tiros2 != null) agregar("jugadores", `${j.nombre} 2+ tiros`, j.tiros2, { jugador: j.nombre, equipoLado: lado });
    }
  }

  return candidatos;
}

export function sonCompatibles(c, elegidas) {
  for (const e of elegidas) {
    if (c.categoria === e.categoria) return false;
    if (c.mercado === e.mercado) return false;

    // Resultado vs Goles de equipo
    if ((e.mercado === "Local" || e.mercado === "Local o empate") && (c.mercado === "Local menos de 0.5 goles" || c.mercado === "Local menos de 1.5 goles")) return false;
    if ((c.mercado === "Local" || c.mercado === "Local o empate") && (e.mercado === "Local menos de 0.5 goles" || e.mercado === "Local menos de 1.5 goles")) return false;
    if ((e.mercado === "Visita" || e.mercado === "Visita o empate") && (c.mercado === "Visita menos de 0.5 goles" || c.mercado === "Visita menos de 1.5 goles")) return false;
    if ((c.mercado === "Visita" || c.mercado === "Visita o empate") && (e.mercado === "Visita menos de 0.5 goles" || e.mercado === "Visita menos de 1.5 goles")) return false;

    // Ganador directo vs Muchos goles del rival
    if (e.mercado === "Local" && (c.mercado === "Visita más de 1.5 goles" || c.mercado === "Visita más de 2.5 goles")) return false;
    if (c.mercado === "Local" && (e.mercado === "Visita más de 1.5 goles" || e.mercado === "Visita más de 2.5 goles")) return false;
    if (e.mercado === "Visita" && (c.mercado === "Local más de 1.5 goles" || c.mercado === "Local más de 2.5 goles")) return false;
    if (c.mercado === "Visita" && (e.mercado === "Local más de 1.5 goles" || e.mercado === "Local más de 2.5 goles")) return false;

    // Goles Totales vs Ambos Anotan / Tiempos
    if (e.mercado === "Menos de 2.5 goles" || e.mercado === "Menos de 1.5 goles") {
      if (c.mercado === "Ambos anotan" || c.mercado === "Gol en ambos tiempos" || c.mercado === "Más de 1.5 goles en 1T" || c.mercado === "Más de 1.5 goles en 2T") return false;
    }
    if (c.mercado === "Menos de 2.5 goles" || c.mercado === "Menos de 1.5 goles") {
      if (e.mercado === "Ambos anotan" || e.mercado === "Gol en ambos tiempos" || e.mercado === "Más de 1.5 goles en 1T" || e.mercado === "Más de 1.5 goles en 2T") return false;
    }

    if (e.mercado.startsWith("Más de") && (c.mercado === "Menos de 0.5 goles en 1T" || c.mercado === "Menos de 0.5 goles en 2T")) return false;
    if (c.mercado.startsWith("Más de") && (e.mercado === "Menos de 0.5 goles en 1T" || e.mercado === "Menos de 0.5 goles en 2T")) return false;

    // Goles de equipo vs Jugador anota
    if (e.mercado === "Local menos de 0.5 goles" && c.categoria === "jugadores" && c.equipoLado === "local" && c.mercado.endsWith("anota")) return false;
    if (c.mercado === "Local menos de 0.5 goles" && e.categoria === "jugadores" && e.equipoLado === "local" && e.mercado.endsWith("anota")) return false;
    if (e.mercado === "Visita menos de 0.5 goles" && c.categoria === "jugadores" && c.equipoLado === "visita" && c.mercado.endsWith("anota")) return false;
    if (c.mercado === "Visita menos de 0.5 goles" && e.categoria === "jugadores" && e.equipoLado === "visita" && e.mercado.endsWith("anota")) return false;
  }
  return true;
}

export function armarParlayFactible(candidatos) {
  const CONFIANZA_CAT = { goles: 1.0, resultado: 1.0, equipoLocal: 0.96, equipoVisita: 0.96, tiempos: 0.96, corners: 0.94, tirosPuerta: 0.93, tarjetas: 0.90, jugadores: 0.88, tiros: 0.85 };

  let pool = candidatos.filter((c) => c.prob >= 0.62 && c.prob <= 0.88);
  if (pool.length < 5) {
    pool = candidatos.filter((c) => c.prob >= 0.56 && c.prob <= 0.92);
  }

  pool.sort((a, b) => {
    const scoreA = a.prob * (CONFIANZA_CAT[a.categoria] ?? 0.9);
    const scoreB = b.prob * (CONFIANZA_CAT[b.categoria] ?? 0.9);
    return scoreB - scoreA;
  });

  const elegidas = [];
  for (const c of pool) {
    if (sonCompatibles(c, elegidas)) {
      elegidas.push(c);
      if (elegidas.length === 5) break;
    }
  }

  if (elegidas.length < 5) {
    for (const c of candidatos.sort((a, b) => b.prob - a.prob)) {
      if (c.prob >= 0.48 && sonCompatibles(c, elegidas)) {
        elegidas.push(c);
        if (elegidas.length === 5) break;
      }
    }
  }

  if (elegidas.length < 5) return null;

  const prob = elegidas.reduce((a, x) => a * x.prob, 1);
  const cuotaCasa = elegidas.every((x) => x.cuotaCasa)
    ? elegidas.reduce((a, x) => a * x.cuotaCasa, 1)
    : elegidas.reduce((a, x) => a * x.cuota, 1);

  return {
    tipo: "factible",
    titulo: "Parlay Factible (5 selecciones)",
    descripcion: "Las 5 selecciones más factibles y compatibles de este partido. Paga moderado con el menor riesgo posible.",
    piernas: elegidas,
    prob,
    cuotaJusta: 1 / prob,
    cuotaCasa,
  };
}

export function armarParlaySonador(candidatos) {
  const pool = candidatos.filter((c) => (c.prob >= 0.45 && c.prob <= 0.70 && c.cuota >= 1.55) || (c.esValor && c.prob >= 0.42));

  pool.sort((a, b) => {
    const scoreA = a.prob * Math.min(2.5, a.cuota) * (1 + Math.max(0, a.ventaja * 2));
    const scoreB = b.prob * Math.min(2.5, b.cuota) * (1 + Math.max(0, b.ventaja * 2));
    return scoreB - scoreA;
  });

  const elegidas = [];
  for (const c of pool) {
    if (sonCompatibles(c, elegidas)) {
      elegidas.push(c);
      if (elegidas.length === 5) break;
    }
  }

  if (elegidas.length < 4) {
    const ampliado = candidatos.filter((c) => c.prob >= 0.40 && c.cuota >= 1.48);
    ampliado.sort((a, b) => b.prob * b.cuota - a.prob * a.cuota);
    for (const c of ampliado) {
      if (sonCompatibles(c, elegidas)) {
        elegidas.push(c);
        if (elegidas.length >= 4) break;
      }
    }
  }

  if (elegidas.length < 3) return null;

  const prob = elegidas.reduce((a, x) => a * x.prob, 1);
  const cuotaCasa = elegidas.every((x) => x.cuotaCasa)
    ? elegidas.reduce((a, x) => a * x.cuotaCasa, 1)
    : elegidas.reduce((a, x) => a * x.cuota, 1);

  return {
    tipo: "sonador",
    titulo: "Parlay Soñador",
    descripcion: `${elegidas.length} selecciones con excelente pago. Opciones factibles (más de 45% de prob.) algo más riesgosas para multiplicar el retorno.`,
    piernas: elegidas,
    prob,
    cuotaJusta: 1 / prob,
    cuotaCasa,
  };
}

export function armarParlaysPartido(p) {
  if (!p) return null;
  const candidatos = obtenerCandidatosPartido(p);
  return {
    factible: armarParlayFactible(candidatos),
    sonador: armarParlaySonador(candidatos),
  };
}
