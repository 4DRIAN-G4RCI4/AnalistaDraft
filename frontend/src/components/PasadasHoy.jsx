import { useEffect, useState } from "react";
import { pedir } from "../hooks/useAnalisis";
import MatchCard from "./MatchCard";

export default function PasadasHoy({ ligas, boleto, onAbrir, onVolver }) {
  const [partidos, setPartidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    setCargando(true);
    pedir("/api/analisis?liga=hoy&dias=1", ctrl.signal, () => {})
      .then((j) => setPartidos(j.pasadas ?? []))
      .catch(() => {})
      .finally(() => setCargando(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="pasadas-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        ← Volver
      </button>
      <header className="home-head">
        <h1>Pasadas de hoy</h1>
        <p className="muted">Partidos del día ya finalizados. Ábrelos para ver si los parlays se cumplieron.</p>
      </header>
      {cargando ? (
        <div className="panel state" aria-busy="true">
          <div className="server-wake-spinner" />
          <span className="state-title">Cargando partidos finalizados…</span>
        </div>
      ) : partidos.length === 0 ? (
        <div className="panel state">
          <span className="state-title">Aún no hay partidos finalizados hoy</span>
          <span className="state-desc">Vuelve más tarde cuando hayan terminado partidos del día.</span>
        </div>
      ) : (
        <div className="match-grid">
          {partidos.map((p) => (
            <MatchCard
              key={p.id}
              p={p}
              boleto={boleto}
              onAbrir={onAbrir}
              ligaNombre={ligas[p.liga]?.nombre ?? null}
              finalizado
            />
          ))}
        </div>
      )}
    </div>
  );
}
