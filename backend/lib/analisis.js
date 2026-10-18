// Análisis en texto de un partido: puntos fuertes, alertas y balance, a partir del modelo y los datos.
import { seleccionSugerida, esValor } from './modelo.js';

const pct = p => `${Math.round(p * 100)}%`;

const ETIQUETA = { tiempos: 'Tiempos', corners: 'Corners', tarjetas: 'Tarjetas', tirosPuerta: 'Tiros a puerta', tiros: 'Tiros' };

// Lo primero que se muestra: la de valor y lo más recomendable entre todos los mercados.
function destacadas(p) {
  const modelo = p.modelo ?? p.probs;
  const valor = Object.entries(p.mercado)
    .map(([m, c]) => ({ mercado: m, prob: p.probs[m], cuota: c.cuota, ventaja: modelo[m] - c.prob }))
    .filter(esValor)
    .sort((a, b) => b.ventaja - a.ventaja)[0] ?? null;
  return {
    valor,
    lista: recomendadasPartido(p),
  };
}

// Qué tan confiable es cada tipo de mercado: goles va ajustado a lo que pagan las casas; tarjetas
// dependen mucho del árbitro y los jugadores de la alineación. Tiros totales pesa poco: cada casa
// los cuenta distinto (algunas no cuentan bloqueados) y ESPN no da los tiros dentro del área.
const CONFIANZA = { goles: 1, tiempos: 0.97, corners: 0.95, tirosPuerta: 0.94, tarjetas: 0.9, jugadores: 0.88, tiros: 0.85 };
const MIN_PROB = 0.6, MAX_PROB = 0.85; // abajo falla mucho; arriba paga menos de 1.18

const uno = x => x.toFixed(1);

// Lo más recomendable de ESTE partido entre todos los mercados, una opción por tipo, con su razón.
export function recomendadasPartido(p, max = 5) {
  const { local: L, visita: V } = p;
  const nombre = m => m.replace(/\bLocal\b/g, L.nombre).replace(/\bVisita\b/g, V.nombre);
  const fL = p.forma?.local, fV = p.forma?.visita;
  const favL = p.probs.Local >= p.probs.Visita;
  const fav = favL ? L : V, pFav = Math.max(p.probs.Local, p.probs.Visita);
  const domina = pFav >= 0.55 ? ` ${fav.nombre} domina el partido (gana ${pct(pFav)}): suele cargar el ataque.` : '';

  const candidatos = [];
  const agregar = (categoria, probs, razon) => {
    for (const [m, prob] of Object.entries(probs)) {
      if (prob >= MIN_PROB && prob <= MAX_PROB) candidatos.push({ categoria, mercado: m, prob, puntaje: prob * CONFIANZA[categoria], razon: razon(m) });
    }
  };

  const xg = p.golesEsperados;
  agregar('goles', p.probs, m => {
    const c = p.mercado[m];
    if (c) return `Las casas lo pagan a ${c.cuota.toFixed(2)}: lo ven factible (${pct(c.prob)}).`;
    return `Se esperan ${uno(xg.local + xg.visita)} goles (${L.nombre} ${uno(xg.local)}, ${V.nombre} ${uno(xg.visita)}), ${p.ajustadoACasas ? 'ajustado a lo que pagan las casas' : 'solo con estadística (sin cuotas de casas)'}.`;
  });

  for (const [cat, e] of Object.entries(p.extras ?? {})) {
    agregar(cat, e.probs, () => {
      if (cat === 'tiempos') return `${pct(e.fraccion)} de los goles de estos equipos cae en el 1T; se esperan ${uno(e.esperado.local + e.esperado.visita)} antes del descanso.`;
      const n = { corners: 'corners', tarjetas: 'tarjetas', tirosPuerta: 'tiros a puerta', tiros: 'tiros' }[cat];
      const total = `Se esperan ${uno(e.esperado.local + e.esperado.visita)} ${n}`;
      const base = fL?.favor && fV?.favor
        ? `${total}: ${L.nombre} genera ${uno(fL.favor[cat])} y ${V.nombre} ${uno(fV.favor[cat])} por partido; conceden ${uno(fL.contra[cat])} y ${uno(fV.contra[cat])}.`
        : `${total} según sus últimos partidos.`;
      return cat === 'corners' || cat === 'tiros' ? base + domina : base;
    });
  }

  for (const [lado, e] of [['local', L], ['visita', V]]) {
    for (const j of p.goleadores?.[lado] ?? []) {
      const razon = `${j.nombre} (${e.nombre}): ${j.tiros} tiros, ${j.tirosPuerta} a puerta y ${j.goles} goles en sus últimos ${j.partidos} partidos.`;
      const props = { [`${j.nombre} anota`]: j.prob, [`${j.nombre} 1+ tiros a puerta`]: j.puerta1, [`${j.nombre} 2+ tiros`]: j.tiros2, [`${j.nombre} 2+ tiros a puerta`]: j.puerta2, [`${j.nombre} 3+ tiros`]: j.tiros3 };
      agregar('jugadores', Object.fromEntries(Object.entries(props).filter(([, v]) => v != null)), () => razon);
    }
  }

  // La mejor de cada tipo, ordenadas por probabilidad × confianza
  const mejorPorTipo = {};
  for (const c of candidatos.sort((a, b) => b.puntaje - a.puntaje)) mejorPorTipo[c.categoria] ??= c;
  return Object.values(mejorPorTipo)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, max)
    .map(({ puntaje, ...c }) => ({ ...c, nombre: nombre(c.mercado), cuota: c.categoria === 'goles' ? p.mercado[c.mercado]?.cuota ?? null : null }));
}

// p: partido ya analizado (probs, modelo, mercado, golesEsperados, local, visita, noticias, casa, extras, forma, alineacion)
export function resumenPartido(p) {
  const fuertes = [];
  const alertas = [];
  const datos = [];
  const { local: L, visita: V, probs } = p;
  const xg = p.golesEsperados.local + p.golesEsperados.visita;
  const nombre = m => m.replace(/\bLocal\b/g, L.nombre).replace(/\bVisita\b/g, V.nombre); // "Visita menos de 2.5" -> "Atlas menos de 2.5"

  const favL = probs.Local >= probs.Visita;
  const fav = favL ? L : V, debil = favL ? V : L;
  const pFav = favL ? probs.Local : probs.Visita;
  const dobleFav = favL ? probs['Local o empate'] : probs['Visita o empate'];

  if (pFav >= 0.55) {
    const valor = fav.valor && debil.valor && fav.valor > debil.valor * 1.5
      ? `; su plantilla vale ${(fav.valor / debil.valor).toFixed(1)} veces más` : '';
    fuertes.push(`${fav.nombre} es favorito claro: gana en ${pct(pFav)} de los casos${valor}.`);
  }
  if (dobleFav >= 0.75) fuertes.push(`Doble oportunidad ${fav.nombre} o empate cubre ${pct(dobleFav)}.`);
  if (xg >= 3) fuertes.push(`Partido de goles: se esperan ${xg.toFixed(1)} goles; Más de 1.5 en ${pct(probs['Más de 1.5 goles'])}.`);
  else if (xg <= 2.3) fuertes.push(`Partido cerrado: se esperan ${xg.toFixed(1)} goles; Menos de 3.5 en ${pct(probs['Menos de 3.5 goles'])}.`);

  // Cuota baja = las casas lo ven factible.
  const factibles = Object.entries(p.mercado).filter(([, c]) => c.prob >= 0.6).sort((a, b) => b[1].prob - a[1].prob);
  for (const [m, c] of factibles) {
    fuertes.push(`Las casas pagan poco por "${nombre(m)}" (cuota ${c.cuota.toFixed(2)}${c.mejorCasa ? ` en ${c.mejorCasa}` : ''}): lo ven factible, ${pct(c.prob)}.`);
  }
  const modelo = p.modelo ?? probs; // estadística pura, sin ajustar a las casas
  for (const [m, c] of Object.entries(p.mercado)) {
    const dif = modelo[m] - c.prob;
    if (dif >= 0.03 && dif <= 0.12) fuertes.push(`Posible valor: la estadística da a "${nombre(m)}" ${pct(modelo[m])} y las casas ${pct(c.prob)}.`);
    if (Math.abs(dif) > 0.12) alertas.push(`La estadística y las casas no coinciden en "${nombre(m)}" (${pct(modelo[m])} vs ${pct(c.prob)}): las casas pueden saber algo (bajas, rotaciones). Se confió más en las casas.`);
  }
  if (!Object.keys(p.mercado).length) alertas.push('Sin cuotas de casas para este partido: la probabilidad sale solo de la estadística.');

  if (Math.abs(probs.Local - probs.Visita) < 0.1) {
    alertas.push(`Partido parejo: el empate ronda ${pct(probs.Empate)}. Apostar a un ganador directo es riesgoso.`);
  }
  for (const e of [L, V]) {
    if ((e.pj ?? 0) < 4) alertas.push(`${e.nombre} lleva pocos partidos (${e.pj ?? 0}): el modelo se apoya en el promedio de la liga.`);
    if (e.valor == null) alertas.push(`Sin valor de plantilla de ${e.nombre} (recién ascendido o sin datos).`);
  }
  for (const [lado, e] of [['local', L], ['visita', V]]) {
    const r = p.forma?.[lado]?.resultados ?? [];
    if (!r.length) continue;
    const g = r.filter(x => x.resultado === 'W').length, pe = r.filter(x => x.resultado === 'L').length;
    if (g >= 4) fuertes.push(`${e.nombre} ganó ${g} de sus últimos ${r.length} partidos.`);
    if (pe >= 3) alertas.push(`${e.nombre} perdió ${pe} de sus últimos ${r.length} partidos.`);
  }
  for (const [cat, x] of Object.entries(p.extras ?? {})) {
    if (cat === 'tiempos') {
      datos.push(`Tiempos: ${pct(x.fraccion)} de los goles de estos equipos cae en el 1T; se esperan ${(x.esperado.local + x.esperado.visita).toFixed(1)} goles antes del descanso.`);
      continue;
    }
    datos.push(`${ETIQUETA[cat]}: se esperan ${(x.esperado.local + x.esperado.visita).toFixed(1)} (${L.nombre} ${x.esperado.local.toFixed(1)}, ${V.nombre} ${x.esperado.visita.toFixed(1)}), según sus últimos partidos.`);
  }
  for (const [lado, e] of [['local', L], ['visita', V]]) {
    const g = p.goleadores?.[lado]?.[0];
    if (g) datos.push(`Más probable de anotar en ${e.nombre}: ${g.nombre} (${pct(g.prob)}; ${g.goles} goles y ${g.tiros} tiros en sus últimos partidos).`);
  }
  if (Object.keys(p.extras ?? {}).length <= 1) datos.push('Sin estadísticas suficientes de corners, tarjetas y tiros de estos equipos.');

  const horas = (new Date(p.fecha) - Date.now()) / 3600e3;
  const alin = p.alineacion ?? {};
  if (alin[L.id] && alin[V.id]) fuertes.push('Alineaciones confirmadas: las cuotas ya reflejan a los titulares.');
  else if (horas >= 0 && horas < 3) alertas.push('Faltan menos de 3 h y aún no hay alineaciones: revisa titulares antes de apostar, un cambio puede mover todo.');
  else datos.push(`Alineaciones: se publican ~1 h antes del partido. Actualiza cerca de la hora: si hay cambios, las cuotas se mueven y el análisis se ajusta.`);

  const bajas = p.noticias.filter(n => n.alerta).length;
  if (bajas) alertas.push(`${bajas} noticia(s) de posibles bajas o lesiones: revisa alineaciones antes de apostar.`);

  const s = seleccionSugerida(probs);
  const balance = s
    ? `Selección sugerida: ${nombre(s.mercado)} (${pct(s.prob)}, cuota justa ${(1 / s.prob).toFixed(2)}). ${alertas.length > 2 ? 'Hay varias alertas: úsala con cautela.' : ''}`.trim()
    : 'Sin una selección clara entre 60% y 85%: mejor dejar este partido fuera del parlay.';

  const d = destacadas(p);
  const confirmadas = Boolean(alin[L.id] && alin[V.id]);
  const parlays = armarParlaysPartido(p);
  return { destacadas: d, parlays, fuertes, alertas, datos, balance, sugerida: s, ...recomendacion(p, d, { horas, confirmadas, bajas, alertas }) };
}

export const ETIQUETAS_CATEGORIA = {
  resultado: 'Resultado',
  goles: 'Goles',
  equipoLocal: 'Goles Local',
  equipoVisita: 'Goles Visita',
  tiempos: 'Tiempos',
  corners: 'Corners',
  tarjetas: 'Tarjetas',
  tirosPuerta: 'Tiros a puerta',
  tiros: 'Tiros',
  jugadores: 'Jugador',
};

export function obtenerCandidatosPartido(p) {
  const { local: L, visita: V } = p;
  const nombre = m => m.replace(/\bLocal\b/g, L.nombre).replace(/\bVisita\b/g, V.nombre);
  const modelo = p.modelo ?? p.probs;
  const candidatos = [];

  const agregar = (categoria, mercado, prob, infoExtra = {}) => {
    if (prob == null || isNaN(prob) || prob <= 0) return;
    const cuotaCasa = p.mercado?.[mercado]?.cuota ?? null;
    const cuota = cuotaCasa ?? (prob > 0.01 ? 1 / prob : 1);
    const modProb = modelo[mercado] ?? prob;
    const ventaja = cuotaCasa ? modProb - p.mercado[mercado].prob : 0;
    candidatos.push({
      partidoId: p.id,
      partido: p.titulo,
      fecha: p.fecha,
      mercado,
      nombre: nombre(mercado),
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
  for (const m of ['Local o empate', 'Visita o empate', 'Hay ganador (sin empate)', 'Local', 'Visita', 'Empate']) {
    if (p.probs[m] != null) agregar('resultado', m, p.probs[m]);
  }

  // 2. Categoría goles (totales y ambos anotan)
  for (const m of [
    'Más de 0.5 goles', 'Más de 1.5 goles', 'Más de 2.5 goles', 'Más de 3.5 goles',
    'Menos de 2.5 goles', 'Menos de 3.5 goles', 'Menos de 4.5 goles',
    'Ambos anotan', 'No ambos anotan',
  ]) {
    if (p.probs[m] != null) agregar('goles', m, p.probs[m]);
  }

  // 3. Categoría equipoLocal
  for (const l of [0.5, 1.5, 2.5]) {
    if (p.probs[`Local más de ${l} goles`] != null) agregar('equipoLocal', `Local más de ${l} goles`, p.probs[`Local más de ${l} goles`]);
    if (p.probs[`Local menos de ${l} goles`] != null) agregar('equipoLocal', `Local menos de ${l} goles`, p.probs[`Local menos de ${l} goles`]);
  }

  // 4. Categoría equipoVisita
  for (const l of [0.5, 1.5, 2.5]) {
    if (p.probs[`Visita más de ${l} goles`] != null) agregar('equipoVisita', `Visita más de ${l} goles`, p.probs[`Visita más de ${l} goles`]);
    if (p.probs[`Visita menos de ${l} goles`] != null) agregar('equipoVisita', `Visita menos de ${l} goles`, p.probs[`Visita menos de ${l} goles`]);
  }

  // 5. Categoría tiempos
  if (p.extras?.tiempos?.probs) {
    for (const [m, prob] of Object.entries(p.extras.tiempos.probs)) {
      agregar('tiempos', m, prob);
    }
  }

  // 6. Categorías de conteo (corners, tarjetas, tirosPuerta, tiros)
  for (const cat of ['corners', 'tarjetas', 'tirosPuerta', 'tiros']) {
    if (p.extras?.[cat]?.probs) {
      for (const [m, prob] of Object.entries(p.extras[cat].probs)) {
        agregar(cat, m, prob);
      }
    }
  }

  // 7. Categoría jugadores
  for (const [lado, e] of [['local', L], ['visita', V]]) {
    for (const j of p.goleadores?.[lado] ?? []) {
      if (j.puerta1 != null) agregar('jugadores', `${j.nombre} 1+ tiros a puerta`, j.puerta1, { jugador: j.nombre, equipoLado: lado });
      if (j.prob != null) agregar('jugadores', `${j.nombre} anota`, j.prob, { jugador: j.nombre, equipoLado: lado });
      if (j.tiros2 != null) agregar('jugadores', `${j.nombre} 2+ tiros`, j.tiros2, { jugador: j.nombre, equipoLado: lado });
    }
  }

  return candidatos;
}

export function sonCompatibles(c, elegidas) {
  for (const e of elegidas) {
    // Máximo una selección por categoría
    if (c.categoria === e.categoria) return false;
    if (c.mercado === e.mercado) return false;

    // Resultado vs Goles de equipo
    if ((e.mercado === 'Local' || e.mercado === 'Local o empate') && (c.mercado === 'Local menos de 0.5 goles' || c.mercado === 'Local menos de 1.5 goles')) return false;
    if ((c.mercado === 'Local' || c.mercado === 'Local o empate') && (e.mercado === 'Local menos de 0.5 goles' || e.mercado === 'Local menos de 1.5 goles')) return false;
    if ((e.mercado === 'Visita' || e.mercado === 'Visita o empate') && (c.mercado === 'Visita menos de 0.5 goles' || c.mercado === 'Visita menos de 1.5 goles')) return false;
    if ((c.mercado === 'Visita' || c.mercado === 'Visita o empate') && (e.mercado === 'Visita menos de 0.5 goles' || e.mercado === 'Visita menos de 1.5 goles')) return false;

    // Ganador directo vs Muchos goles del rival
    if (e.mercado === 'Local' && (c.mercado === 'Visita más de 1.5 goles' || c.mercado === 'Visita más de 2.5 goles')) return false;
    if (c.mercado === 'Local' && (e.mercado === 'Visita más de 1.5 goles' || e.mercado === 'Visita más de 2.5 goles')) return false;
    if (e.mercado === 'Visita' && (c.mercado === 'Local más de 1.5 goles' || c.mercado === 'Local más de 2.5 goles')) return false;
    if (c.mercado === 'Visita' && (e.mercado === 'Local más de 1.5 goles' || e.mercado === 'Local más de 2.5 goles')) return false;

    // Goles Totales vs Ambos Anotan / Tiempos
    if (e.mercado === 'Menos de 2.5 goles' || e.mercado === 'Menos de 1.5 goles') {
      if (c.mercado === 'Ambos anotan' || c.mercado === 'Gol en ambos tiempos' || c.mercado === 'Más de 1.5 goles en 1T' || c.mercado === 'Más de 1.5 goles en 2T') return false;
    }
    if (c.mercado === 'Menos de 2.5 goles' || c.mercado === 'Menos de 1.5 goles') {
      if (e.mercado === 'Ambos anotan' || e.mercado === 'Gol en ambos tiempos' || e.mercado === 'Más de 1.5 goles en 1T' || e.mercado === 'Más de 1.5 goles en 2T') return false;
    }

    if (e.mercado.startsWith('Más de') && (c.mercado === 'Menos de 0.5 goles en 1T' || c.mercado === 'Menos de 0.5 goles en 2T')) return false;
    if (c.mercado.startsWith('Más de') && (e.mercado === 'Menos de 0.5 goles en 1T' || e.mercado === 'Menos de 0.5 goles en 2T')) return false;

    // Goles de equipo vs Jugador anota
    if (e.mercado === 'Local menos de 0.5 goles' && c.categoria === 'jugadores' && c.equipoLado === 'local' && c.mercado.endsWith('anota')) return false;
    if (c.mercado === 'Local menos de 0.5 goles' && e.categoria === 'jugadores' && e.equipoLado === 'local' && e.mercado.endsWith('anota')) return false;
    if (e.mercado === 'Visita menos de 0.5 goles' && c.categoria === 'jugadores' && c.equipoLado === 'visita' && c.mercado.endsWith('anota')) return false;
    if (c.mercado === 'Visita menos de 0.5 goles' && e.categoria === 'jugadores' && e.equipoLado === 'visita' && e.mercado.endsWith('anota')) return false;
  }
  return true;
}

export function armarParlayFactible(candidatos) {
  const CONFIANZA_CAT = { goles: 1.0, resultado: 1.0, equipoLocal: 0.96, equipoVisita: 0.96, tiempos: 0.96, corners: 0.94, tirosPuerta: 0.93, tarjetas: 0.90, jugadores: 0.88, tiros: 0.85 };

  let pool = candidatos.filter(c => c.prob >= 0.62 && c.prob <= 0.88);
  if (pool.length < 5) {
    pool = candidatos.filter(c => c.prob >= 0.56 && c.prob <= 0.92);
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
  const cuotaCasa = elegidas.every(x => x.cuotaCasa)
    ? elegidas.reduce((a, x) => a * x.cuotaCasa, 1)
    : elegidas.reduce((a, x) => a * x.cuota, 1);

  return {
    tipo: 'factible',
    titulo: 'Parlay Factible (5 selecciones)',
    descripcion: 'Las 5 selecciones más factibles y compatibles de este partido. Paga moderado con el menor riesgo posible.',
    piernas: elegidas,
    prob,
    cuotaJusta: 1 / prob,
    cuotaCasa,
  };
}

export function armarParlaySonador(candidatos) {
  // Opciones más factibles que riesgosas: prob >= 0.45 (o valor >= 0.42), con cuota atractiva (>= 1.55)
  const pool = candidatos.filter(c => (c.prob >= 0.45 && c.prob <= 0.70 && c.cuota >= 1.55) || (c.esValor && c.prob >= 0.42));

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
    const ampliado = candidatos.filter(c => c.prob >= 0.40 && c.cuota >= 1.48);
    ampliado.sort((a, b) => (b.prob * b.cuota) - (a.prob * a.cuota));
    for (const c of ampliado) {
      if (sonCompatibles(c, elegidas)) {
        elegidas.push(c);
        if (elegidas.length >= 4) break;
      }
    }
  }

  if (elegidas.length < 3) return null;

  const prob = elegidas.reduce((a, x) => a * x.prob, 1);
  const cuotaCasa = elegidas.every(x => x.cuotaCasa)
    ? elegidas.reduce((a, x) => a * x.cuotaCasa, 1)
    : elegidas.reduce((a, x) => a * x.cuota, 1);

  return {
    tipo: 'sonador',
    titulo: 'Parlay Soñador',
    descripcion: `${elegidas.length} selecciones con excelente pago. Opciones factibles (más de 45% de prob.) algo más riesgosas para multiplicar el retorno.`,
    piernas: elegidas,
    prob,
    cuotaJusta: 1 / prob,
    cuotaCasa,
  };
}

export function armarParlaysPartido(p) {
  const candidatos = obtenerCandidatosPartido(p);
  return {
    factible: armarParlayFactible(candidatos),
    sonador: armarParlaySonador(candidatos),
  };
}

// Mercados cuya probabilidad sale de lo que pagan las casas (goles y, derivado de ellos, tiempos).
const RESPALDO_CASAS = ['goles', 'tiempos'];

// Qué tan recomendable es la apuesta que se muestra primero (lista[0]) y cuándo conviene revisarla.
// nivel: alta = probable, respaldada por lo que pagan las casas y con pocas alertas; media = probable; baja = sin apuesta clara.
export function recomendacion(p, d, { horas, confirmadas, bajas, alertas }) {
  const primera = d.lista?.[0];
  const prob = primera?.prob ?? 0;
  const respaldada = p.ajustadoACasas && RESPALDO_CASAS.includes(primera?.categoria);
  const nivel = !primera || horas < 0 ? 'baja' : prob >= 0.75 && respaldada && alertas.length <= 2 ? 'alta' : prob >= 0.65 ? 'media' : 'baja';

  let cuando;
  if (!primera && !d.valor) cuando = { momento: 'evitar', texto: 'Sin apuesta clara: mejor no apostar este partido.' };
  else if (horas < 0) cuando = { momento: 'evitar', texto: 'El partido ya empezó: estas probabilidades son de antes del inicio.' };
  else if (confirmadas) cuando = { momento: 'ahora', texto: 'Alineaciones confirmadas: buen momento para revisarla.' };
  else if (bajas || alertas.length >= 3) {
    cuando = { momento: 'esperar', texto: horas <= 1.5
      ? 'Las alineaciones están por salir y hay alertas o posibles bajas: revísalas antes de decidir.'
      : 'Espera a las alineaciones (salen ~1 h antes del partido): hay alertas o posibles bajas.' };
  }
  else if (horas > 24 && d.valor) cuando = { momento: 'esperar', texto: 'Falta más de un día. La de valor conviene antes de que la cuota se ajuste; para lo demás, revisa el día del partido.' };
  else if (horas > 24) cuando = { momento: 'esperar', texto: 'Falta más de un día: puede haber cambios. Revisa de nuevo el día del partido.' };
  else cuando = { momento: 'ahora', texto: 'Sin alertas importantes. Para goleadores y tiros, espera a la alineación (~1 h antes).' };

  return { nivel, cuando };
}
