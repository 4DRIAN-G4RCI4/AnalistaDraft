// Previa de cada partido (ESPN summary): últimos 5 de cada equipo, alineaciones y estadísticas
// de esos partidos (tiros, tiros a puerta, corners, tarjetas, goles por tiempo y por jugador).
import { ESPN, json, memo } from './datos.js';

const TTL_PREVIA = 20 * 60e3; // alineaciones y últimos resultados pueden cambiar cerca del partido
export const CATEGORIAS = ['corners', 'tarjetas', 'tirosPuerta', 'tiros'];

const resumen = (liga, id, ttl) => json(`${ESPN}/site/v2/sports/soccer/${liga}/summary?event=${id}`, ttl);
const valor = (stats, nombre) => Number(stats?.find(s => s.name === nombre)?.displayValue ?? stats?.find(s => s.name === nombre)?.value) || 0;

export async function previa(liga, eventoId) {
  const s = await resumen(liga, eventoId, TTL_PREVIA);
  // ESPN publica la alineación ~1 h antes; antes de eso el roster viene vacío
  const titulares = Object.fromEntries((s.rosters ?? []).map(r => [String(r.team?.id), (r.roster ?? []).filter(j => j.starter).map(j => String(j.athlete?.id))]));
  return {
    ultimos: Object.fromEntries((s.lastFiveGames ?? []).map(g => [String(g.team?.id), g.events ?? []])),
    alineacion: Object.fromEntries(Object.entries(titulares).map(([id, t]) => [id, t.length > 0])),
    titulares,
  };
}

// Un partido terminado no cambia: se guarda para siempre.
const jugado = (liga, id) => memo(`jugado:${id}`, Infinity, async () => {
  const s = await resumen(liga, id, Infinity);
  // Goles por tiempo (period 1 o 2; prórroga y penales no cuentan)
  const goles = (s.keyEvents ?? []).filter(k => k.scoringPlay && k.period?.number <= 2);
  const rosters = Object.fromEntries((s.rosters ?? []).map(r => [String(r.team?.id), r.roster ?? []]));
  return Object.fromEntries((s.boxscore?.teams ?? []).map(t => {
    const id = String(t.team.id);
    const mios = goles.filter(k => String(k.team?.id) === id);
    return [id, {
      corners: valor(t.statistics, 'wonCorners'),
      tarjetas: valor(t.statistics, 'yellowCards') + valor(t.statistics, 'redCards'),
      tirosPuerta: valor(t.statistics, 'shotsOnTarget'),
      tiros: valor(t.statistics, 'totalShots'),
      goles: mios.length,
      goles1T: mios.filter(k => k.period.number === 1).length,
      jugadores: (rosters[id] ?? []).map(j => ({
        id: String(j.athlete?.id), nombre: j.athlete?.displayName ?? '', pos: j.position?.abbreviation ?? '',
        jugo: Boolean(j.starter || j.subbedIn), titular: Boolean(j.starter),
        goles: valor(j.stats, 'totalGoals'), tiros: valor(j.stats, 'totalShots'), tirosPuerta: valor(j.stats, 'shotsOnTarget'),
      })),
    }];
  }));
});

// Suma por jugador de sus últimos partidos con el equipo.
function jugadoresEquipo(partidos, equipoId) {
  const acc = {};
  for (const st of partidos) {
    for (const j of st[equipoId].jugadores) {
      const a = (acc[j.id] ??= { id: j.id, nombre: j.nombre, pos: j.pos, partidos: 0, titular: 0, goles: 0, tiros: 0, tirosPuerta: 0 });
      if (a.pos === 'SUB' && j.pos && j.pos !== 'SUB') a.pos = j.pos; // ESPN pone "SUB" al que entró de cambio
      a.partidos += j.jugo ? 1 : 0;
      a.titular += j.titular ? 1 : 0;
      a.goles += j.goles;
      a.tiros += j.tiros;
      a.tirosPuerta += j.tirosPuerta;
    }
  }
  return Object.values(acc);
}

// Promedios a favor y en contra de un equipo en sus últimos partidos, y la lista de resultados.
export async function estadisticasEquipo(liga, equipoId, eventos) {
  const ordenados = [...eventos].sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate)); // más reciente primero
  const conStats = (await Promise.all(ordenados.map(e => jugado(liga, e.id).catch(() => null))))
    .filter(st => st?.[equipoId] && Object.keys(st).length === 2 && st[equipoId].tiros > 0); // sin boxscore = sin datos
  const rival = st => Object.entries(st).find(([id]) => id !== equipoId)[1];
  const promedio = f => conStats.reduce((a, st) => a + f(st), 0) / conStats.length;
  const suma = f => conStats.reduce((a, st) => a + f(st), 0);
  return {
    n: conStats.length,
    favor: conStats.length ? Object.fromEntries(CATEGORIAS.map(c => [c, promedio(st => st[equipoId][c])])) : null,
    contra: conStats.length ? Object.fromEntries(CATEGORIAS.map(c => [c, promedio(st => rival(st)[c])])) : null,
    // goles totales y del primer tiempo (a favor + en contra) para estimar en qué tiempo caen
    goles: suma(st => st[equipoId].goles + rival(st).goles),
    goles1T: suma(st => st[equipoId].goles1T + rival(st).goles1T),
    tirosEquipo: suma(st => st[equipoId].tiros),
    tirosPuertaEquipo: suma(st => st[equipoId].tirosPuerta),
    golesEquipo: suma(st => st[equipoId].goles),
    jugadores: jugadoresEquipo(conStats, equipoId),
    resultados: ordenados.map(e => ({
      fecha: e.gameDate, rival: e.opponent?.displayName ?? '', marcador: e.score, resultado: e.gameResult,
      local: e.atVs === 'vs', competicion: e.leagueAbbreviation ?? '',
    })),
  };
}
