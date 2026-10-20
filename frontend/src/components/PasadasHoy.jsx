import { useEffect, useState } from "react";
import { pedir } from "../hooks/useAnalisis";
import MatchCard from "./MatchCard";
import Icono from "./Icono";

export default function PasadasHoy({ ligas, onAbrir, onVolver }) {
  const [partidos, setPartidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [despertando, setDespertando] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setCargando(true);
    pedir("/api/analisis?liga=hoy&dias=1", ctrl.signal, () => setDespertando(true))
      .then((j) => setPartidos(j.pasadas ?? []))
      .catch(() => {})
      .finally(() => { setCargando(false); setDespertando(false); });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="pasadas-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        <Icono nombre="flechaIzq" size={15} /> Volver
      </button>
      <header className="home-head">
        <h1>Pasadas de hoy</h1>
        <p className="muted">Partidos del día ya finalizados. Ábrelos para ver si los parlays se cumplieron.</p>
      </header>
      {cargando ? (
        <div className="panel state" aria-busy="true">
          <div className="server-wake-spinner" />
          <span className="state-title">{despertando ? "Despertando el servidor…" : "Cargando partidos finalizados…"}</span>
          {despertando && <span className="state-desc">El servidor estaba dormido, tarda ~1 minuto. No cierres la página.</span>}
        </div>
      ) : partidos.length === 0 ? (
        <div className="panel state">
          <span className="state-title">Aún no hay partidos finalizados hoy</span>
          <span className="state-desc">Vuelve más tarde cuando hayan terminado partidos del día.</span>
        </div>
      ) : (
        <div className="match-grid">
          {partidos.map((p) => (
            <MatchCard key={p.id} p={p} boleto={null} onAbrir={onAbrir} ligaNombre={ligas[p.liga]?.nombre ?? null} finalizado />
          ))}
        </div>
      )}
    </div>
  );
}
