// ¿Se cumplió la predicción? Compara un mercado del prepartido con el marcador y las estadísticas.
// v: { estado: "in" | "post", local, visita (goles, corners, tirosPuerta, tiros), eventos[] }
// Devuelve "si" (cumplida), "no" (fallida), "pendiente" (aún no se decide) o null (no se puede medir).
const CONTEO = { corners: "corners", tarjetas: "tarjetas", "tiros a puerta": "tirosPuerta", tiros: "tiros" };

// "45'+2'" -> 1T; "67'" -> 2T
const tiempoDe = (minuto) => (parseInt(minuto, 10) <= 45 ? 1 : 2);

export function evaluar(mercado, v) {
  const fin = v.estado === "post";
  const gl = v.local.goles, gv = v.visita.goles;
  const tarjetas = (local) => v.eventos.filter((e) => (e.tipo === "amarilla" || e.tipo === "roja") && (local == null || e.local === local)).length;
  const goles = (local, t) => v.eventos.filter((e) => (e.tipo === "gol" || e.tipo === "autogol") && (local == null || e.local === local) && (t == null || tiempoDe(e.minuto) === t)).length;
  const alFinal = (ok) => (fin ? (ok ? "si" : "no") : "pendiente");
  // "más de X": se cumple en cuanto se pasa; "menos de X": falla en cuanto se pasa
  // cerrado: ya no puede cambiar (fin del partido, o del 1T para mercados del primer tiempo)
  const linea = (valor, mas, x, cerrado = fin) => (mas ? (valor > x ? "si" : cerrado ? "no" : "pendiente") : valor > x ? "no" : cerrado ? "si" : "pendiente");

  switch (mercado) {
    case "Local": return alFinal(gl > gv);
    case "Empate": return alFinal(gl === gv);
    case "Visita": return alFinal(gl < gv);
    case "Local o empate": return alFinal(gl >= gv);
    case "Visita o empate": return alFinal(gl <= gv);
    case "Hay ganador (sin empate)": return alFinal(gl !== gv);
    case "Ambos anotan": return gl > 0 && gv > 0 ? "si" : fin ? "no" : "pendiente";
    case "No ambos anotan": return gl > 0 && gv > 0 ? "no" : fin ? "si" : "pendiente";
    case "Gol en ambos tiempos": {
      const g1 = goles(null, 1), g2 = goles(null, 2);
      if (g1 > 0 && g2 > 0) return "si";
      const paso1T = fin || v.descanso || v.jugado >= 45;
      if (paso1T && g1 === 0) return "no";
      return fin ? "no" : "pendiente";
    }
    case "Empate al descanso": {
      const g1L = goles(true, 1), g1V = goles(false, 1);
      const cerrado = fin || v.descanso || v.jugado >= 45;
      return cerrado ? (g1L === g1V ? "si" : "no") : "pendiente";
    }
  }

  let m = mercado.match(/^(Local|Visita) anota en ([12])T$/);
  if (m) {
    const lado = m[1] === "Local";
    const t = Number(m[2]);
    const g = goles(lado, t);
    const cerrado = fin || (t === 1 && (v.descanso || v.jugado >= 45));
    return g > 0 ? "si" : cerrado ? "no" : "pendiente";
  }

  m = mercado.match(/^(Local |Visita )?(Más|más|Menos|menos) de ([\d.]+) goles( en ([12])T)?$/);
  if (m) {
    const lado = m[1] ? m[1].trim() === "Local" : null;
    const t = m[5] ? Number(m[5]) : null;
    // con el marcador cuando se puede; por tiempo, con los goles registrados
    const valor = t ? goles(lado, t) : lado == null ? gl + gv : lado ? gl : gv;
    const cerrado = fin || (t === 1 && (v.descanso || v.jugado >= 45));
    return linea(valor, /más/i.test(m[2]), Number(m[3]), cerrado);
  }
  m = mercado.match(/^(Local |Visita )?(Más|más|Menos|menos) de ([\d.]+) (corners|tarjetas|tiros a puerta|tiros)$/);
  if (m) {
    const lado = m[1] ? m[1].trim() === "Local" : null;
    const valor = m[4] === "tarjetas" ? tarjetas(lado) : lado == null ? v.local[CONTEO[m[4]]] + v.visita[CONTEO[m[4]]] : (lado ? v.local : v.visita)[CONTEO[m[4]]];
    return linea(valor, /más/i.test(m[2]), Number(m[3]));
  }
  m = mercado.match(/^(.+) anota$/);
  if (m) return v.eventos.some((e) => e.tipo === "gol" && e.jugador === m[1]) ? "si" : fin ? "no" : "pendiente";
  return null; // tiros por jugador, descanso/final, etc.: ESPN no da el dato en vivo
}

// Para la barra de progreso: en los mercados con línea devuelve cuánto va y cuánto se necesita.
// { valor, linea, mas } o null si el mercado no es de conteo (resultado, ambos anotan, etc.).
export function progreso(mercado, v) {
  const tarjetas = (local) => v.eventos.filter((e) => (e.tipo === "amarilla" || e.tipo === "roja") && (local == null || e.local === local)).length;
  const goles = (local, t) => v.eventos.filter((e) => (e.tipo === "gol" || e.tipo === "autogol") && (local == null || e.local === local) && (t == null || tiempoDe(e.minuto) === t)).length;

  let m = mercado.match(/^(Local |Visita )?(Más|más|Menos|menos) de ([\d.]+) goles( en ([12])T)?$/);
  if (m) {
    const lado = m[1] ? m[1].trim() === "Local" : null;
    const t = m[5] ? Number(m[5]) : null;
    const valor = t ? goles(lado, t) : lado == null ? v.local.goles + v.visita.goles : lado ? v.local.goles : v.visita.goles;
    return { valor, linea: Number(m[3]), mas: /más/i.test(m[2]) };
  }
  m = mercado.match(/^(Local |Visita )?(Más|más|Menos|menos) de ([\d.]+) (corners|tarjetas|tiros a puerta|tiros)$/);
  if (m) {
    const lado = m[1] ? m[1].trim() === "Local" : null;
    const valor = m[4] === "tarjetas" ? tarjetas(lado) : lado == null ? v.local[CONTEO[m[4]]] + v.visita[CONTEO[m[4]]] : (lado ? v.local : v.visita)[CONTEO[m[4]]];
    return { valor, linea: Number(m[3]), mas: /más/i.test(m[2]) };
  }
  return null;
}

export function evaluarParlay(parlay, vivo) {
  if (!parlay?.piernas?.length || !vivo) return parlay;
  const piernas = parlay.piernas.map((x) => ({
    ...x,
    estadoVivo: evaluar(x.mercado, vivo),
    progreso: progreso(x.mercado, vivo),
  }));
  const algunFallo = piernas.some((x) => x.estadoVivo === "no");
  // las piernas que ESPN no deja medir (tiros por jugador, descanso/final) no bloquean el veredicto
  const medibles = piernas.filter((x) => x.estadoVivo);
  const todasCumplidas = medibles.length > 0 && medibles.every((x) => x.estadoVivo === "si");
  const estadoGeneral = algunFallo ? "no" : todasCumplidas ? "si" : "pendiente";
  return {
    ...parlay,
    piernas,
    estadoGeneral,
  };
}

