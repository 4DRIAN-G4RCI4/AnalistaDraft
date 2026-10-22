import { useEffect, useState } from "react";
import { pedir } from "../hooks/useAnalisis";
import { etiquetaDia, guardarPasadas, leerPasadas } from "../historialLocal";
import MatchCard from "./MatchCard";
import Icono from "./Icono";

export default function PasadasHoy({ ligas, onAbrir, onVolver }) {
  const [partidos, setPartidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [despertando, setDespertando] = useState(false);
  const [historial, setHistorial] = useState(null); // días anteriores: llegan después

  useEffect(() => {
    const ctrl = new AbortController();
    setCargando(true);
    // Primero lo de hoy, que es lo que se viene a ver.
    pedir("/api/analisis?liga=hoy&dias=1", ctrl.signal, () => setDespertando(true))
      .then((j) => {
        const hoy = j.pasadas ?? [];
        setPartidos(hoy);
        guardarPasadas(hoy); // el historial se arma solo con las visitas
      })
      .catch(() => {})
      .finally(() => {
        setCargando(false);
        setDespertando(false);
      });
    return () => ctrl.abort();
  }, []);

  // Los días anteriores salen del teléfono y se cargan cuando el navegador está libre,
  // para no competir con lo de hoy ni retrasar el primer pintado.
  useEffect(() => {
    const pedirHistorial = () => leerPasadas().then(setHistorial).catch(() => setHistorial([]));
    const id = window.requestIdleCallback
      ? requestIdleCallback(pedirHistorial, { timeout: 2500 })
      : setTimeout(pedirHistorial, 900);
    return () => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
  }, [cargando]);

  // Solo los días anteriores: los de hoy ya están arriba
  const idsDeHoy = new Set(partidos.map((p) => p.id));
  const anteriores = (historial ?? []).filter((p) => !idsDeHoy.has(p.id));
  const porDia = anteriores.reduce((m, p) => ((m[p.dia] ??= []).push(p), m), {});

  const tarjeta = (p) => (
    <MatchCard key={p.id} p={p} boleto={null} onAbrir={onAbrir} ligaNombre={ligas[p.liga]?.nombre ?? null} finalizado />
  );

  return (
    <div className="pasadas-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        <Icono nombre="flechaIzq" size={15} /> Volver
      </button>
      <header className="home-head">
        <h1>Pasadas</h1>
        <p className="muted">
          Partidos ya finalizados. Ábrelos para ver si los parlays se cumplieron. Se guardan en tu teléfono los últimos 3 días
          que hayas abierto la app.
        </p>
      </header>

      {cargando ? (
        <div className="panel state" aria-busy="true">
          <div className="server-wake-spinner" />
          <span className="state-title">{despertando ? "Despertando el servidor…" : "Cargando partidos finalizados…"}</span>
          {despertando && <span className="state-desc">El servidor estaba dormido, tarda ~1 minuto. No cierres la página.</span>}
        </div>
      ) : partidos.length === 0 && !anteriores.length ? (
        <div className="panel state">
          <span className="state-title">Aún no hay partidos finalizados</span>
          <span className="state-desc">Vuelve más tarde cuando hayan terminado partidos del día.</span>
        </div>
      ) : (
        <>
          {partidos.length > 0 && (
            <section className="pasadas-dia">
              <h2 className="section-title pasadas-dia-titulo">Hoy</h2>
              <div className="match-grid">{partidos.map(tarjeta)}</div>
            </section>
          )}
          {Object.entries(porDia).map(([dia, lista]) => (
            <section className="pasadas-dia" key={dia}>
              <h2 className="section-title pasadas-dia-titulo">{etiquetaDia(dia)}</h2>
              <div className="match-grid">{lista.map(tarjeta)}</div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
