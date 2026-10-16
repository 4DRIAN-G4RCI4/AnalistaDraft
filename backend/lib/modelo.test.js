import test from 'node:test';
import assert from 'node:assert/strict';
import { golesEsperados, mercados, decimal, sinMargen, armarParlays, seleccionSugerida } from './modelo.js';
import { resumenPartido } from './analisis.js';
import { mejorCoincidencia } from './datos.js';

test('probabilidades 1X2 suman 1 y el favorito gana más', () => {
  const { probs, marcador } = mercados(2.0, 0.8);
  assert.ok(Math.abs(probs.Local + probs.Empate + probs.Visita - 1) < 1e-9);
  assert.ok(probs.Local > probs.Visita);
  assert.ok(probs['Más de 1.5 goles'] > probs['Más de 2.5 goles']);
  assert.equal(marcador.local >= marcador.visita, true);
});

test('líneas de goles y por equipo son consistentes', () => {
  const { probs } = mercados(1.6, 1.1);
  assert.ok(probs['Más de 0.5 goles'] > probs['Más de 1.5 goles'] && probs['Más de 5.5 goles'] > probs['Más de 6.5 goles']);
  assert.ok(Math.abs(probs['Más de 2.5 goles'] + probs['Menos de 2.5 goles'] - 1) < 1e-12);
  assert.ok(Math.abs(probs['Hay ganador (sin empate)'] + probs.Empate - 1) < 1e-9);
  assert.ok(probs['Local más de 0.5 goles'] > probs['Visita más de 0.5 goles']);
  // P(local anota 0) = e^-λ
  assert.ok(Math.abs(probs['Local menos de 0.5 goles'] - Math.exp(-1.6)) < 1e-6);
});

test('selección sugerida evita momios microscópicos', () => {
  const s = seleccionSugerida(mercados(2.5, 1.5).probs);
  assert.ok(s.prob <= 0.85 && s.prob >= 0.6);
  assert.notEqual(s.mercado, 'Más de 0.5 goles');
});

test('resumen por partido: favorito, alertas de datos y bajas', () => {
  const { probs } = mercados(2.4, 0.6);
  const e = (nombre, valor, pj) => ({ nombre, valor, pj, forma: 'WWLWD' });
  const r = resumenPartido({
    probs, mercado: { Local: { cuota: 1.2, prob: 0.6 } }, casa: 'DraftKings',
    golesEsperados: { local: 2.4, visita: 0.6 },
    local: e('Bayern', 9e8, 8), visita: e('Recién', null, 2),
    noticias: [{ alerta: true }, { alerta: false }],
  });
  assert.ok(r.fuertes.some(x => x.includes('Bayern es favorito')));
  assert.ok(r.alertas.some(x => x.includes('no coinciden'))); // modelo ~78% vs casa 60%
  assert.ok(r.alertas.some(x => x.includes('pocos partidos')));
  assert.ok(r.alertas.some(x => x.includes('Sin valor de plantilla de Recién')));
  assert.ok(r.alertas.some(x => x.includes('1 noticia')));
  assert.ok(r.sugerida && r.balance.startsWith('Selección sugerida'));
});

test('equipos iguales: localía favorece al local; más valor de plantilla sube goles', () => {
  const t = { pj: 5, gf: 7, gc: 7 };
  const base = golesEsperados(t, t, 1.4, null, null);
  assert.ok(base.local > base.visita);
  const rico = golesEsperados(t, t, 1.4, 1e9, 1e8);
  assert.ok(rico.local > base.local && rico.visita < base.visita);
});

test('momios americanos y margen', () => {
  assert.equal(decimal('+150'), 2.5);
  assert.equal(decimal('-200'), 1.5);
  const p = sinMargen([2.0, 3.5, 3.8]);
  assert.ok(Math.abs(p.reduce((a, b) => a + b) - 1) < 1e-9);
});

test('parlay: una pierna por partido, prob = producto', () => {
  const mk = (titulo, gl, gv) => ({ titulo, probs: mercados(gl, gv).probs, mercado: {} });
  const { masProbable } = armarParlays([mk('A', 2.5, 0.5), mk('B', 2.2, 0.6), mk('C', 1.1, 1.1)]);
  assert.ok(masProbable.piernas.length >= 2);
  assert.equal(new Set(masProbable.piernas.map(p => p.partido)).size, masProbable.piernas.length);
  const prod = masProbable.piernas.reduce((a, p) => a * p.prob, 1);
  assert.ok(Math.abs(masProbable.prob - prod) < 1e-12);
});

test('empate de nombres ESPN -> Transfermarkt', () => {
  const tm = ['Manchester City', 'Manchester United', 'Club América', 'Pumas UNAM', 'Atlético de Madrid', 'Real Madrid', 'Le Havre AC', 'Deportivo Alavés']
    .map(nombre => ({ nombre }));
  assert.equal(mejorCoincidencia('Manchester United', tm).nombre, 'Manchester United');
  assert.equal(mejorCoincidencia('América', tm).nombre, 'Club América');
  assert.equal(mejorCoincidencia('UNAM Pumas', tm).nombre, 'Pumas UNAM');
  assert.equal(mejorCoincidencia('Atletico Madrid', tm).nombre, 'Atlético de Madrid');
  assert.equal(mejorCoincidencia('Alavés', tm).nombre, 'Deportivo Alavés');
  assert.equal(mejorCoincidencia('Le Mans', tm), null);
  assert.equal(mejorCoincidencia('Deportivo', tm), null);
  assert.equal(mejorCoincidencia('Real Oviedo', tm), null);
  assert.equal(mejorCoincidencia('Real Madrid', tm).nombre, 'Real Madrid');
  assert.equal(mejorCoincidencia('Leeds United', tm), null);
  const it = ['Associazione Sportiva Roma', 'Società Sportiva Lazio S.p.A.', 'AC Milan', 'Inter Milan'].map(nombre => ({ nombre }));
  assert.equal(mejorCoincidencia('AS Roma', it).nombre, 'Associazione Sportiva Roma');
  assert.equal(mejorCoincidencia('Lazio', it).nombre, 'Società Sportiva Lazio S.p.A.');
  assert.equal(mejorCoincidencia('AC Milan', it).nombre, 'AC Milan');
  assert.equal(mejorCoincidencia('Internazionale', it).nombre, 'Inter Milan');
});

test('corners/tarjetas/tiros: binomial negativa coherente y más variable que Poisson', async () => {
  const { conteoEsperado, mercadosConteo } = await import('./modelo.js');
  const L = { favor: { corners: 6, tarjetas: 2, tirosPuerta: 5, tiros: 14 }, contra: { corners: 4, tarjetas: 2, tirosPuerta: 3, tiros: 10 } };
  const V = { favor: { corners: 4, tarjetas: 2.5, tirosPuerta: 3, tiros: 10 }, contra: { corners: 5, tarjetas: 1.5, tirosPuerta: 4, tiros: 12 } };
  const e = conteoEsperado(L, V, 'corners');
  // con 5 partidos se acerca a lo típico (5 corners): (6+4)/2=5.5 sin suavizar
  assert.ok(e.local > 5 && e.local < 5.5);
  assert.ok(e.visita > 4 && e.visita < 5);
  const p = mercadosConteo('corners', e);
  assert.ok(Math.abs(p['Más de 9.5 corners'] + p['Menos de 9.5 corners'] - 1) < 1e-12);
  assert.ok(p['Más de 7.5 corners'] > p['Más de 11.5 corners']);
  assert.ok(p['Local más de 4.5 corners'] > p['Visita más de 4.5 corners']);
  // media 9.5: Poisson daría P(>9.5) ≈ 46%; con más variación sigue cerca de la mitad
  assert.ok(p['Más de 9.5 corners'] > 0.35 && p['Más de 9.5 corners'] < 0.5);
  assert.ok('Más de 4.5 tarjetas' in mercadosConteo('tarjetas', conteoEsperado(L, V, 'tarjetas')));
});

test('destacadas: más probable, valor y mejor de corners/tarjetas/tiros', () => {
  const { probs } = mercados(1.8, 1.0);
  const r = resumenPartido({
    fecha: new Date(Date.now() + 864e5).toISOString(), probs, modelo: { ...probs, Local: probs.Local + 0.06 },
    mercado: { Local: { cuota: 1.9, prob: probs.Local } }, casa: 'DraftKings', golesEsperados: { local: 1.8, visita: 1 },
    local: { id: '1', nombre: 'A', valor: 1e8, pj: 6 }, visita: { id: '2', nombre: 'B', valor: 1e8, pj: 6 }, noticias: [],
    extras: { corners: { esperado: { local: 5, visita: 4 }, probs: { 'Más de 7.5 corners': 0.7, 'Más de 6.5 corners': 0.95 } } },
  });
  const d = r.destacadas;
  assert.ok(d.probable.prob <= 0.85 && d.probable.prob >= 0.6);
  assert.equal(d.valor.mercado, 'Local');
  assert.equal(d.extra.mercado, 'Más de 7.5 corners'); // 95% se descarta por microscópica
  assert.ok(r.datos.some(x => x.startsWith('Corners: se esperan 9.0')));
});

test('por tiempos: probabilidades coherentes', async () => {
  const { mercadosTiempos, fraccion1T } = await import('./modelo.js');
  assert.ok(Math.abs(fraccion1T(0, 0) - 0.44) < 1e-12);
  assert.ok(fraccion1T(20, 20) > 0.44 && fraccion1T(20, 20) < 1);
  const t = mercadosTiempos(1.6, 1.1, 0.44);
  assert.ok(Math.abs(t['Local gana el 1T'] + t['Empate al descanso'] + t['Visita gana el 1T'] - 1) < 1e-9);
  assert.ok(t['Más de 0.5 goles en 2T'] > t['Más de 0.5 goles en 1T']); // 56% de los goles en el 2T
  // P(sin gol en 1T) = e^-(2.7·0.44)
  assert.ok(Math.abs(t['Menos de 0.5 goles en 1T'] - Math.exp(-2.7 * 0.44)) < 1e-6);
  const htft = Object.entries(t).filter(([k]) => k.startsWith('Descanso/Final')).reduce((a, [, v]) => a + v, 0);
  assert.ok(Math.abs(htft - 1) < 1e-9);
  // Medio tiempo/final debe cuadrar con el 1X2 del partido completo
  const { probs } = mercados(1.6, 1.1);
  const finalLocal = ['Local', 'Empate', 'Visita'].reduce((a, h) => a + t[`Descanso/Final: ${h}/Local`], 0);
  assert.ok(Math.abs(finalLocal - probs.Local) < 0.01);
});

test('goleadores: parte de tiros y goles, suplentes bajan', async () => {
  const { probGoleadores } = await import('./modelo.js');
  const equipo = {
    tirosEquipo: 60, golesEquipo: 8,
    jugadores: [
      { id: '9', nombre: 'Delantero', pos: 'F', goles: 5, tiros: 20 },
      { id: '8', nombre: 'Medio', pos: 'M', goles: 1, tiros: 10 },
      { id: '1', nombre: 'Portero', pos: 'G', goles: 0, tiros: 0 },
    ],
  };
  const g = probGoleadores(equipo, 1.8);
  assert.equal(g.length, 2);
  assert.equal(g[0].nombre, 'Delantero');
  // parte = 0.6·(20/60) + 0.4·(5/8) = 0.45 → x = 0.81
  assert.ok(Math.abs(g[0].prob - (1 - Math.exp(-0.81))) < 1e-9);
  const conXI = probGoleadores(equipo, 1.8, ['8']);
  assert.ok(conXI.find(j => j.nombre === 'Delantero').prob < g[0].prob);
});

test('jugadores: tiros y tiros a puerta esperados según su parte del equipo', async () => {
  const { probGoleadores } = await import('./modelo.js');
  const equipo = { tirosEquipo: 60, golesEquipo: 8, tirosPuertaEquipo: 20, jugadores: [{ id: '9', nombre: 'D', pos: 'F', goles: 5, tiros: 20, tirosPuerta: 8 }] };
  const [d] = probGoleadores(equipo, { goles: 1.8, tiros: 15, tirosPuerta: 5 });
  assert.equal(d.tirosEsperados, 5); // 15 × 20/60
  assert.equal(d.puertaEsperados, 2); // 5 × 8/20
  assert.ok(Math.abs(d.puerta1 - (1 - Math.exp(-2))) < 1e-12);
  assert.ok(d.tiros1 > d.tiros2 && d.tiros2 > d.tiros3);
});

test('recomendación: nivel y cuándo apostar', async () => {
  const { recomendacion } = await import('./analisis.js');
  const p = { fecha: new Date(Date.now() + 5 * 3600e3).toISOString(), ajustadoACasas: true };
  const d = { lista: [{ categoria: 'goles', prob: 0.8 }], valor: null };
  assert.deepEqual(recomendacion(p, d, { horas: 5, confirmadas: false, bajas: 0, alertas: [] }).nivel, 'alta');
  assert.equal(recomendacion(p, d, { horas: 5, confirmadas: false, bajas: 0, alertas: [] }).cuando.momento, 'ahora');
  assert.equal(recomendacion(p, d, { horas: 5, confirmadas: false, bajas: 2, alertas: ['x'] }).cuando.momento, 'esperar');
  assert.equal(recomendacion(p, d, { horas: 5, confirmadas: true, bajas: 2, alertas: ['x'] }).cuando.momento, 'ahora');
  assert.equal(recomendacion({ ...p, ajustadoACasas: false }, d, { horas: 5, confirmadas: false, bajas: 0, alertas: [] }).nivel, 'media');
  assert.equal(recomendacion(p, { lista: [], valor: null }, { horas: 5, confirmadas: false, bajas: 0, alertas: [] }).cuando.momento, 'evitar');
  // una de corners no es "alta": las casas no la respaldan aunque tenga 80%
  assert.equal(recomendacion(p, { lista: [{ categoria: 'corners', prob: 0.8 }] }, { horas: 5, confirmadas: false, bajas: 0, alertas: [] }).nivel, 'media');
  // partido ya empezado: nivel baja y evitar
  const empezado = recomendacion(p, d, { horas: -0.5, confirmadas: true, bajas: 0, alertas: [] });
  assert.equal(empezado.nivel, 'baja');
  assert.equal(empezado.cuando.momento, 'evitar');
});

test('recomendadas por partido: una por tipo, entre 60% y 85%, con razón', async () => {
  const { recomendadasPartido } = await import('./analisis.js');
  const { probs } = mercados(2.2, 0.9);
  const forma = { favor: { corners: 7, tarjetas: 2, tirosPuerta: 6, tiros: 16 }, contra: { corners: 3, tarjetas: 2, tirosPuerta: 3, tiros: 9 } };
  const lista = recomendadasPartido({
    local: { nombre: 'Barcelona' }, visita: { nombre: 'Betis' }, probs, mercado: {}, golesEsperados: { local: 2.2, visita: 0.9 },
    forma: { local: forma, visita: forma },
    extras: { corners: { esperado: { local: 6, visita: 4 }, probs: { 'Local más de 4.5 corners': 0.72, 'Más de 7.5 corners': 0.8, 'Más de 6.5 corners': 0.9 } } },
    goleadores: { local: [{ nombre: 'Lewandowski', tiros: 18, tirosPuerta: 8, goles: 4, partidos: 5, prob: 0.5, puerta1: 0.8, tiros2: 0.7 }], visita: [] },
  });
  assert.ok(lista.length >= 3);
  assert.equal(new Set(lista.map(x => x.categoria)).size, lista.length); // una por tipo
  assert.ok(lista.every(x => x.prob >= 0.6 && x.prob <= 0.85 && x.razon));
  const corners = lista.find(x => x.categoria === 'corners');
  assert.equal(corners.mercado, 'Más de 7.5 corners'); // 90% se descarta por pagar muy poco
  assert.ok(corners.razon.includes('Barcelona domina'));
  assert.ok(lista.some(x => x.nombre === 'Lewandowski 1+ tiros a puerta'));
});
