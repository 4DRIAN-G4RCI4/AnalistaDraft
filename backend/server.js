import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { LIGAS, tabla, partidos, noticias, valorPlantilla, memo, limpiarDisco, enVivo } from './lib/datos.js';
import { golesEsperados, mercados, decimal, sinMargen, armarParlays, ajustarAMercado, combinarGoles, conteoEsperado, mercadosConteo, fraccion1T, mercadosTiempos, probGoleadores, mercadosVivo } from './lib/modelo.js';
import { previa, estadisticasEquipo, CATEGORIAS } from './lib/stats.js';
import { eventosLiga, buscarEvento, consenso } from './lib/cuotas.js';
import { resumenPartido } from './lib/analisis.js';

const PORT = Number(process.env.PORT) || 4000; // el frontend (Vite) hace proxy de /api a este puerto
const HOST = process.env.HOST || '127.0.0.1'; // en producción (Render) HOST=0.0.0.0

// Límite de consultas a la API: solo frena abusos (la página hace 1-2 por liga y el análisis sale de caché).
// La IP es el ÚLTIMO valor de x-forwarded-for: lo agrega el proxy de Render y el cliente no lo puede
// falsificar (los primeros sí). Por Netlify ese valor es su servidor de borde, que comparten muchos
// visitantes, por eso el límite es holgado.
const LIMITE_POR_MINUTO = 300;
const MAX_IPS = 10_000;
const consultas = new Map();
function ipCliente(req) {
  const xff = req.headers['x-forwarded-for'];
  return xff ? String(xff).split(',').at(-1).trim() : req.socket.remoteAddress;
}
function excedeLimite(req) {
  const ip = ipCliente(req);
  const ahora = Date.now();
  const c = consultas.get(ip);
  if (!c || ahora - c.desde > 60e3) {
    if (consultas.size >= MAX_IPS) {
      // borrar solo las vencidas: vaciar todo dejaría a un atacante reiniciar el contador de los demás
      for (const [k, v] of consultas) if (ahora - v.desde > 60e3) consultas.delete(k);
      if (consultas.size >= MAX_IPS) return true; // lleno de IPs activas: se rechaza a las nuevas
    }
    consultas.set(ip, { desde: ahora, n: 1 });
    return false;
  }
  return ++c.n > LIMITE_POR_MINUTO;
}
const MEDIA_DEFAULT = 1.35; // goles por equipo por partido cuando la tabla aún no tiene partidos
const MIN_PARTIDOS_STATS = 3; // con menos partidos con estadísticas, no se estiman corners/tarjetas/tiros

// Últimos 5, alineaciones y corners/tarjetas/tiros. Si ESPN no tiene la previa, el partido se analiza sin esto.
async function previaCompleta(liga, p) {
  try {
    const pr = await previa(liga, p.id);
    const [sl, sv] = await Promise.all([p.local, p.visita].map(e => estadisticasEquipo(liga, e.id, pr.ultimos[e.id] ?? [])));
    const extras = {};
    if (sl.n >= MIN_PARTIDOS_STATS && sv.n >= MIN_PARTIDOS_STATS) {
      for (const cat of CATEGORIAS) {
        const esperado = conteoEsperado(sl, sv, cat);
        extras[cat] = { esperado, probs: mercadosConteo(cat, esperado) };
      }
    }
    return { extras, forma: { local: sl, visita: sv }, alineacion: pr.alineacion, titulares: pr.titulares, alineaciones: pr.alineaciones };
  } catch (e) {
    console.warn(`Sin previa de ${p.id}: ${e.message}`);
    return { extras: {}, forma: null, alineacion: {}, titulares: {}, alineaciones: {} };
  }
}

async function analizar(liga, dias) {
  const [tbl, prox, news, eventos] = await Promise.all([tabla(liga), partidos(liga, dias), noticias(liga), eventosLiga(liga)]);
  const pj = tbl.reduce((a, t) => a + t.pj, 0);
  const media = pj ? tbl.reduce((a, t) => a + t.gf, 0) / pj : MEDIA_DEFAULT;
  const vacio = { pj: 0, gf: 0, gc: 0 };

  const analizados = await Promise.all(prox.map(async p => {
    const tl = tbl.find(t => t.id === p.local.id) ?? vacio;
    const tv = tbl.find(t => t.id === p.visita.id) ?? vacio;
    const [vl, vv] = await Promise.all([valorPlantilla(liga, p.local.nombre), valorPlantilla(liga, p.visita.nombre)]).catch(() => [null, null]);
    const extra = previaCompleta(liga, p); // en paralelo con el resto
    const golesModelo = golesEsperados(tl, tv, media, vl?.valor, vv?.valor);
    const modelo = mercados(golesModelo.local, golesModelo.visita).probs;

    // Cuotas: consenso de varias casas (The Odds API) si hay key; si no, DraftKings vía ESPN.
    const evento = buscarEvento(eventos, p);
    let mercado = evento ? consenso(evento) : {};
    let casa = evento ? `${Math.max(0, ...Object.values(mercado).map(x => x.casas))} casas` : null;
    const m = p.momios;
    if (!Object.keys(mercado).length && m) {
      casa = m.casa;
      mercado = mercadoDeMomios(m);
    }
    for (const k of Object.keys(mercado)) if (!(k in modelo)) delete mercado[k]; // líneas raras (p. ej. 2.75) que el modelo no cubre

    // Lo que pagan las casas manda (cuota baja = factible); la estadística ajusta.
    const golesCasas = ajustarAMercado(mercado, golesModelo);
    const goles = golesCasas ? combinarGoles(golesModelo, golesCasas) : golesModelo;
    const { probs, marcador } = mercados(goles.local, goles.visita);

    // Por tiempos y goleadores: con los goles esperados finales (ya ajustados a las casas)
    const { titulares, ...pr } = await extra;
    const f = pr.forma;
    const f1 = fraccion1T((f?.local.goles1T ?? 0) + (f?.visita.goles1T ?? 0), (f?.local.goles ?? 0) + (f?.visita.goles ?? 0));
    pr.extras = {
      tiempos: { fraccion: f1, esperado: { local: goles.local * f1, visita: goles.visita * f1 }, probs: mercadosTiempos(goles.local, goles.visita, f1) },
      ...pr.extras,
    };
    const esperadoDe = lado => ({ goles: goles[lado], tiros: pr.extras.tiros?.esperado[lado], tirosPuerta: pr.extras.tirosPuerta?.esperado[lado] });
    const goleadores = {
      local: probGoleadores(f?.local, esperadoDe('local'), titulares[p.local.id]),
      visita: probGoleadores(f?.visita, esperadoDe('visita'), titulares[p.visita.id]),
    };
    if (f) for (const lado of ['local', 'visita']) delete f[lado].jugadores; // ya resumidos en goleadores
    const equipo = (e, t, v) => ({ ...e, pos: t.pos ?? null, pj: t.pj, gf: t.gf, gc: t.gc, valor: v?.valor ?? null, jugadores: v?.jugadores ?? null, clubTM: v?.nombre ?? null });
    const analizado = {
      id: p.id, liga, fecha: p.fecha, titulo: `${p.local.nombre} vs ${p.visita.nombre}`,
      local: equipo(p.local, tl, vl), visita: equipo(p.visita, tv, vv),
      golesEsperados: goles, golesModelo, ajustadoACasas: Boolean(golesCasas), probs, modelo, marcador, mercado, casa,
      noticias: news.filter(n => n.equipos.includes(p.local.id) || n.equipos.includes(p.visita.id)).slice(0, 6),
      ...pr,
      goleadores,
    };
    return { ...analizado, resumen: resumenPartido(analizado) };
  }));

  return { liga: LIGAS[liga].nombre, media, actualizado: new Date().toISOString(), partidos: analizados, parlays: armarParlays(analizados) };
}

// Página compilada (npm run build) para compartir: todo sale por este mismo puerto.
const DIST = fileURLToPath(new URL('../frontend/dist/', import.meta.url));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

async function estatico(res, pathname) {
  let ruta;
  try {
    ruta = path.join(DIST, path.normalize(decodeURIComponent(pathname)));
  } catch {
    return enviar(res, 400, { error: 'Ruta inválida' });
  }
  // Solo archivos dentro de dist; cualquier otra ruta (p. ej. ?partido=…) es la app
  const archivo = ruta.startsWith(DIST) && path.extname(ruta) ? ruta : path.join(DIST, 'index.html');
  try {
    const cuerpo = await readFile(archivo);
    res.writeHead(200, {
      'content-type': TIPOS[path.extname(archivo)] ?? 'application/octet-stream',
      'cache-control': archivo.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-frame-options': 'DENY',
    });
    res.end(cuerpo);
  } catch {
    enviar(res, 404, { error: archivo.endsWith('index.html') ? 'Falta compilar la página: npm run compartir' : 'No encontrado' });
  }
}

// El análisis completo se reutiliza unos minutos: calcularlo cuesta ~1 s de CPU y pesa ~400 KB
// (100 KB comprimido). Así muchas visitas a la misma liga no lo recalculan.
const TTL_ANALISIS = 5 * 60e3;
const analisisObj = (liga, dias) => memo(`obj:${liga}:${dias}`, TTL_ANALISIS, () => analizar(liga, dias));
// Si ya hay una versión anterior y la nueva tarda más de 2 s, se sirve la anterior y la nueva se termina
// de calcular por detrás: con 0.1 CPU en Render recalcular "Hoy" pasa del corte de ~26 s de Netlify.
const anterior = new Map();
function analisisListo(liga, dias) {
  const k = `${liga}:${dias}`;
  const nuevo = memo(`analisis:${k}`, TTL_ANALISIS, async () => {
    const json = JSON.stringify(liga === HOY ? await analizarHoy() : await analisisObj(liga, dias));
    const listo = { json, gzip: zlib.gzipSync(json) };
    anterior.set(k, listo);
    return listo;
  });
  if (!anterior.has(k)) return nuevo;
  nuevo.catch(() => {}); // si falla por detrás, se sigue sirviendo la anterior
  return Promise.race([nuevo, new Promise(ok => setTimeout(() => ok(anterior.get(k)), 2000))]);
}

// "Hoy": los partidos de hoy (hora de Ciudad de México) de todas las ligas, juntos.
const HOY = 'hoy';
const diaCDMX = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // AAAA-MM-DD

async function analizarHoy() {
  const hoy = diaCDMX(Date.now());
  // 2 días: un partido de la noche en CDMX ya cae en el día siguiente en UTC (ESPN pide fechas UTC)
  const ligas = await Promise.allSettled(Object.keys(LIGAS).map(l => analisisObj(l, 2)));
  const ok = ligas.filter(r => r.status === 'fulfilled').map(r => r.value);
  if (!ok.length) throw new Error('Ninguna liga respondió');
  const partidos = ok.flatMap(a => a.partidos)
    .filter(p => diaCDMX(p.fecha) === hoy)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  return {
    liga: 'Hoy, todas las ligas',
    media: ok.reduce((s, a) => s + a.media, 0) / ok.length,
    actualizado: new Date().toISOString(),
    partidos,
    parlays: armarParlays(partidos),
  };
}

function enviarAnalisis(req, res, { json, gzip }) {
  const comprime = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60',
    vary: 'Accept-Encoding',
    ...(comprime && { 'content-encoding': 'gzip' }),
  });
  res.end(comprime ? gzip : json);
}

// Momios americanos de la casa -> { mercado: { cuota, prob sin margen } } (1X2 y la línea de goles)
function mercadoDeMomios(m) {
  const mercado = {};
  const c1x2 = [m.local, m.empate, m.visita].map(decimal);
  sinMargen(c1x2)?.forEach((prob, i) => { mercado[['Local', 'Empate', 'Visita'][i]] = { cuota: c1x2[i], prob }; });
  const cou = [m.mas, m.menos].map(decimal);
  sinMargen(cou)?.forEach((prob, i) => { mercado[[`Más de ${m.linea} goles`, `Menos de ${m.linea} goles`][i]] = { cuota: cou[i], prob }; });
  return mercado;
}

// Sugerencias en vivo: goles esperados de antes del partido (de los momios) reducidos al tiempo que queda.
const GOLES_SIN_MOMIOS = { local: 1.4, visita: 1.15 };
// shortcut: factores redondos por roja (los estudios dan ~-30% propio / +25-45% rival); calibrar con resultados propios.
const ROJA_PROPIA = 0.7, ROJA_RIVAL = 1.3;
function analizarVivo(p) {
  const mercado = p.momios ? mercadoDeMomios(p.momios) : {};
  for (const k of Object.keys(mercado)) if (!/^(Local|Empate|Visita|Más de \d\.5 goles|Menos de \d\.5 goles)$/.test(k)) delete mercado[k];
  const base = ajustarAMercado(mercado, GOLES_SIN_MOMIOS) ?? GOLES_SIN_MOMIOS;
  // Expulsiones: cada roja baja ~30% los goles del que se queda con uno menos y sube ~30% los del rival
  const rojas = { local: p.eventos.filter(e => e.tipo === 'roja' && e.local).length, visita: p.eventos.filter(e => e.tipo === 'roja' && !e.local).length };
  const goles = {
    local: base.local * ROJA_PROPIA ** rojas.local * ROJA_RIVAL ** rojas.visita,
    visita: base.visita * ROJA_PROPIA ** rojas.visita * ROJA_RIVAL ** rojas.local,
  };
  const { probs, quedan } = mercadosVivo(goles.local, goles.visita, p.local.goles, p.visita.goles, p.jugado);
  const nombre = k => k.replace(/\bLocal\b/, p.local.nombre).replace(/\bVisita\b/, p.visita.nombre);
  const faltan = Math.max(0, Math.round(90 - p.jugado));
  const avisos = [];
  for (const [lado, e, rival] of [['local', p.local, p.visita], ['visita', p.visita, p.local]]) {
    if (rojas[lado]) avisos.push(`${e.nombre} juega con ${rojas[lado] === 1 ? 'uno' : rojas[lado]} menos: se le calculan ~${Math.round((1 - ROJA_PROPIA ** rojas[lado]) * 100)}% menos goles y a ${rival.nombre} más.`);
    const amarillas = p.eventos.filter(x => x.tipo === 'amarilla' && x.local === (lado === 'local')).length;
    if (amarillas >= 3) avisos.push(`${e.nombre} lleva ${amarillas} amarillas: juego brusco, más riesgo de una expulsión.`);
  }
  const vaPerdiendo = p.local.goles === p.visita.goles ? null : p.local.goles < p.visita.goles ? ['local', p.local] : ['visita', p.visita];
  if (vaPerdiendo) avisos.push(`Remontada de ${vaPerdiendo[1].nombre} (ganarlo): ${Math.round(probs[vaPerdiendo[0] === 'local' ? 'Gana Local' : 'Gana Visita'] * 100)}%.`);
  const razon = [`Quedan ~${faltan} min y se esperan ${(quedan.local + quedan.visita).toFixed(1)} goles más (${p.local.nombre} ${quedan.local.toFixed(1)}, ${p.visita.nombre} ${quedan.visita.toFixed(1)}).`, ...avisos].join(' ');
  const sugerencias = Object.entries(probs)
    .filter(([, x]) => x >= 0.6 && x <= 0.85) // más de 85% en vivo paga casi nada
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, prob]) => ({ mercado: nombre(k), prob }));
  const { momios, ...resto } = p;
  const ganador = { local: probs['Gana Local'], empate: probs.Empate, visita: probs['Gana Visita'] };
  return { ...resto, conMomios: Boolean(momios), sugerencias, razon, ganador };
}

const enviar = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/') && excedeLimite(req)) return enviar(res, 429, { error: 'Demasiadas consultas, espera un minuto.' });
    if (url.pathname === '/api/ligas') return enviar(res, 200, LIGAS);
    if (url.pathname === '/api/alineacion') {
      const liga = url.searchParams.get('liga'), evento = url.searchParams.get('evento') ?? '';
      if (!Object.hasOwn(LIGAS, liga) || !/^\d{1,12}$/.test(evento)) return enviar(res, 400, { error: 'Partido inválido' });
      return enviar(res, 200, (await previa(liga, evento)).alineaciones);
    }
    if (url.pathname === '/api/envivo') {
      const r = await Promise.allSettled(Object.keys(LIGAS).map(enVivo)); // una liga caída no tumba las demás
      return enviar(res, 200, r.flatMap(x => (x.status === 'fulfilled' ? x.value : [])).map(analizarVivo));
    }
    if (url.pathname === '/api/analisis') {
      const liga = url.searchParams.get('liga');
      if (liga !== HOY && !Object.hasOwn(LIGAS, liga)) return enviar(res, 400, { error: 'Liga inválida' });
      const dias = liga === HOY ? 1 : Math.min(Math.max(parseInt(url.searchParams.get('dias'), 10) || 7, 1), 14);
      return enviarAnalisis(req, res, await analisisListo(liga, dias));
    }
    if (url.pathname.startsWith('/api/')) return enviar(res, 404, { error: 'No encontrado' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return enviar(res, 405, { error: 'Método no permitido' });
    return estatico(res, url.pathname);
  } catch (e) {
    console.error(e);
    // Mensaje genérico (el detalle queda en el log) y 500, no 502: el frontend reintenta los 502-504
    // pensando que el servidor está despertando, y un error real no debe multiplicarse.
    enviar(res, 500, { error: 'No se pudieron obtener los datos de las fuentes. Intenta de nuevo en unos minutos.' });
  }
}).listen(PORT, HOST, () => console.log(`AnalistaDraft en http://${HOST}:${PORT}`));

// Precalentar "Hoy" (las 6 ligas) al arrancar: en Render el arranque lo dispara la primera visita, así las siguientes ya lo encuentran listo
analisisListo(HOY, 1).catch(e => console.warn(`Precalentamiento: ${e.message}`));

limpiarDisco().then(n => n && console.log(`Caché: ${n} archivos viejos borrados`), e => console.warn(`No se pudo limpiar la caché: ${e.message}`));
