// Acomoda a los titulares en líneas según la formación ("4-1-4-1"): portero y luego de atrás hacia adelante,
// cada línea ordenada de izquierda a derecha. Si la formación no cuadra con las posiciones, devuelve null.
const PROFUNDIDAD = { G: 0, GK: 0, CD: 1, D: 1, SW: 1, LB: 1, RB: 1, LWB: 1.5, RWB: 1.5, DM: 2, CM: 3, M: 3, LM: 3, RM: 3, AM: 4, LW: 5, RW: 5, CF: 5, F: 5, ST: 5, FW: 5 };

const base = (pos) => pos.replace(/-(L|R)$/, "");
const profundidad = (pos) => PROFUNDIDAD[base(pos)] ?? 3;
const lado = (pos) => (/^(LB|LM|LW|LWB)$/.test(pos) ? 0 : /-L$/.test(pos) ? 1 : /-R$/.test(pos) ? 3 : /^(RB|RM|RW|RWB)$/.test(pos) ? 4 : 2);

export function lineas(titulares, formacion) {
  const cuentas = String(formacion ?? "").split("-").map(Number);
  if (titulares.length !== 11 || cuentas.some((n) => !n) || cuentas.reduce((a, b) => a + b, 0) !== 10) return null;
  const orden = [...titulares].sort((a, b) => profundidad(a.pos) - profundidad(b.pos));
  if (profundidad(orden[0].pos) !== 0) return null;
  const filas = [[orden[0]]];
  let i = 1;
  for (const n of cuentas) {
    filas.push(orden.slice(i, i + n).sort((a, b) => lado(a.pos) - lado(b.pos)));
    i += n;
  }
  return filas;
}
