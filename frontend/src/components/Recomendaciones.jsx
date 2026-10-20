import { useState } from "react";
import { fecha, momio, pct } from "../format";
import { pierna } from "../mercados";
import AddButton from "./AddButton";
import Icono from "./Icono";

export const MOMENTO = {
  ahora: [<Icono key="i" nombre="check" size={15} />, "Buen momento"],
  esperar: [<Icono key="i" nombre="reloj" size={15} />, "Mejor espera"],
  evitar: [<Icono key="i" nombre="prohibido" size={15} />, "Mejor no"],
};
const NIVEL = { alta: "Alta", media: "Media", baja: "Baja" };
const ORDEN = { alta: 0, media: 1, baja: 2 };
const TOP = 6;

const CONSEJOS = [
  "Prefiere selecciones entre 60% y 85%: pagan algo y fallan menos.",
  "Parlays de 2 a 4 selecciones. Cada pata extra multiplica el riesgo.",
  "Evita momios menores a 1.18 (-560): suman riesgo y casi no suben el pago.",
  "Cuota baja = las casas lo ven factible, pero factible no es seguro.",
  "Apuesta un monto fijo pequeño (1–2% de lo que destines a esto) y no persigas pérdidas.",
  "Para goleadores, tiros y corners espera la alineación (sale ~1 h antes).",
  "Si sale una baja importante, actualiza: las casas mueven la cuota y el análisis se ajusta.",
];

function Fila({ p, boleto, onAbrir }) {
  const r = p.resumen.destacadas.lista[0];
  const { nivel, cuando } = p.resumen;
  const paga = r.cuota ?? 1 / r.prob;
  return (
    <li className={`reco-fila ${nivel}`}>
      <button type="button" className="reco-abrir" onClick={() => onAbrir(p)} title={r.razon}>
        <span className="reco-linea1">
          <span className={`reco-nivel ${nivel}`}>{NIVEL[nivel]}</span>
          <span className="reco-mercado">{r.nombre}</span>
        </span>
        <span className="reco-partido">
          {p.titulo} · {fecha(p.fecha)}
        </span>
        <span className="visually-hidden">{r.razon}</span>
        <span className={`reco-cuando-mini ${cuando.momento}`}>
          {MOMENTO[cuando.momento][0]} {MOMENTO[cuando.momento][1]}
        </span>
      </button>
      <div className="reco-lado">
        <span className="reco-prob">{pct(r.prob)}</span>
        <span className="reco-paga">{r.cuota ? `paga ${momio(paga)}` : `justa ${momio(paga)}`}</span>
        <AddButton boleto={boleto} sel={pierna(p, r.mercado, r.prob, r.cuota)} />
      </div>
    </li>
  );
}

// Columna lateral: lo más recomendable de la jornada (una por partido) y, plegado, el resto de los partidos.
export default function Recomendaciones({ partidos, boleto, onAbrir }) {
  const [verTodos, setVerTodos] = useState(false);
  const [verConsejos, setVerConsejos] = useState(false);
  const ordenados = partidos
    .filter((p) => p.resumen.destacadas.lista?.length && p.resumen.cuando.momento !== "evitar")
    .sort((a, b) => ORDEN[a.resumen.nivel] - ORDEN[b.resumen.nivel] || b.resumen.destacadas.lista[0].prob - a.resumen.destacadas.lista[0].prob);
  const top = ordenados.filter((p) => p.resumen.nivel !== "baja").slice(0, TOP);
  const resto = ordenados.filter((p) => !top.includes(p));

  return (
    <section className="panel recomendaciones" aria-labelledby="reco-titulo">
      <div className="panel-head">
        <h2 id="reco-titulo">Lo más recomendable</h2>
        <span className="panel-sub">una por partido</span>
      </div>

      {!top.length ? (
        <p className="parlay-desc">No hay apuestas con recomendación alta o media. A veces lo mejor es no apostar.</p>
      ) : (
        <ul className="reco-lista">
          {top.map((p) => (
            <Fila key={p.id} p={p} boleto={boleto} onAbrir={onAbrir} />
          ))}
        </ul>
      )}

      {resto.length > 0 && (
        <>
          <button type="button" className="link-btn" onClick={() => setVerTodos((v) => !v)} aria-expanded={verTodos}>
            {verTodos ? "− Ocultar el resto" : `+ Ver los otros ${resto.length} partidos`}
          </button>
          {verTodos && (
            <ul className="reco-lista">
              {resto.map((p) => (
                <Fila key={p.id} p={p} boleto={boleto} onAbrir={onAbrir} />
              ))}
            </ul>
          )}
        </>
      )}

      <button type="button" className="link-btn" onClick={() => setVerConsejos((v) => !v)} aria-expanded={verConsejos}>
        {verConsejos ? "− Ocultar consejos" : "+ Consejos para apostar mejor"}
      </button>
      {verConsejos && (
        <ul className="consejos">
          {CONSEJOS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <p className="reco-aviso">
        Alta = probable, respaldada por lo que pagan las casas y con pocas alertas. "Justa" = cuota según la probabilidad; tu casa pagará un poco menos. <b>Ninguna apuesta es 100% segura.</b>
      </p>
    </section>
  );
}
