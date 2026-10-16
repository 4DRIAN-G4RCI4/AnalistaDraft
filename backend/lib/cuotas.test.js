import test from 'node:test';
import assert from 'node:assert/strict';
import { consenso, buscarEvento } from './cuotas.js';
import { ajustarAMercado, combinarGoles, mercados } from './modelo.js';

// Forma de respuesta documentada de GET /v4/sports/{sport}/odds
const evento = {
  id: 'e1', commence_time: '2026-10-17T19:00:00Z', home_team: 'Club America', away_team: 'Pumas UNAM',
  bookmakers: [
    { title: 'DraftKings', markets: [
      { key: 'h2h', outcomes: [{ name: 'Club America', price: 1.8 }, { name: 'Draw', price: 3.6 }, { name: 'Pumas UNAM', price: 4.5 }] },
      { key: 'totals', outcomes: [{ name: 'Over', point: 2.5, price: 1.9 }, { name: 'Under', point: 2.5, price: 1.9 }] },
    ] },
    { title: 'FanDuel', markets: [
      { key: 'h2h', outcomes: [{ name: 'Club America', price: 1.85 }, { name: 'Draw', price: 3.5 }, { name: 'Pumas UNAM', price: 4.2 }] },
      { key: 'totals', outcomes: [{ name: 'Over', point: 2.5, price: 1.95 }, { name: 'Under', point: 2.5, price: 1.85 }, { name: 'Over', point: 3.5, price: 3.1 }, { name: 'Under', point: 3.5, price: 1.35 }] },
    ] },
  ],
};

test('consenso: promedio sin margen, mejor cuota y casa que la paga', () => {
  const m = consenso(evento);
  assert.ok(Math.abs(m.Local.prob + m.Empate.prob + m.Visita.prob - 1) < 1e-9);
  assert.equal(m.Local.cuota, 1.85);
  assert.equal(m.Local.mejorCasa, 'FanDuel');
  assert.equal(m.Local.casas, 2);
  assert.ok(m['Más de 2.5 goles'] && !m['Más de 3.5 goles']); // usa la línea que ofrecen más casas
  assert.ok(m.Local.prob > m.Visita.prob); // paga menos = más probable
});

test('buscarEvento empata por hora y nombres', () => {
  const p = { fecha: '2026-10-17T19:00Z', local: { nombre: 'América' }, visita: { nombre: 'Pumas UNAM' } };
  assert.equal(buscarEvento([evento], p)?.id, 'e1');
  assert.equal(buscarEvento([evento], { ...p, fecha: '2026-10-20T19:00Z' }), null);
});

test('ajuste al mercado reproduce lo que pagan las casas', () => {
  const mercado = { Local: { prob: 0.55 }, Empate: { prob: 0.25 }, Visita: { prob: 0.2 }, 'Más de 2.5 goles': { prob: 0.5 } };
  const g = ajustarAMercado(mercado, { local: 1.2, visita: 1.2 });
  const { probs } = mercados(g.local, g.visita);
  for (const [k, c] of Object.entries(mercado)) assert.ok(Math.abs(probs[k] - c.prob) < 0.03, `${k}: ${probs[k]} vs ${c.prob}`);
  const final = combinarGoles({ local: 1.2, visita: 1.2 }, g);
  assert.ok(final.local > 1.2 && final.local < g.local); // queda entre estadística y casas, más cerca de las casas
});

test('memo: no crece sin límite, tira primero lo vencido y lo más viejo', async () => {
  const { memo } = await import('./datos.js');
  const ok = () => Promise.resolve(1);
  memo('viejo-vencido', 1, ok);
  await new Promise(r => setTimeout(r, 5));
  for (let i = 0; i < 3100; i++) memo(`relleno-${i}`, 60e3, ok);
  let recalculado = false;
  await memo('viejo-vencido', 60e3, () => { recalculado = true; return ok(); });
  assert.ok(recalculado); // la vencida se tiró
  let reusado = true;
  await memo('relleno-3099', 60e3, () => { reusado = false; return ok(); });
  assert.ok(reusado); // las recientes siguen
});

test('csv: comillas, comillas escapadas, campos vacíos y solo las columnas pedidas', async () => {
  const { csv } = await import('./datos.js');
  const t = 'a,b,c,d\n"1","x, y",,"di ""z"""\n2,simple,3,\r\n';
  assert.deepEqual(csv(t, ['b', 'd']), [{ b: 'x, y', d: 'di "z"' }, { b: 'simple', d: '' }]);
  assert.deepEqual(csv(t)[0], { a: '1', b: 'x, y', c: '', d: 'di "z"' });
});
