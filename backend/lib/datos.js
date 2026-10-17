// Fuentes gratuitas sin API key: ESPN (partidos, tabla, momios DraftKings, noticias) y
// transfermarkt-datasets (valor de mercado de jugadores, actualizado semanalmente).
import zlib from 'node:zlib';
import { mkdir, readFile, writeFile, stat, readdir, rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const gunzip = promisify(zlib.gunzip);
const MAX_DESCARGA = 100 * 2 ** 20; // el CSV de jugadores pesa ~5 MB comprimido; más es sospechoso
const MAX_DESCOMPRIMIDO = 300 * 2 ** 20; // ~20 MB real; tope contra una "bomba" gzip

export const LIGAS = {
  'eng.1': { nombre: 'Premier League', tm: 'GB1' },
  'esp.1': { nombre: 'LaLiga', tm: 'ES1' },
  'ita.1': { nombre: 'Serie A', tm: 'IT1' },
  'ger.1': { nombre: 'Bundesliga', tm: 'L1' },
  'fra.1': { nombre: 'Ligue 1', tm: 'FR1' },
  'mex.1': { nombre: 'Liga MX', tm: 'MEX1' },
};

export const ESPN = 'https://site.api.espn.com/apis';
const TM = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data';
const CACHE_DIR = new URL('../cache/', import.meta.url);
const MIN_JUGADORES = 18; // recién ascendidos aparecen con 1-4 jugadores: su valor no es real
const ALERTA =/lesi|baja|descart|suspend|duda|fuera de|expuls|sancion|enferm|operad/i;

const cache = new Map();
const MAX_MEMO = 3000; // entradas en memoria; arriba de esto se tiran las vencidas y luego las más viejas
// Guarda la promesa (no el resultado) para que llamadas simultáneas compartan una sola carga.
export function memo(clave, ms, fn) {
  const c = cache.get(clave);
  if (c && Date.now() - c.t < c.ms) return c.v;
  if (cache.size >= MAX_MEMO) podar();
  const v = fn();
  cache.set(clave, { t: Date.now(), ms, v });
  v.catch(() => cache.delete(clave)); // no cachear errores
  return v;
}

function podar() {
  const ahora = Date.now();
  for (const [k, c] of cache) if (ahora - c.t >= c.ms) cache.delete(k);
  // el Map conserva el orden de inserción: las primeras son las más viejas
  for (const k of cache.keys()) {
    if (cache.size < MAX_MEMO * 0.8) break;
    cache.delete(k);
  }
}

// Al arrancar: borrar respuestas de ESPN guardadas hace más de 30 días (la caché en disco no crece sin fin).
const VIDA_DISCO = 30 * 24 * 3600e3;
export async function limpiarDisco() {
  const dir = new URL('fuentes/', CACHE_DIR);
  const archivos = await readdir(dir).catch(() => []);
  let borrados = 0;
  for (const a of archivos) {
    const ruta = new URL(a, dir);
    const s = await stat(ruta).catch(() => null);
    if (s && Date.now() - s.mtimeMs > VIDA_DISCO) {
      await rm(ruta, { force: true });
      borrados++;
    }
  }
  return borrados;
}

// Cuánto se reutiliza cada respuesta de ESPN antes de volver a pedirla.
const TTL = { tabla: 2 * 3600e3, partidos: 30 * 60e3, noticias: 30 * 60e3 };

// Máximo de peticiones simultáneas: la primera carga de estadísticas pide ~100 partidos.
const MAX_SIMULTANEAS = 4; // con 6 ESPN empezaba a responder 403
let activas = 0;
const fila = [];
async function turno(fn) {
  if (activas >= MAX_SIMULTANEAS) await new Promise(r => fila.push(r));
  activas++;
  try {
    return await fn();
  } finally {
    activas--;
    fila.shift()?.();
  }
}

// Caché en disco: sobrevive reinicios del servidor. Si la fuente falla, sirve la última copia guardada.
// nombre: identifica la petición en archivo y errores sin exponer secretos de la URL (API keys).
// transformar: se aplica antes de guardar, para no cargar en memoria ni en disco lo que no se usa.
export async function json(url, ttl, nombre = url.replace(/^https:\/\/[^/]+\//, ''), transformar = x => x) {
  const dir = new URL('fuentes/', CACHE_DIR);
  const archivo = new URL(nombre.replace(/[^a-z0-9.]+/gi, '_') + '.json', dir);
  const edad = await stat(archivo).then(s => Date.now() - s.mtimeMs, () => Infinity);
  if (edad < ttl) return JSON.parse(await readFile(archivo, 'utf8'));
  try {
    let r;
    // ESPN responde 403/429 a ráfagas de consultas y luego vuelve a responder: se reintenta con espera
    for (const espera of [1500, 3000, null]) {
      r = await turno(() => fetch(url, { signal: AbortSignal.timeout(15000) }));
      if (![403, 429].includes(r.status) || espera === null) break;
      await new Promise(ok => setTimeout(ok, espera));
    }
    if (!r.ok) throw new Error(`${r.status} en ${nombre}`);
    const restantes = r.headers.get('x-requests-remaining');
    if (restantes) console.log(`The Odds API: quedan ${restantes} créditos este mes`);
    const j = transformar(await r.json());
    await mkdir(dir, { recursive: true });
    await writeFile(archivo, JSON.stringify(j));
    return j;
  } catch (e) {
    if (edad === Infinity) throw new Error(`No se pudo obtener ${nombre}: ${e.name === 'TimeoutError' ? 'tiempo agotado' : e.message.replaceAll(url, nombre)}`);
    console.warn(`Falló ${nombre}, uso caché vieja`);
    return JSON.parse(await readFile(archivo, 'utf8'));
  }
}

export const tabla = liga => memo(`tabla:${liga}`, TTL.tabla, async () => {
  const j = await json(`${ESPN}/v2/sports/soccer/${liga}/standings`, TTL.tabla);
  return j.children[0].standings.entries.map(e => {
    const s = Object.fromEntries(e.stats.map(x => [x.name, x.value]));
    return {
      id: e.team.id, nombre: e.team.displayName, pj: s.gamesPlayed, gf: s.pointsFor, gc: s.pointsAgainst, pts: s.points, pos: s.rank,
      g: s.wins, e: s.ties, p: s.losses, logo: e.team.logos?.[0]?.href ?? null,
      zona: e.note ? { texto: e.note.description, color: e.note.color } : null, // p. ej. Champions, descenso
    };
  });
});

export const partidos = (liga, dias) => memo(`partidos:${liga}:${dias}`, TTL.partidos, async () => {
  // desde ayer: ESPN agrupa por día de EE. UU. y de noche en México ya es el día siguiente en UTC (los ya jugados se filtran abajo)
  const fechas = Array.from({ length: dias + 1 }, (_, i) => new Date(Date.now() + (i - 1) * 864e5).toISOString().slice(0, 10).replaceAll('-', ''));
  const dias_ = await Promise.all(fechas.map(f => json(`${ESPN}/site/v2/sports/soccer/${liga}/scoreboard?dates=${f}`, TTL.partidos)));
  const vistos = new Set();
  return dias_.flatMap(d => d.events)
    .filter(ev => ev.status.type.state === 'pre' && !vistos.has(ev.id) && vistos.add(ev.id))
    .map(ev => {
      const c = ev.competitions[0];
      const eq = lado => {
        const t = c.competitors.find(x => x.homeAway === lado);
        return { id: t.team.id, nombre: t.team.displayName, logo: t.team.logo, forma: t.form || '' };
      };
      return { id: ev.id, fecha: ev.date, local: eq('home'), visita: eq('away'), momios: momiosDe(c) };
    });
});

// Momios de la casa (DraftKings) que trae el scoreboard de ESPN; siguen ahí durante el partido.
function momiosDe(c) {
  const o = c.odds?.[0];
  if (!o) return null;
  const ml = o.moneyline, tot = o.total;
  const ult = x => x?.close?.odds ?? x?.open?.odds;
  return {
    casa: o.provider?.displayName ?? o.provider?.name ?? 'Casa',
    local: ult(ml?.home), empate: ult(ml?.draw), visita: ult(ml?.away),
    linea: o.overUnder, mas: ult(tot?.over), menos: ult(tot?.under),
  };
}

// Partidos en juego ahora mismo: marcador y minuto, refrescados cada minuto.
export const enVivo = liga => memo(`envivo:${liga}`, 60e3, async () => {
  const j = await json(`${ESPN}/site/v2/sports/soccer/${liga}/scoreboard`, 60e3, `envivo_${liga}`);
  return j.events.filter(e => e.status.type.state === 'in').map(e => {
    const c = e.competitions[0];
    const eq = lado => {
      const t = c.competitors.find(x => x.homeAway === lado);
      const st = n => Number(t.statistics?.find(x => x.name === n)?.displayValue) || 0;
      return {
        id: t.team.id, nombre: t.team.displayName, logo: t.team.logo, goles: Number(t.score) || 0,
        corners: st('wonCorners'), tirosPuerta: st('shotsOnTarget'), tiros: st('totalShots'), posesion: st('possessionPct'),
      };
    };
    const local = c.competitors.find(x => x.homeAway === 'home')?.team.id;
    // goles y tarjetas con minuto y jugador
    const eventos = (c.details ?? []).filter(d => d.scoringPlay || d.yellowCard || d.redCard).map(d => ({
      tipo: d.scoringPlay ? (d.ownGoal ? 'autogol' : 'gol') : d.redCard ? 'roja' : 'amarilla',
      minuto: d.clock?.displayValue ?? '', local: String(d.team?.id) === String(local),
      jugador: (d.athletesInvolved ?? [])[0]?.displayName ?? '',
    }));
    return {
      eventos,
      id: e.id, liga, minuto: e.status.type.shortDetail, local: eq('home'), visita: eq('away'),
      jugado: Math.min(90, (e.status.clock ?? 0) / 60), descanso: e.status.type.name === 'STATUS_HALFTIME',
      momios: momiosDe(c),
    };
  });
});

export const noticias = liga => memo(`noticias:${liga}`, TTL.noticias, async () => {
  const j = await json(`${ESPN}/site/v2/sports/soccer/${liga}/news?lang=es&limit=50`, TTL.noticias);
  return j.articles.map(a => ({
    titulo: a.headline,
    resumen: a.description ?? '',
    url: a.links?.web?.href ?? null,
    fecha: a.published,
    equipos: (a.categories ?? []).filter(c => c.type === 'team').map(c => String(c.teamId)),
    alerta: ALERTA.test(`${a.headline} ${a.description ?? ''}`),
  }));
});

// shortcut: parser CSV de una línea por registro; si el dataset trae saltos de línea dentro de comillas, usar un parser real.
// columnas: solo esas se extraen (el CSV de jugadores tiene 26 y 50 mil filas; en Render, con 0.1 CPU,
// armar todos los campos tardaba ~20 s cada vez que el servidor despertaba).
export function csv(texto, columnas) {
  const fin = texto.indexOf('\n');
  const cab = campos(texto.slice(0, fin));
  const idx = (columnas ?? cab).map(c => cab.indexOf(c));
  const max = Math.max(...idx);
  const filas = [];
  for (let ini = fin + 1; ini < texto.length;) {
    let corte = texto.indexOf('\n', ini);
    if (corte === -1) corte = texto.length;
    if (corte > ini) {
      const v = campos(texto.slice(ini, corte), max);
      filas.push(Object.fromEntries((columnas ?? cab).map((c, i) => [c, v[idx[i]] ?? ''])));
    }
    ini = corte + 1;
  }
  return filas;
}

// Separa una línea CSV en campos (respeta comillas y "" escapadas) hasta el campo `hasta`.
function campos(linea, hasta = Infinity) {
  const out = [];
  let i = 0;
  while (i <= linea.length && out.length <= hasta) {
    if (linea[i] === '"') {
      let j = i + 1, v = '';
      for (;;) {
        const q = linea.indexOf('"', j);
        if (q === -1) { v += linea.slice(j); j = linea.length; break; }
        v += linea.slice(j, q);
        if (linea[q + 1] === '"') { v += '"'; j = q + 2; } else { j = q + 1; break; }
      }
      out.push(v);
      i = j + 1; // salta la coma
    } else {
      let coma = linea.indexOf(',', i);
      if (coma === -1) coma = linea.length;
      out.push(linea.slice(i, coma).replace(/\r$/, ''));
      i = coma + 1;
    }
  }
  return out;
}

async function descargarTM(archivo) {
  await mkdir(CACHE_DIR, { recursive: true });
  const ruta = new URL(archivo.replace('.gz', ''), CACHE_DIR);
  const fresco = await stat(ruta).then(s => Date.now() - s.mtimeMs < 24 * 3600e3, () => false);
  if (fresco) return readFile(ruta, 'utf8');
  const r = await fetch(`${TM}/${archivo}`, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${r.status} descargando ${archivo}`);
  if (Number(r.headers.get('content-length')) > MAX_DESCARGA) throw new Error(`${archivo} demasiado grande`);
  const comprimido = Buffer.from(await r.arrayBuffer());
  if (comprimido.length > MAX_DESCARGA) throw new Error(`${archivo} demasiado grande`);
  // asíncrono para no congelar el servidor mientras descomprime; con tope de tamaño
  const texto = (await gunzip(comprimido, { maxOutputLength: MAX_DESCOMPRIMIDO })).toString();
  await writeFile(ruta, texto);
  return texto;
}

// { clubId: { nombre, valor, jugadores } } por competencia de Transfermarkt
const valoresTM = () => memo('tm', 24 * 3600e3, async () => {
  const jugadores = csv(await descargarTM('players.csv.gz'), ['current_club_id', 'current_club_domestic_competition_id', 'current_club_name', 'last_season', 'market_value_in_eur']);
  const ultima = {};
  for (const j of jugadores) ultima[j.current_club_domestic_competition_id] = Math.max(ultima[j.current_club_domestic_competition_id] ?? 0, +j.last_season);
  const clubes = {};
  for (const j of jugadores) {
    const comp = j.current_club_domestic_competition_id;
    if (+j.last_season !== ultima[comp] || !j.current_club_id) continue; // jugadores que ya no están en la plantilla actual
    const c = (clubes[comp] ??= {})[j.current_club_id] ??= { nombre: j.current_club_name, valor: 0, jugadores: 0 };
    c.valor += +j.market_value_in_eur || 0;
    c.jugadores++;
  }
  for (const c of csv(await descargarTM('clubs.csv.gz'), ['club_id', 'domestic_competition_id', 'name'])) {
    const club = clubes[c.domestic_competition_id]?.[c.club_id];
    if (club) club.nombre = c.name; // nombre corto ("Arsenal FC") empata mejor con ESPN
  }
  for (const comp of Object.values(clubes))
    for (const [id, c] of Object.entries(comp)) if (c.jugadores < MIN_JUGADORES) delete comp[id];
  return clubes;
});

const tokens = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter(t => t.length > 1 && !['fc', 'cf', 'cd', 'club', 'ac', 'as', 'ss', 'sc', 'de', 'afc', 'ssc', 'us', 'sv', 'vfb', 'vfl', 'tsg', 'rc', 'ogc', 'sad', 'calcio', 'football', 'futbol',
    'le', 'la', 'el', 'les', 'real', 'deportivo', 'sporting', 'olympique', 'stade'].includes(t)); // palabras que comparten clubes distintos

export function mejorCoincidencia(nombre, candidatos) {
  const a = tokens(nombre);
  const listas = candidatos.map(c => tokens(c.nombre));
  const igual = (t, u) => t === u || (t.length >= 4 && u.length >= 4 && (u.startsWith(t) || t.startsWith(u)));
  // palabras repetidas entre clubes ("united", "city") pesan menos que las distintivas ("leeds")
  const peso = t => Math.log((candidatos.length + 1) / (listas.filter(b => b.some(u => igual(t, u))).length + 0.5));
  const total = a.reduce((s, t) => s + peso(t), 0);
  let mejor = null, puntos = 0, largo = Infinity;
  listas.forEach((b, i) => {
    const p = a.filter(t => b.some(u => igual(t, u))).reduce((s, t) => s + peso(t), 0) / total;
    if (p > puntos || (p === puntos && b.length < largo)) { mejor = candidatos[i]; puntos = p; largo = b.length; }
  });
  return puntos >= 0.5 ? mejor : null;
}

export async function valorPlantilla(liga, nombreEquipo) {
  const clubes = Object.values((await valoresTM())[LIGAS[liga].tm] ?? {});
  return mejorCoincidencia(nombreEquipo, clubes);
}
