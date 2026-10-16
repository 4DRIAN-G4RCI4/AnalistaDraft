// Nombres y armado de selecciones compartidos por tarjetas, destacadas y boleto.

export const CATEGORIA = { tiempos: "Tiempos", corners: "Corners", tarjetas: "Tarjetas", tirosPuerta: "Tiros a puerta", tiros: "Tiros" };

// "Local más de 1.5 goles" -> "Necaxa más de 1.5 goles"
export const nombreMercado = (m, p) => m.replace(/\bLocal\b/g, p.local.nombre).replace(/\bVisita\b/g, p.visita.nombre);

// Selección lista para el boleto. prob/cuota vienen del modelo final o de corners/tarjetas/tiros.
export function pierna(p, m, prob, cuota = null) {
  return { partidoId: p.id, partido: p.titulo, fecha: p.fecha, mercado: nombreMercado(m, p), prob, cuota };
}
