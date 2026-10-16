export const pct = (p) => `${Math.round(p * 100)}%`;

export function eur(v) {
  if (v == null) return "sin dato";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(v);
}

export const fecha = (s) =>
  new Date(s).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Solo enlaces https: el contenido viene de fuentes externas.
export const linkSeguro = (u) => (/^https:\/\//.test(u || "") ? u : null);

// Momio americano como lo muestran Caliente o Draftea: 2.50 -> "+150", 1.50 -> "-200"
export function americano(dec) {
  if (!dec || dec <= 1) return "";
  return dec >= 2 ? `+${Math.round((dec - 1) * 100)}` : `-${Math.round(100 / (dec - 1))}`;
}

// "1.80 (-125)"
export const momio = (dec) => `${dec.toFixed(2)} (${americano(dec)})`;
