import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LIGAS, tabla, partidos, noticias, valorPlantilla } from './lib/datos.js';
import { golesEsperados, mercados, decimal, sinMargen, armarParlays, ajustarAMercado, combinarGoles, conteoEsperado, mercadosConteo, fraccion1T, mercadosTiempos, probGoleadores } from './lib/modelo.js';
import { previa, estadisticasEquipo, CATEGORIAS } from './lib/stats.js';
import { eventosLiga, buscarEvento, consenso } from './lib/cuotas.js';
import { resumenPartido } from './lib/analisis.js';

const PORT = Number(process.env.PORT) || 4000; // el frontend (Vite) hace proxy de /api a este puerto
const HOST = process.env.HOST || '127.0.0.1'; // en producción (Render) HOST=0.0.0.0

// Límite de consultas a la API por persona: la página hace 1-2 por liga, esto solo frena abusos.
const LIMITE_POR_MINUTO = 60;
const consultas = new Map();
function excedeLimite(req) {
  // Detrás del proxy de Render la IP real viene en x-forwarded-for
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress).split(',')[0].trim();
  const ahora = Date.now();
  const c = consultas.get(ip);
  if (!c || ahora - c.desde > 60e3) {
    if (consultas.size > 10_000) consultas.clear(); // evita que el mapa crezca sin fin
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
    return { extras, forma: { local: sl, visita: sv }, alineacion: pr.alineacion, titulares: pr.titulares };
  } catch (e) {
    console.warn(`Sin previa de ${p.id}: ${e.message}`);
    return { extras: {}, forma: null, alineacion: {}, titulares: {} };
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
      const c1x2 = [m.local, m.empate, m.visita].map(decimal);
      sinMargen(c1x2)?.forEach((prob, i) => { mercado[['Local', 'Empate', 'Visita'][i]] = { cuota: c1x2[i], prob }; });
      const lineas = [`Más de ${m.linea} goles`, `Menos de ${m.linea} goles`];
      if (lineas[0] in modelo) {
        const cou = [m.mas, m.menos].map(decimal);
        sinMargen(cou)?.forEach((prob, i) => { mercado[lineas[i]] = { cuota: cou[i], prob }; });
      }
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

const enviar = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/') && excedeLimite(req)) return enviar(res, 429, { error: 'Demasiadas consultas, espera un minuto.' });
    if (url.pathname === '/api/ligas') return enviar(res, 200, LIGAS);
    if (url.pathname === '/api/analisis') {
      const liga = url.searchParams.get('liga');
      if (!Object.hasOwn(LIGAS, liga)) return enviar(res, 400, { error: 'Liga inválida' });
      const dias = Math.min(Math.max(parseInt(url.searchParams.get('dias'), 10) || 7, 1), 14);
      return enviar(res, 200, await analizar(liga, dias));
    }
    if (url.pathname.startsWith('/api/')) return enviar(res, 404, { error: 'No encontrado' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return enviar(res, 405, { error: 'Método no permitido' });
    return estatico(res, url.pathname);
  } catch (e) {
    console.error(e);
    enviar(res, 502, { error: `No se pudieron obtener los datos: ${e.message}` });
  }
}).listen(PORT, HOST, () => console.log(`AnalistaDraft en http://${HOST}:${PORT}`));
