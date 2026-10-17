import { useEffect, useState } from "react";
import { fecha, pct } from "../format";
import { CATEGORIA } from "../mercados";
import { pedir } from "../hooks/useAnalisis";

const TIPO = { goles: "Goles", jugadores: "Jugadores", ...CATEGORIA };

// Barra: lo que dijimos (línea) contra lo que de verdad se cumplió (relleno).
function Barra({ dijimos, acierto }) {
  return (
    <div className="acierto-barra" role="img" aria-label={`Dijimos ${pct(dijimos)}, se cumplió ${pct(acierto)}`}>
      <i style={{ width: pct(acierto) }} className={acierto >= dijimos - 0.05 ? "bien" : "mal"} />
      <b style={{ left: pct(dijimos) }} />
    </div>
  );
}

// % de acierto real: cada predicción de antes del partido se guarda y, al terminar, se revisa si se cumplió.
export default function Aciertos({ onVolver }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    pedir("/api/aciertos", ctrl.signal, () => {})
      .then(setDatos)
      .catch((e) => e.name !== "AbortError" && setError(e.message));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="partido-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        ← Volver a los partidos
      </button>
      <section className="panel aciertos">
        <div className="panel-head">
          <h2>Aciertos reales</h2>
          <span className="panel-sub">últimos 90 días</span>
        </div>
        <p className="tab-nota">
          Cada predicción se guarda antes del partido y, cuando termina, se revisa si se cumplió. Si el modelo está bien calibrado,
          lo que <b>dijimos</b> y lo que <b>se cumplió</b> deben parecerse.
        </p>

        {error ? (
          <p className="error">No se pudieron cargar los aciertos: {error}</p>
        ) : !datos ? (
          <p className="muted">Cargando…</p>
        ) : !datos.configurado ? (
          <p className="muted">El registro de aciertos todavía no está activado.</p>
        ) : !datos.total.n ? (
          <p className="muted">Aún no hay partidos revisados. Los primeros resultados aparecen unas horas después de que terminen.</p>
        ) : (
          <>
            <div className="acierto-total">
              <span className="market-overview-label">Se cumplió</span>
              <span className="acierto-grande">{pct(datos.total.acierto)}</span>
              <span className="muted">
                {datos.total.si} de {datos.total.n} predicciones · dijimos en promedio {pct(datos.total.dijimos)}
              </span>
            </div>

            <h3 className="forma-titulo">Por probabilidad que dimos</h3>
            <table className="prob-table acierto-tabla">
              <thead>
                <tr>
                  <th>Dijimos</th>
                  <th>Se cumplió</th>
                  <th aria-hidden="true" />
                  <th>Partidos</th>
                </tr>
              </thead>
              <tbody>
                {datos.rangos.map((r) => (
                  <tr key={r.desde}>
                    <td>
                      {pct(r.desde)}–{pct(Math.min(r.hasta, 0.85))}
                    </td>
                    <td className="final">{pct(r.acierto)}</td>
                    <td className="bar-cell">
                      <Barra dijimos={r.dijimos} acierto={r.acierto} />
                    </td>
                    <td>{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="forma-titulo">Por tipo de mercado</h3>
            <table className="prob-table acierto-tabla">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Se cumplió</th>
                  <th>Dijimos</th>
                  <th>Predicciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.categorias.map((c) => (
                  <tr key={c.categoria}>
                    <td>{TIPO[c.categoria] ?? c.categoria}</td>
                    <td className="final">{pct(c.acierto)}</td>
                    <td>{pct(c.dijimos)}</td>
                    <td>{c.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="forma-titulo">Últimas revisadas</h3>
            <ul className="cumplidas-lista">
              {datos.recientes.map((x, i) => (
                <li key={i} className={`res-${x.resultado}`}>
                  <span className="res-icono" aria-hidden="true">
                    {x.resultado === "si" ? "✓" : "✗"}
                  </span>
                  <span className="res-mercado">
                    {x.nombre} <span className="muted">· {x.partido}</span>
                  </span>
                  <span className="res-prob">
                    {pct(x.prob)} · {fecha(x.fecha)}
                  </span>
                  <span className="res-estado">{x.resultado === "si" ? "Cumplida" : "Fallida"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
