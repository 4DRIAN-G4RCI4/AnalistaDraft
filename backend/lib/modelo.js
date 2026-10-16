// Modelo Poisson: goles esperados por equipo -> probabilidades de cada mercado.

const MAX_GOLES = 10;
const PRIOR = 5; // partidos "promedio de liga" que se suman a cada equipo para estabilizar inicio de temporada
const LOCALIA = 1.12; // ventaja de local típica (~25% más goles que el visitante)
const PESO_VALOR = 0.1; // cuánto mueve el valor de plantilla: 10x más caro => ~26% más goles esperados

const pois = (k, l) => {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
};

// local/visita: { pj, gf, gc }; media: goles por equipo por partido en la liga; valores en EUR o null
export function golesEsperados(local, visita, media, valorL, valorV) {
  const fuerza = (goles, pj) => (goles + PRIOR * media) / (pj + PRIOR) / media;
  let gl = media * fuerza(local.gf, local.pj) * fuerza(visita.gc, visita.pj) * LOCALIA;
  let gv = media * fuerza(visita.gf, visita.pj) * fuerza(local.gc, local.pj) / LOCALIA;
  if (valorL > 0 && valorV > 0) {
    const f = (valorL / valorV) ** PESO_VALOR;
    gl *= f;
    gv /= f;
  }
  return { local: gl, visita: gv };
}

const LINEAS_TOTAL = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5];
const LINEAS_EQUIPO = [0.5, 1.5, 2.5];

export function mercados(gl, gv) {
  let total = 0, p1 = 0, px = 0, p2 = 0, ambos = 0;
  const goles = Array(2 * MAX_GOLES + 1).fill(0), golesL = Array(MAX_GOLES + 1).fill(0), golesV = Array(MAX_GOLES + 1).fill(0);
  let marcador = { l: 0, v: 0, p: 0 };
  for (let l = 0; l <= MAX_GOLES; l++) {
    for (let v = 0; v <= MAX_GOLES; v++) {
      const p = pois(l, gl) * pois(v, gv);
      total += p;
      if (l > v) p1 += p; else if (l === v) px += p; else p2 += p;
      goles[l + v] += p; golesL[l] += p; golesV[v] += p;
      if (l > 0 && v > 0) ambos += p;
      if (p > marcador.p) marcador = { l, v, p };
    }
  }
  const n = x => x / total;
  const mas = (dist, linea) => n(dist.reduce((a, p, k) => (k > linea ? a + p : a), 0));
  const probs = {
    'Local': n(p1), 'Empate': n(px), 'Visita': n(p2),
    'Local o empate': n(p1 + px), 'Visita o empate': n(px + p2), 'Hay ganador (sin empate)': n(p1 + p2),
    'Ambos anotan': n(ambos), 'No ambos anotan': 1 - n(ambos),
  };
  for (const l of LINEAS_TOTAL) {
    probs[`Más de ${l} goles`] = mas(goles, l);
    probs[`Menos de ${l} goles`] = 1 - mas(goles, l);
  }
  for (const l of LINEAS_EQUIPO) {
    probs[`Local más de ${l} goles`] = mas(golesL, l);
    probs[`Local menos de ${l} goles`] = 1 - mas(golesL, l);
    probs[`Visita más de ${l} goles`] = mas(golesV, l);
    probs[`Visita menos de ${l} goles`] = 1 - mas(golesV, l);
  }
  return { probs, marcador: { local: marcador.l, visita: marcador.v, prob: n(marcador.p) } };
}

// ---------- corners, tarjetas y tiros ----------
// Binomial negativa: como Poisson pero con más variación, porque corners, tarjetas y tiros varían
// más que los goles. varianza = DISPERSION × media.
const DISPERSION = { corners: 1.35, tarjetas: 1.3, tirosPuerta: 1.3, tiros: 1.5 };
const NOMBRE = { corners: 'corners', tarjetas: 'tarjetas', tirosPuerta: 'tiros a puerta', tiros: 'tiros' };
const LINEAS_CONTEO = {
  corners: { total: [7.5, 8.5, 9.5, 10.5, 11.5], equipo: [2.5, 3.5, 4.5, 5.5, 6.5] },
  tarjetas: { total: [2.5, 3.5, 4.5, 5.5, 6.5], equipo: [0.5, 1.5, 2.5] },
  tirosPuerta: { total: [5.5, 6.5, 7.5, 8.5, 9.5], equipo: [1.5, 2.5, 3.5, 4.5, 5.5] },
  tiros: { total: [18.5, 20.5, 22.5, 24.5, 26.5], equipo: [8.5, 10.5, 12.5, 14.5] },
};

function distNB(media, k, max = 80) {
  const r = media / (k - 1), q = 1 / k;
  const d = [q ** r];
  for (let n = 1; n <= max; n++) d.push(d[n - 1] * ((n - 1 + r) / n) * (1 - q));
  const s = d.reduce((a, b) => a + b, 0);
  return d.map(x => x / s);
}
const masDe = (d, linea) => d.reduce((a, p, k) => (k > linea ? a + p : a), 0);

// Lo esperado de cada equipo: promedio entre lo que genera y lo que su rival suele conceder.
export function conteoEsperado(local, visita, cat) {
  return { local: (local.favor[cat] + visita.contra[cat]) / 2, visita: (visita.favor[cat] + local.contra[cat]) / 2 };
}

export function mercadosConteo(cat, esperado) {
  const k = DISPERSION[cat], nombre = NOMBRE[cat], { total, equipo } = LINEAS_CONTEO[cat];
  const dT = distNB(esperado.local + esperado.visita, k), dL = distNB(esperado.local, k), dV = distNB(esperado.visita, k);
  const probs = {};
  for (const l of total) {
    probs[`Más de ${l} ${nombre}`] = masDe(dT, l);
    probs[`Menos de ${l} ${nombre}`] = 1 - masDe(dT, l);
  }
  for (const l of equipo) {
    probs[`Local más de ${l} ${nombre}`] = masDe(dL, l);
    probs[`Local menos de ${l} ${nombre}`] = 1 - masDe(dL, l);
    probs[`Visita más de ${l} ${nombre}`] = masDe(dV, l);
    probs[`Visita menos de ${l} ${nombre}`] = 1 - masDe(dV, l);
  }
  return probs;
}

// ---------- por tiempos ----------
const FRACCION_1T = 0.44; // en las ligas top ~44% de los goles caen antes del descanso
const PRIOR_GOLES_1T = 20; // goles "promedio" que se suman para que pocos partidos no muevan de más la fracción

// Fracción de goles en el 1T según los últimos partidos de ambos equipos, suavizada hacia la típica.
export const fraccion1T = (goles1T, goles) => (goles1T + PRIOR_GOLES_1T * FRACCION_1T) / (goles + PRIOR_GOLES_1T);

// Cada tiempo es un Poisson con su parte de los goles esperados; los tiempos se tratan como independientes.
export function mercadosTiempos(gl, gv, f1) {
  const M = 8;
  const dist = l => Array.from({ length: M + 1 }, (_, k) => pois(k, l));
  const [L1, V1, L2, V2] = [dist(gl * f1), dist(gv * f1), dist(gl * (1 - f1)), dist(gv * (1 - f1))];
  const p = {};
  const sumar = (k, x) => { p[k] = (p[k] ?? 0) + x; };
  const res = (a, b) => (a > b ? 'Local' : a < b ? 'Visita' : 'Empate');
  let total = 0;
  for (let a = 0; a <= M; a++) for (let b = 0; b <= M; b++) {
    const p1 = L1[a] * V1[b];
    for (let c = 0; c <= M; c++) for (let d = 0; d <= M; d++) {
      const x = p1 * L2[c] * V2[d];
      total += x;
      const g1 = a + b, g2 = c + d;
      sumar({ Local: 'Local gana el 1T', Visita: 'Visita gana el 1T', Empate: 'Empate al descanso' }[res(a, b)], x);
      if (g1 > 0.5) sumar('Más de 0.5 goles en 1T', x);
      if (g1 > 1.5) sumar('Más de 1.5 goles en 1T', x);
      if (g2 > 0.5) sumar('Más de 0.5 goles en 2T', x);
      if (g2 > 1.5) sumar('Más de 1.5 goles en 2T', x);
      if (a > 0) sumar('Local anota en 1T', x);
      if (b > 0) sumar('Visita anota en 1T', x);
      if (c > 0) sumar('Local anota en 2T', x);
      if (d > 0) sumar('Visita anota en 2T', x);
      if (a > 0 && b > 0) sumar('Ambos anotan en 1T', x);
      if (g1 > 0 && g2 > 0) sumar('Gol en ambos tiempos', x);
      sumar(g1 > g2 ? 'Más goles en el 1T' : g1 < g2 ? 'Más goles en el 2T' : 'Mismos goles en ambos tiempos', x);
      sumar(`Descanso/Final: ${res(a, b)}/${res(a + c, b + d)}`, x);
    }
  }
  for (const k of Object.keys(p)) p[k] /= total;
  for (const t of ['1T', '2T']) for (const l of ['0.5', '1.5']) p[`Menos de ${l} goles en ${t}`] = 1 - (p[`Más de ${l} goles en ${t}`] ?? 0);
  return Object.fromEntries(ORDEN_TIEMPOS.map(k => [k, p[k] ?? 0])); // orden de lectura, no de cálculo
}

const R = ['Local', 'Empate', 'Visita'];
const ORDEN_TIEMPOS = [
  'Local gana el 1T', 'Empate al descanso', 'Visita gana el 1T',
  ...['1T', '2T'].flatMap(t => ['0.5', '1.5'].flatMap(l => [`Más de ${l} goles en ${t}`, `Menos de ${l} goles en ${t}`])),
  'Local anota en 1T', 'Visita anota en 1T', 'Local anota en 2T', 'Visita anota en 2T',
  'Ambos anotan en 1T', 'Gol en ambos tiempos',
  'Más goles en el 1T', 'Más goles en el 2T', 'Mismos goles en ambos tiempos',
  ...R.flatMap(h => R.map(f => `Descanso/Final: ${h}/${f}`)),
];
// ---------- goleadores ----------
const PARTE_TIROS = 0.6; // los tiros son más estables que los goles en 5 partidos
const SUPLENTE = 0.25; // alineación confirmada y no es titular: a lo mucho entra de cambio

const alMenos = (n, x) => { // P(Poisson(x) >= n)
  let p = 0, t = Math.exp(-x);
  for (let k = 0; k < n; k++) { p += t; t *= x / (k + 1); }
  return 1 - p;
};

// Por jugador: anotar = su parte de tiros y goles del equipo × goles esperados del equipo;
// tiros y tiros a puerta = su parte de los del equipo × los que se esperan del equipo en este partido.
// esperado: { goles, tiros?, tirosPuerta? } del equipo.
export function probGoleadores(equipo, esperado, titulares = null, max = 8) {
  const { jugadores = [], tirosEquipo = 0, golesEquipo = 0, tirosPuertaEquipo = 0 } = equipo ?? {};
  const golesEsperados = typeof esperado === 'number' ? esperado : esperado.goles;
  return jugadores
    .filter(j => j.pos !== 'G' && (j.tiros > 0 || j.goles > 0))
    .map(j => {
      const parteTiros = tirosEquipo ? j.tiros / tirosEquipo : 0;
      const parteGoles = golesEquipo ? j.goles / golesEquipo : parteTiros;
      let parte = PARTE_TIROS * parteTiros + (1 - PARTE_TIROS) * parteGoles;
      if (titulares?.length && !titulares.includes(j.id)) parte *= SUPLENTE;
      const disponible = titulares?.length && !titulares.includes(j.id) ? SUPLENTE : 1;
      const x = golesEsperados * parte;
      const tiros = esperado.tiros && tirosEquipo ? esperado.tiros * (j.tiros / tirosEquipo) * disponible : null;
      const puerta = esperado.tirosPuerta && tirosPuertaEquipo ? esperado.tirosPuerta * (j.tirosPuerta / tirosPuertaEquipo) * disponible : null;
      return {
        ...j, titularConfirmado: titulares?.length ? titulares.includes(j.id) : null,
        prob: 1 - Math.exp(-x), prob2: alMenos(2, x),
        tirosEsperados: tiros, tiros1: tiros != null ? alMenos(1, tiros) : null, tiros2: tiros != null ? alMenos(2, tiros) : null, tiros3: tiros != null ? alMenos(3, tiros) : null,
        puertaEsperados: puerta, puerta1: puerta != null ? alMenos(1, puerta) : null, puerta2: puerta != null ? alMenos(2, puerta) : null,
      };
    })
    .sort((a, b) => b.prob - a.prob)
    .slice(0, max);
}

// Cuota baja = las casas lo ven probable. El mercado suele acertar más que un modelo de tabla,
// así que pesa más al combinar.
const PESO_CASAS = 0.7;

// Goles esperados que reproducen lo que pagan las casas (1X2 y/o over/under), anclados al modelo
// para que con un solo mercado (p. ej. solo over/under) el ajuste no se dispare.
export function ajustarAMercado(mercado, base) {
  const objetivos = Object.entries(mercado).map(([m, c]) => [m, c.prob]);
  if (!objetivos.length) return null;
  const error = (gl, gv) => {
    const { probs } = mercados(gl, gv);
    return objetivos.reduce((a, [m, p]) => a + (probs[m] - p) ** 2, 0) + 1e-4 * ((gl - base.local) ** 2 + (gv - base.visita) ** 2);
  };
  let mejor = { gl: base.local, gv: base.visita, e: error(base.local, base.visita) };
  for (const [paso, radio, centro] of [[0.1, 2, { gl: 2.1, gv: 2.1 }], [0.01, 0.1, null]]) {
    const c = centro ?? mejor;
    for (let gl = Math.max(0.1, c.gl - radio); gl <= c.gl + radio; gl += paso) {
      for (let gv = Math.max(0.1, c.gv - radio); gv <= c.gv + radio; gv += paso) {
        const e = error(gl, gv);
        if (e < mejor.e) mejor = { gl, gv, e };
      }
    }
  }
  return { local: mejor.gl, visita: mejor.gv };
}

// Promedio geométrico: 70% lo que dicen las casas, 30% la estadística.
export const combinarGoles = (modelo, casas) => ({
  local: casas.local ** PESO_CASAS * modelo.local ** (1 - PESO_CASAS),
  visita: casas.visita ** PESO_CASAS * modelo.visita ** (1 - PESO_CASAS),
});

// Momio americano ("+215", "-145", 275) -> cuota decimal
export function decimal(americano) {
  const a = Number(americano);
  if (!a) return null;
  return a > 0 ? 1 + a / 100 : 1 + 100 / -a;
}

// Probabilidad implícita sin el margen de la casa (normaliza el grupo de cuotas)
export function sinMargen(cuotas) {
  const inv = cuotas.map(c => (c ? 1 / c : null));
  if (inv.some(x => x === null)) return null;
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map(x => x / s);
}

// partidos: [{ id, titulo, probs (final), modelo (solo estadística), mercado: { [nombreMercado]: { cuota, prob } } }]
// Una selección por partido: los parlays asumen independencia entre partidos.
// La selección recomendada de un partido: la más probable sin pasar de maxProb.
// Arriba de 85% la cuota baja de 1.18 (Más de 0.5, Menos de 6.5 llegan a ~1.05): suma una pata y riesgo sin subir el momio.
export function seleccionSugerida(probs, { minProb = 0.6, maxProb = 0.85 } = {}) {
  const [mercado, prob] = Object.entries(probs).filter(([, p]) => p <= maxProb).sort((a, b) => b[1] - a[1])[0] ?? [];
  return prob >= minProb ? { mercado, prob } : null;
}

// "Con valor": donde la estadística pura ve más que las casas. La prob. mostrada es la final (ajustada al mercado).
// maxValor: diferencias enormes contra la casa casi siempre son error del modelo (lesiones, rotaciones), no valor real.
export function armarParlays(partidos, { minValor = 0.03, maxValor = 0.12, maxPiernas = 4 } = {}) {
  const segura = [];
  const valor = [];
  for (const p of partidos) {
    const s = seleccionSugerida(p.probs);
    if (s) segura.push({ partidoId: p.id, partido: p.titulo, ...s, cuota: p.mercado[s.mercado]?.cuota ?? null });
    const conValor = Object.entries(p.mercado)
      .map(([m, c]) => ({ partidoId: p.id, partido: p.titulo, mercado: m, prob: p.probs[m], cuota: c.cuota, ventaja: (p.modelo ?? p.probs)[m] - c.prob }))
      .filter(x => x.ventaja >= minValor && x.ventaja <= maxValor && x.prob >= 0.45)
      .sort((a, b) => b.ventaja - a.ventaja)[0];
    if (conValor) valor.push(conValor);
  }
  const combinar = (piernas, orden) => {
    const top = piernas.sort(orden).slice(0, maxPiernas);
    const prob = top.reduce((a, x) => a * x.prob, 1);
    const cuota = top.every(x => x.cuota) ? top.reduce((a, x) => a * x.cuota, 1) : null;
    return top.length >= 2 ? { piernas: top, prob, cuotaJusta: 1 / prob, cuotaCasa: cuota } : null;
  };
  return {
    masProbable: combinar(segura, (a, b) => b.prob - a.prob),
    conValor: combinar(valor, (a, b) => b.ventaja - a.ventaja),
  };
}
