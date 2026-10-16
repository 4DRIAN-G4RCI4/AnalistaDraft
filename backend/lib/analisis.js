// Análisis en texto de un partido: puntos fuertes, alertas y balance, a partir del modelo y los datos.
import { seleccionSugerida, esValor } from './modelo.js';

const pct = p => `${Math.round(p * 100)}%`;

const ETIQUETA = { tiempos: 'Tiempos', corners: 'Corners', tarjetas: 'Tarjetas', tirosPuerta: 'Tiros a puerta', tiros: 'Tiros' };

// Lo primero que se muestra: la apuesta más probable, la de valor y la mejor de corners/tarjetas/tiros.
function destacadas(p) {
  const probable = seleccionSugerida(p.probs);
  const modelo = p.modelo ?? p.probs;
  const valor = Object.entries(p.mercado)
    .map(([m, c]) => ({ mercado: m, prob: p.probs[m], cuota: c.cuota, ventaja: modelo[m] - c.prob }))
    .filter(esValor)
    .sort((a, b) => b.ventaja - a.ventaja)[0] ?? null;
  const extra = Object.entries(p.extras ?? {})
    .map(([cat, e]) => ({ categoria: cat, ...seleccionSugerida(e.probs) }))
    .filter(x => x.mercado)
    .sort((a, b) => b.prob - a.prob)[0] ?? null;
  return {
    probable: probable && { ...probable, cuota: p.mercado[probable.mercado]?.cuota ?? null },
    valor,
    extra,
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
  return { destacadas: d, fuertes, alertas, datos, balance, sugerida: s, ...recomendacion(p, d, { horas, confirmadas, bajas, alertas }) };
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
