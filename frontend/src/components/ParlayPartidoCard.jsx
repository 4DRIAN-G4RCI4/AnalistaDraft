import { momio, pct } from "../format";
import { pierna } from "../mercados";
import { ETIQUETAS_CATEGORIA } from "../parlaysPartido";
import { evaluarParlay } from "../evaluar";
import AddButton from "./AddButton";

const ESTADO_VIVO = {
  si: ["✓", "Cumplida", "res-si"],
  no: ["✗", "Fallida", "res-no"],
  pendiente: ["⏳", "En juego", "res-pendiente"],
};

export default function ParlayPartidoCard({ parlay: rawParlay, p, boleto, vivo = null, destacado = false }) {
  if (!rawParlay) return null;

  const parlay = vivo ? evaluarParlay(rawParlay, vivo) : rawParlay;
  const piernasBoleto = parlay.piernas.map((x) => pierna(p, x.mercado, x.prob, x.cuota));
  const todasEnBoleto = boleto ? piernasBoleto.every((sel) => boleto.tiene(sel)) : false;

  const alternarTodoElParlay = () => {
    if (!boleto) return;
    if (todasEnBoleto) {
      for (const sel of piernasBoleto) boleto.quitar(sel);
    } else {
      boleto.agregar(...piernasBoleto);
    }
  };

  const estadoGeneral = parlay.estadoGeneral;

  return (
    <section className={`panel parlay parlay-partido ${destacado ? "parlay-destacado" : ""}`}>
      <div className="panel-head">
        <div>
          <h2>{parlay.titulo}</h2>
          <span className="panel-sub">
            {vivo ? (
              <span className={`parlay-live-badge ${estadoGeneral === "si" ? "cobrado" : estadoGeneral === "no" ? "caido" : "vivo"}`}>
                {estadoGeneral === "si" ? "🏆 ¡Cobrado!" : estadoGeneral === "no" ? "✗ Se cayó" : "🟢 Sigue vivo"}
              </span>
            ) : parlay.tipo === "factible" ? (
              "5 selecciones · Menor riesgo"
            ) : (
              `${parlay.piernas.length} selecciones · Buen pago`
            )}
          </span>
        </div>
      </div>

      <p className="parlay-desc">{parlay.descripcion}</p>

      <ol className="parlay-legs">
        {parlay.piernas.map((x) => {
          const sel = pierna(p, x.mercado, x.prob, x.cuota);
          const ev = x.estadoVivo ? ESTADO_VIVO[x.estadoVivo] : null;
          return (
            <li key={x.categoria + x.mercado} className={ev ? `leg-evaluada ${ev[2]}` : ""}>
              <div className="leg-main">
                <div className="leg-header-line">
                  <span className="leg-cat-pill">{ETIQUETAS_CATEGORIA[x.categoria] ?? x.categoria}</span>
                  {ev && (
                    <span className={`leg-live-chip ${ev[2]}`} title={`Estado en vivo: ${ev[1]}`}>
                      {ev[0]} {ev[1]}
                    </span>
                  )}
                </div>
                <span className="leg-market">{x.nombre}</span>
              </div>

              <div className="leg-side">
                <div className="leg-side-info">
                  <span className="prob-chip">{pct(x.prob)}</span>
                  <span className="leg-paga-num">{x.cuotaCasa ? `paga ${momio(x.cuota)}` : `justa ${momio(x.cuota)}`}</span>
                </div>
                {boleto && <AddButton boleto={boleto} sel={sel} />}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="parlay-total">
        <div>
          <span className="market-overview-label">Probabilidad combinada</span>
          <span className="parlay-prob">{pct(parlay.prob)}</span>
        </div>
        <div className="parlay-odds">
          <span>
            Cuota justa <b>{momio(parlay.cuotaJusta)}</b>
          </span>
          <span>
            {parlay.cuotaCasa ? (
              <>
                Casa aprox. <b>{momio(parlay.cuotaCasa)}</b>
              </>
            ) : (
              "Momio estimado"
            )}
          </span>
        </div>
      </div>

      {boleto && (
        <button
          type="button"
          className={`btn ${todasEnBoleto ? "btn-secondary" : "btn-primary"} parlay-add-all-btn`}
          onClick={alternarTodoElParlay}
        >
          {todasEnBoleto ? "✓ Todo el parlay en el boleto (quitar)" : `+ Añadir las ${parlay.piernas.length} al boleto`}
        </button>
      )}
    </section>
  );
}
