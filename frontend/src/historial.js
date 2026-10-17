// Qué apuestas comunes se habrían cumplido en los últimos partidos de un equipo.
// r: { gf, gc, corners } de un partido (goles a favor/en contra del equipo, corners totales o null).
export const APUESTAS = [
  ["Gana", (r) => r.gf > r.gc],
  ["Gana o empata", (r) => r.gf >= r.gc],
  ["Anota", (r) => r.gf > 0],
  ["Más de 1.5 goles", (r) => r.gf + r.gc > 1.5],
  ["Más de 2.5 goles", (r) => r.gf + r.gc > 2.5],
  ["Menos de 3.5 goles", (r) => r.gf + r.gc < 3.5],
  ["Ambos anotan", (r) => r.gf > 0 && r.gc > 0],
  ["Más de 8.5 corners", (r) => r.corners != null && r.corners > 8.5],
];

const valido = (r) => Number.isFinite(r.gf) && Number.isFinite(r.gc);

// Por partido: las apuestas que se cumplieron (el "parlay ganador" de ese partido).
export const ganadoras = (r) => (valido(r) ? APUESTAS.filter(([, f]) => f(r)).map(([n]) => n) : []);

// Resumen: cuántas veces se cumplió cada apuesta, de más a menos.
export function resumen(resultados) {
  const ok = resultados.filter(valido);
  return APUESTAS.map(([nombre, f]) => {
    const aplica = nombre.includes("corners") ? ok.filter((r) => r.corners != null) : ok;
    return { nombre, veces: aplica.filter(f).length, de: aplica.length };
  })
    .filter((x) => x.de > 0)
    .sort((a, b) => b.veces / b.de - a.veces / a.de);
}
