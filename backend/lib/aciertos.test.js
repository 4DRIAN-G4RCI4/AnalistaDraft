import test from 'node:test';
import assert from 'node:assert/strict';
import { filasDe, resumirAciertos } from './aciertos.js';

test('filasDe: recomendadas + principales ≥60%, sin repetir y con nombres de equipo', () => {
  const p = {
    id: '1', liga: 'mex.1', fecha: '2026-10-17T02:00Z', titulo: 'Necaxa vs Atlas',
    local: { nombre: 'Necaxa' }, visita: { nombre: 'Atlas' },
    probs: { 'Visita o empate': 0.64, 'Más de 1.5 goles': 0.84, Local: 0.36 },
    mercado: {},
    resumen: { destacadas: { lista: [{ mercado: 'Más de 1.5 goles', categoria: 'goles', prob: 0.84 }, { mercado: 'Más de 7.5 corners', categoria: 'corners', prob: 0.83 }] } },
  };
  const f = filasDe(p);
  assert.deepEqual(f.map(x => x.mercado), ['Más de 1.5 goles', 'Más de 7.5 corners', 'Visita o empate']);
  assert.equal(f[2].nombre, 'Atlas o empate');
  assert.equal(f[0].evento_id, '1');
});

test('resumirAciertos: % por rango y por tipo', () => {
  const fila = (prob, resultado, categoria = 'goles') => ({ prob, resultado, categoria, fecha: '2026-10-16' });
  const r = resumirAciertos([fila(0.82, 'si'), fila(0.81, 'si'), fila(0.83, 'no'), fila(0.62, 'no', 'corners')]);
  assert.equal(r.total.n, 4);
  const ochenta = r.rangos.find(x => x.desde === 0.8);
  assert.equal(ochenta.n, 3);
  assert.ok(Math.abs(ochenta.acierto - 2 / 3) < 1e-9);
  assert.equal(r.categorias[0].categoria, 'goles');
  assert.equal(r.categorias.find(c => c.categoria === 'corners').acierto, 0);
});
