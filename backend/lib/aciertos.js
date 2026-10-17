// Guarda las predicciones de antes de cada partido en Supabase y, cuando terminan, si se cumplieron.
// Así se puede mostrar el % de acierto real. Apagado si faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.
import { memo, buscarPartido } from './datos.js';
import { evaluar } from '../../frontend/src/evaluar.js'; // la misma regla que "¿Se cumplió?" de la página

const URL_DB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
export const hayDB = () => Boolean(URL_DB && KEY);

const VENTANA = 6 * 3600e3; // se guarda lo último que dijimos en las 6 h antes del inicio
const TERMINADO = 2.5 * 3600e3; // a las 2.5 h del inicio un partido normal ya terminó
const PRINCIPALES = ['Local', 'Empate', 'Visita', 'Local o empate', 'Visita o empate', 'Hay ganador (sin empate)', 'Más de 1.5 goles', 'Más de 2.5 goles', 'Menos de 2.5 goles', 'Menos de 3.5 goles', 'Ambos anotan', 'No ambos anotan'];

async function db(ruta, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${URL_DB}/rest/v1/${ruta}`, {
    method,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...(prefer && { prefer }) },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return method === 'GET' ? r.json() : null;
}

// Lo mismo que se revisa en "¿Se cumplió?": lo recomendado y los mercados principales con 60% o más.
export function filasDe(p) {
  const nombre = m => m.replace(/\bLocal\b/g, p.local.nombre).replace(/\bVisita\b/g, p.visita.nombre);
  const filas = [
    ...(p.resumen.destacadas.lista ?? []).map(x => ({ mercado: x.mercado, categoria: x.categoria, prob: x.prob, cuota: x.cuota ?? null })),
    ...PRINCIPALES.filter(m => p.probs[m] >= 0.6).map(m => ({ mercado: m, categoria: 'goles', prob: p.probs[m], cuota: p.mercado[m]?.cuota ?? null })),
  ];
  const vistos = new Set();
  return filas
    .filter(x => !vistos.has(x.mercado) && vistos.add(x.mercado))
    .map(x => ({ ...x, evento_id: p.id, liga: p.liga, fecha: p.fecha, partido: p.titulo, nombre: nombre(x.mercado) }));
}

// Después de cada análisis: guarda (o reemplaza) las predicciones de los partidos que empiezan pronto.
export function guardarPredicciones(partidos) {
  if (!hayDB()) return;
  const ahora = Date.now();
  for (const p of partidos) {
    const falta = new Date(p.fecha) - ahora;
    if (falta <= 0 || falta > VENTANA) continue;
    // a lo mucho cada 20 min por partido: el análisis se recalcula seguido y no hace falta escribir cada vez
    memo(`guardado:${p.id}`, 20 * 60e3, () =>
      db('predicciones?on_conflict=evento_id,mercado', { method: 'POST', body: filasDe(p), prefer: 'resolution=merge-duplicates' }),
    ).catch(e => console.warn(`No se guardaron predicciones de ${p.id}: ${e.message}`));
  }
}

// Revisa las predicciones de partidos ya terminados y marca si se cumplieron.
export async function revisarPendientes() {
  if (!hayDB()) return 0;
  const limite = new Date(Date.now() - TERMINADO).toISOString();
  const filas = await db(`predicciones?resultado=is.null&fecha=lt.${limite}&select=evento_id,liga,fecha,mercado&limit=1000`);
  const porEvento = filas.reduce((g, f) => ((g[f.evento_id] ??= []).push(f), g), {});
  let revisadas = 0;
  for (const [evento, fs] of Object.entries(porEvento)) {
    const r = await buscarPartido(fs[0].liga, evento, fs[0].fecha).catch(() => null);
    if (r?.estado !== 'post') continue; // aplazado, en curso o no encontrado: se reintenta luego
    const v = { ...r.vivo, estado: 'post' };
    for (const f of fs) {
      const resultado = evaluar(f.mercado, v);
      if (resultado !== 'si' && resultado !== 'no') continue; // sin dato para revisarlo (tiros por jugador…)
      await db(`predicciones?evento_id=eq.${encodeURIComponent(evento)}&mercado=eq.${encodeURIComponent(f.mercado)}`, {
        method: 'PATCH', body: { resultado, revisado_en: new Date().toISOString() },
      });
      revisadas++;
    }
  }
  return revisadas;
}

// % de acierto real: por rango de probabilidad que dimos y por tipo de mercado.
const RANGOS = [[0.6, 0.65], [0.65, 0.7], [0.7, 0.75], [0.75, 0.8], [0.8, 0.86]];
export function resumirAciertos(filas) {
  const grupo = lista => {
    const n = lista.length, si = lista.filter(f => f.resultado === 'si').length;
    return { n, si, acierto: n ? si / n : null, dijimos: n ? lista.reduce((a, f) => a + f.prob, 0) / n : null };
  };
  return {
    total: grupo(filas),
    rangos: RANGOS.map(([a, b]) => ({ desde: a, hasta: b, ...grupo(filas.filter(f => f.prob >= a && f.prob < b)) })).filter(x => x.n),
    categorias: [...new Set(filas.map(f => f.categoria))].map(c => ({ categoria: c, ...grupo(filas.filter(f => f.categoria === c)) })).sort((x, y) => y.n - x.n),
    recientes: [...filas].sort((x, y) => new Date(y.fecha) - new Date(x.fecha)).slice(0, 30),
  };
}

// Últimos 90 días, recalculado cada 30 min.
export const aciertos = () => memo('aciertos', 30 * 60e3, async () => {
  if (!hayDB()) return { configurado: false };
  const desde = new Date(Date.now() - 90 * 864e5).toISOString();
  const filas = await db(`predicciones?resultado=not.is.null&fecha=gte.${desde}&select=partido,nombre,categoria,prob,resultado,fecha,liga&order=fecha.desc&limit=5000`);
  return { configurado: true, ...resumirAciertos(filas) };
});
