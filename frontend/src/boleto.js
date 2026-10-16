// Análisis de un boleto armado por el usuario: puntos fuertes, alertas y balance.
// pierna: { partidoId, partido, mercado, prob, cuota?, manual? }

const MARGEN_CASA = 0.95; // las selecciones manuales se estiman con el momio quitando ~5% de margen de la casa
const pct = (p) => `${Math.round(p * 100)}%`;
const dinero = (n) => `$${n.toFixed(2)}`;

export const probManual = (cuota) => Math.min(0.99, MARGEN_CASA / cuota);

// monto: lo apostado; momio: momio total decimal que da la casa (opcional)
export function analizarBoleto(piernas, { monto = 0, momio = null } = {}) {
  if (!piernas.length) return null;
  const prob = piernas.reduce((a, x) => a * x.prob, 1);
  const cuotaCasa = momio || (piernas.every((x) => x.cuota) ? piernas.reduce((a, x) => a * x.cuota, 1) : null);
  const fuertes = [];
  const alertas = [];
  const balance = [];

  const seguras = piernas.filter((x) => !x.manual && x.prob >= 0.8);
  if (seguras.length) fuertes.push(`${seguras.length} selección(es) con 80% o más: ${seguras.map((x) => `${x.mercado} (${pct(x.prob)}${x.cuota ? `, paga ${x.cuota.toFixed(2)}` : ""})`).join(", ")}.`);
  const baratas = piernas.filter((x) => x.cuota && x.cuota <= 1.5 && x.prob < 0.8);
  if (baratas.length) fuertes.push(`Las casas pagan poco (cuota 1.50 o menos) por ${baratas.map((x) => x.mercado).join(", ")}: las ven factibles.`);
  const solidas = piernas.filter((x) => !x.manual && x.prob >= 0.65 && x.prob < 0.8);
  if (solidas.length) fuertes.push(`${solidas.length} selección(es) sólidas entre 65% y 80%.`);

  for (const x of piernas.filter((x) => x.prob < 0.6)) {
    alertas.push(`Mayor riesgo: ${x.mercado} en ${x.partido} (${pct(x.prob)}).`);
  }
  const manuales = piernas.filter((x) => x.manual);
  if (manuales.length) {
    alertas.push(`${manuales.length} selección(es) sin modelo (corners, jugadores, etc.): su probabilidad se estimó solo con el momio de la casa.`);
  }
  const porPartido = piernas.reduce((g, x) => {
    (g[x.partidoId ?? x.partido] ??= []).push(x);
    return g;
  }, {});
  const repetidos = Object.values(porPartido).filter((g) => g.length > 1);
  if (repetidos.length) {
    alertas.push(`Hay ${repetidos.length} partido(s) con varias selecciones: están relacionadas (un 0-0 o una roja temprana las tumba juntas), así que la probabilidad real puede ser menor.`);
  }

  const micro = piernas.filter((x) => x.prob >= 0.9);
  if (micro.length) {
    const multiplica = micro.reduce((a, x) => a * (1 / x.prob), 1);
    const riesgo = 1 - micro.reduce((a, x) => a * x.prob, 1);
    balance.push(`${micro.length} selección(es) de 90% o más ("momios microscópicos") solo multiplican el momio ×${multiplica.toFixed(2)}, pero suman ${pct(riesgo)} de probabilidad de que alguna falle.`);
  }
  if (piernas.length > 6) {
    balance.push(`Con ${piernas.length} selecciones, la probabilidad de que al menos una falle es ${pct(1 - prob)}. Menos patas, mejor elegidas, suele rendir más.`);
  }
  balance.push(`Probabilidad estimada de cobrar: ${pct(prob)} (cuota justa ${(1 / prob).toFixed(2)}).`);

  let retorno = null, valorEsperado = null;
  if (cuotaCasa) {
    valorEsperado = prob * cuotaCasa - 1;
    if (monto > 0) {
      retorno = monto * cuotaCasa;
      balance.push(`Apostando ${dinero(monto)} con momio ${cuotaCasa.toFixed(2)} cobrarías ${dinero(retorno)}; en promedio recuperas ${dinero(monto * prob * cuotaCasa)}.`);
    }
    // Ninguna casa paga el doble de lo justo: si pasa, el boleto capturado no es el mismo que el de la casa.
    if (valorEsperado > 0.5) {
      alertas.push(`El momio ${cuotaCasa.toFixed(2)} es mucho mayor que la cuota justa ${(1 / prob).toFixed(2)}: revisa que las selecciones sean las mismas del boleto de la casa (o que el modelo no esté sobrestimando alguna).`);
    } else {
      balance.push(valorEsperado >= 0
        ? `Según el modelo el momio paga más de lo justo (+${pct(valorEsperado)} de valor esperado). Aun así puede perder.`
        : `Según el modelo el momio paga menos de lo justo (${pct(valorEsperado)} de valor esperado): a la larga se pierde dinero con boletos así.`);
    }
  }

  return { prob, cuotaJusta: 1 / prob, cuotaCasa, retorno, valorEsperado, fuertes, alertas, balance };
}
