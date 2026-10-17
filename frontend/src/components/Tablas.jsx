import { useEffect, useState } from "react";
import { linkSeguro } from "../format";
import { pedir } from "../hooks/useAnalisis";

// ESPN manda las zonas en inglés; Liga MX no las trae y se arman con el formato del torneo.
const ZONA = {
  "Champions League": "Champions League",
  "Champions League qualifiers": "Previa de Champions",
  "Europa League": "Europa League",
  "Europa League qualifiers": "Previa de Europa League",
  "Conference League": "Conference League",
  "Conference League qualifiers": "Previa de Conference",
  Relegation: "Descenso",
  Relegated: "Descenso",
  "Relegation playoff": "Promoción de descenso",
  "Qualifies for round of 16": "Octavos de final",
  "Knockout phase playoffs - seeded": "Playoff (cabeza de serie)",
  "Knockout phase playoffs - unseeded": "Playoff",
  Eliminated: "Eliminado",
  "Qualifies for MLS Cup Playoffs - Round One Best-of-3 series": "Playoffs de MLS",
  "Qualifies for MLS Cup Playoffs - Wild Card Matches": "Wild card de MLS",
  "Copa Libertadores": "Copa Libertadores",
  "Copa Libertadores qualifiers": "Previa de Libertadores",
  "Copa Sudamericana": "Copa Sudamericana",
};
const zonaLigaMX = (pos) =>
  pos <= 6 ? { texto: "Liguilla directa", color: "#81D6AC" } : pos <= 10 ? { texto: "Play-in", color: "#B3D4FC" } : null;

// Tabla de posiciones de cada liga, con selector de liga.
export default function Tablas({ ligas, ligaInicial, onVolver }) {
  const [tablas, setTablas] = useState(null);
  const [error, setError] = useState(false);
  const ids = Object.keys(ligas);
  const [liga, setLiga] = useState(ids.includes(ligaInicial) ? ligaInicial : "mex.1");

  useEffect(() => {
    const ctrl = new AbortController();
    pedir("/api/tablas", ctrl.signal, () => {})
      .then(setTablas)
      .catch((e) => e.name !== "AbortError" && setError(true));
    return () => ctrl.abort();
  }, []);

  const filas = tablas?.[liga] ?? [];
  const zonaDe = (t) => (liga === "mex.1" ? zonaLigaMX(t.pos) : t.zona && { texto: ZONA[t.zona.texto] ?? t.zona.texto, color: t.zona.color });
  const leyenda = [...new Map(filas.map(zonaDe).filter(Boolean).map((z) => [z.texto, z])).values()];
  const grupos = [...new Set(filas.map((t) => t.grupo ?? null))]; // MLS y Argentina: dos tablas
  const GRUPO = { "Eastern Conference": "Conferencia Este", "Western Conference": "Conferencia Oeste", "Group A": "Grupo A", "Group B": "Grupo B" };

  return (
    <div className="partido-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        ← Volver a los partidos
      </button>
      <section className="panel tablas">
        <div className="panel-head">
          <h2>Tablas de posiciones</h2>
          <span className="panel-sub">temporada actual</span>
        </div>
        <div className="news-filter-bar" role="group" aria-label="Liga">
          {ids.map((id) => (
            <button key={id} type="button" aria-pressed={liga === id} className={`coin-filter-chip ${liga === id ? "active" : ""}`} onClick={() => setLiga(id)}>
              {ligas[id].nombre}
            </button>
          ))}
        </div>

        {error ? (
          <p className="error">No se pudieron cargar las tablas.</p>
        ) : !tablas ? (
          <p className="muted">Cargando tablas…</p>
        ) : !filas.length ? (
          <p className="muted">Sin tabla para esta liga ahora.</p>
        ) : (
          <>
            {grupos.map((g) => (
            <div key={g ?? "unica"} className="tabla-grupo">
            {g && <h3 className="forma-titulo">{GRUPO[g] ?? g}</h3>}
            <div className="table-wrap">
              <table className="tabla-pos">
                <caption className="visually-hidden">Tabla de posiciones de {ligas[liga].nombre}{g ? ` · ${GRUPO[g] ?? g}` : ""}</caption>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Equipo</th>
                    <th title="Partidos jugados">PJ</th>
                    <th title="Ganados">G</th>
                    <th title="Empatados">E</th>
                    <th title="Perdidos">P</th>
                    <th title="Goles a favor">GF</th>
                    <th title="Goles en contra">GC</th>
                    <th title="Diferencia de goles">DG</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.filter((t) => (t.grupo ?? null) === g).map((t) => {
                    const z = zonaDe(t);
                    return (
                      <tr key={t.id} style={z ? { "--zona": z.color } : undefined} className={z ? "con-zona" : ""}>
                        <td className="pos" title={z?.texto}>
                          {t.pos}
                        </td>
                        <td className="equipo">
                          <span>
                            {linkSeguro(t.logo) && <img src={t.logo} alt="" width="22" height="22" />}
                            {t.nombre}
                          </span>
                        </td>
                        <td>{t.pj}</td>
                        <td>{t.g}</td>
                        <td>{t.e}</td>
                        <td>{t.p}</td>
                        <td>{t.gf}</td>
                        <td>{t.gc}</td>
                        <td className={t.gf - t.gc > 0 ? "up" : t.gf - t.gc < 0 ? "down" : ""}>
                          {t.gf - t.gc > 0 ? "+" : ""}
                          {t.gf - t.gc}
                        </td>
                        <td className="pts">{t.pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
            ))}
            {leyenda.length > 0 && (
              <ul className="tabla-leyenda">
                {leyenda.map((z) => (
                  <li key={z.texto}>
                    <span style={{ background: z.color }} aria-hidden="true" /> {z.texto}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
