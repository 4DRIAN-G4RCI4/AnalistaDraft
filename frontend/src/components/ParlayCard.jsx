import { fecha, momio, pct } from "../format";

export default function ParlayCard({ titulo, descripcion, parlay, destacado }) {
  return (
    <section className={`panel parlay ${destacado ? "parlay-destacado" : ""}`}>
      <div className="panel-head">
        <h2>{titulo}</h2>
        <span className="panel-sub">{parlay ? `${parlay.piernas.length} selecciones` : "—"}</span>
      </div>
      <p className="parlay-desc">{descripcion}</p>

      {!parlay ? (
        <div className="state">
          <span className="state-icon" aria-hidden="true">∅</span>
          <span className="state-title">Sin selecciones suficientes</span>
          <span className="state-desc">Ningún partido cumple el criterio en este rango de fechas.</span>
        </div>
      ) : (
        <>
          <ol className="parlay-legs">
            {parlay.piernas.map((x) => (
              <li key={x.partido + x.mercado}>
                <div className="leg-main">
                  <span className="leg-market">{x.mercado}</span>
                  <span className="leg-match">{x.partido}</span>
                  {x.fecha && <span className="leg-date">{fecha(x.fecha)}</span>}
                </div>
                <div className="leg-side">
                  <span className="prob-chip">{pct(x.prob)}</span>
                  {x.ventaja != null && <span className="pct-pill up">+{(x.ventaja * 100).toFixed(1)} pts</span>}
                </div>
              </li>
            ))}
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
              <span>{parlay.cuotaCasa ? <>Casa aprox. <b>{momio(parlay.cuotaCasa)}</b></> : "Sin momio de la casa en todas"}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
