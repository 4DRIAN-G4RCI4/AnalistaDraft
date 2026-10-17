// Cuotas de varias casas (DraftKings, FanDuel, BetMGM, bet365…) vía The Odds API. Opcional:
// sin ODDS_API_KEY en backend/.env se usan solo los momios de DraftKings que trae ESPN.
// Cada consulta cuesta (mercados × regiones) créditos del plan gratis, por eso la caché es larga.
import { json, memo, mejorCoincidencia } from './datos.js';
import { sinMargen } from './modelo.js';

const DEPORTE = {
  'eng.1': 'soccer_epl',
  'esp.1': 'soccer_spain_la_liga',
  'ita.1': 'soccer_italy_serie_a',
  'ger.1': 'soccer_germany_bundesliga',
  'fra.1': 'soccer_france_ligue_one',
  'mex.1': 'soccer_mexico_ligamx',
  'uefa.champions': 'soccer_uefa_champs_league',
  'uefa.europa': 'soccer_uefa_europa_league',
  'uefa.europa.conf': 'soccer_uefa_europa_conference_league',
  'ned.1': 'soccer_netherlands_eredivisie',
  'ksa.1': 'soccer_saudi_arabia_pro_league',
  'usa.1': 'soccer_usa_mls',
  'arg.1': 'soccer_argentina_primera_division',
  'bra.1': 'soccer_brazil_campeonato',
};
const TTL = (Number(process.env.ODDS_TTL_HORAS) || 12) * 3600e3;
const REGIONES = process.env.ODDS_REGIONES || 'us'; // us = DraftKings, FanDuel, BetMGM…; eu/uk = bet365, Pinnacle…

export const hayKey = () => Boolean(process.env.ODDS_API_KEY);

export async function eventosLiga(liga) {
  if (!hayKey() || !DEPORTE[liga]) return [];
  const url = `https://api.the-odds-api.com/v4/sports/${DEPORTE[liga]}/odds/?apiKey=${encodeURIComponent(process.env.ODDS_API_KEY)}&regions=${REGIONES}&markets=h2h,totals&oddsFormat=decimal`;
  try {
    return await memo(`odds:${liga}`, TTL, () => json(url, TTL, `odds_${DEPORTE[liga]}_${REGIONES}`)); // memo no guarda errores
  } catch (e) {
    console.warn(`The Odds API no disponible (${e.message}); sigo con ESPN/DraftKings`);
    return [];
  }
}

// Evento de The Odds API que corresponde al partido de ESPN: misma hora (±3 h) y nombres parecidos.
export function buscarEvento(eventos, partido) {
  const t = new Date(partido.fecha).getTime();
  const cerca = eventos
    .filter(e => Math.abs(new Date(e.commence_time).getTime() - t) < 3 * 3600e3)
    .map(e => ({ nombre: `${e.home_team} ${e.away_team}`, e }));
  return mejorCoincidencia(`${partido.local.nombre} ${partido.visita.nombre}`, cerca)?.e ?? null;
}

// Consenso entre casas: probabilidad = promedio de cada casa sin su margen; cuota = la que mejor paga.
export function consenso(evento) {
  const mercado = {};
  const agregar = (nombre, prob, cuota, casa) => {
    const m = (mercado[nombre] ??= { probs: [], cuota: 0, mejorCasa: null });
    m.probs.push(prob);
    if (cuota > m.cuota) Object.assign(m, { cuota, mejorCasa: casa });
  };
  // Línea de goles más ofrecida (normalmente 2.5)
  const lineas = {};
  for (const b of evento.bookmakers) for (const o of b.markets.find(m => m.key === 'totals')?.outcomes ?? []) lineas[o.point] = (lineas[o.point] ?? 0) + 1;
  const linea = Number(Object.entries(lineas).sort((a, b) => b[1] - a[1])[0]?.[0]);

  for (const b of evento.bookmakers) {
    const h2h = b.markets.find(m => m.key === 'h2h')?.outcomes;
    if (h2h?.length === 3) {
      const orden = [evento.home_team, 'Draw', evento.away_team].map(n => h2h.find(o => o.name === n)?.price);
      sinMargen(orden)?.forEach((p, i) => agregar(['Local', 'Empate', 'Visita'][i], p, orden[i], b.title));
    }
    const tot = b.markets.find(m => m.key === 'totals')?.outcomes.filter(o => o.point === linea);
    if (tot?.length === 2) {
      const orden = ['Over', 'Under'].map(n => tot.find(o => o.name === n)?.price);
      sinMargen(orden)?.forEach((p, i) => agregar([`Más de ${linea} goles`, `Menos de ${linea} goles`][i], p, orden[i], b.title));
    }
  }
  return Object.fromEntries(Object.entries(mercado).map(([k, m]) => [k, {
    prob: m.probs.reduce((a, b) => a + b, 0) / m.probs.length,
    cuota: m.cuota,
    mejorCasa: m.mejorCasa,
    casas: m.probs.length,
  }]));
}
