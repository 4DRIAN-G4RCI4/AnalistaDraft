import { linkSeguro, momio, pct } from "../format";
import { pierna } from "../mercados";
import { ETIQUETAS_CATEGORIA } from "../parlaysPartido";
import { evaluarParlay } from "../evaluar";
import AddButton from "./AddButton";
import Icono from "./Icono";

const ESTADO_VIVO = {
  si: ["check", "Cumplida", "res-si"],
  no: ["cruz", "Fallida", "res-no"],
  pendiente: ["reloj", "En juego", "res-pendiente"],
  nomedible: ["guion", "Sin dato", "res-pendiente"],
};

// Escudo del equipo al que apunta la pierna; los dos si el mercado es del partido entero.
function Escudos({ mercado, p }) {
  const soloLocal = /^Local\b/.test(mercado);
  const soloVisita = /^Visita\b/.test(mercado);
  const equipos = soloLocal ? [p.local] : soloVisita ? [p.visita] : [p.local, p.visita];
  const urls = equipos.filter((e) => linkSeguro(e?.logo));
  if (!urls.length) return null;
  return (
    <span className={`leg-escudos ${urls.length > 1 ? "par" : ""}`} aria-hidden="true">
      {urls.map((e) => (
        <img key={e.id} src={e.logo} alt="" width="22" height="22" />
      ))}
    </span>
  );
}

// Barra tipo casa de apuestas: cuánto va (número) contra la línea que necesita (marca en la pista).
function Barra({ progreso: { valor, linea, mas }, estado }) {
  const tope = Math.max(linea * 1.4, valor * 1.15, linea + 1);
  const pos = (n) => `${Math.min(100, (n / tope) * 100)}%`;
  const color = estado === "si" ? "ok" : estado === "no" ? "mal" : mas ? "falta" : "ok";
  return (
    <div className={`leg-barra ${color}`}>
      <span className="leg-barra-valor">{valor}</span>
      <div className="leg-barra-pista">
        <span className="leg-barra-llena" style={{ width: pos(valor) }} />
        <span className="leg-barra-meta" style={{ left: pos(linea) }} title={`Línea: ${linea}`} />
      </div>
      <span className="leg-barra-objetivo">
        <Icono nombre={mas ? "flechaArriba" : "flechaAbajo"} size={12} /> {linea}
      </span>
    </div>
  );
}

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
                {estadoGeneral === "si" ? (
                  <><Icono nombre="trofeo" size={14} /> ¡Cobrado!</>
                ) : estadoGeneral === "no" ? (
                  <><Icono nombre="cruz" size={14} /> Se cayó</>
                ) : vivo.estado === "post" ? (
                  "Sin datos para cerrarlo"
                ) : (
                  <><span className="vivo-punto" aria-hidden="true" /> Sigue vivo</>
                )}
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
          const ev = x.estadoVivo ? ESTADO_VIVO[x.estadoVivo] : vivo ? ESTADO_VIVO.nomedible : null;
          return (
            <li key={x.categoria + x.mercado} className={ev ? `leg-evaluada ${ev[2]}` : ""}>
              <div className="leg-main">
                <div className="leg-header-line">
                  <Escudos mercado={x.mercado} p={p} />
                  <span className="leg-cat-pill">{ETIQUETAS_CATEGORIA[x.categoria] ?? x.categoria}</span>
                  {ev && (
                    <span className={`leg-live-chip ${ev[2]}`} title={`Estado: ${ev[1]}`}>
                      <Icono nombre={ev[0]} size={13} /> {ev[1]}
                    </span>
                  )}
                </div>
                <span className="leg-market">{x.nombre}</span>
                {x.progreso && <Barra progreso={x.progreso} estado={x.estadoVivo} />}
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
          {todasEnBoleto ? (
            <><Icono nombre="check" size={15} /> Todo el parlay en el boleto (quitar)</>
          ) : (
            <><Icono nombre="mas" size={15} /> Añadir las {parlay.piernas.length} al boleto</>
          )}
        </button>
      )}
    </section>
  );
}
