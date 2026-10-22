import { useEffect, useState } from "react";
import { linkSeguro } from "../format";
import { pedir } from "../hooks/useAnalisis";
import Icono from "./Icono";

// ESPN solo publica foto de algunos jugadores; el resto se queda con sus iniciales.
const iniciales = (n) =>
  (n || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const POS = { F: "Delantero", M: "Medio", D: "Defensa", G: "Portero", SUB: "Suplente" };

// ESPN casi no publica foto en fútbol: el monograma con el escudo encima es el caso normal,
// no un respaldo, así que tiene que verse bien por sí solo.
function Retrato({ j }) {
  const [falla, setFalla] = useState(false);
  const hayFoto = !falla && linkSeguro(j.foto);
  return (
    <span className="jug-retrato">
      {hayFoto ? (
        <img className="jug-foto" src={j.foto} alt="" loading="lazy" onError={() => setFalla(true)} />
      ) : (
        <span className="jug-monograma" aria-hidden="true">{iniciales(j.nombre)}</span>
      )}
      {linkSeguro(j.escudo) && <img className="jug-escudo-chico" src={j.escudo} alt="" width="17" height="17" loading="lazy" />}
    </span>
  );
}

export default function Jugadores({ ligas, ligaInicial, onVolver }) {
  const [liga, setLiga] = useState(ligaInicial && ligaInicial !== "hoy" && ligaInicial !== "vivo" ? ligaInicial : "esp.1");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [despertando, setDespertando] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setDatos(null);
    setError(null);
    pedir(`/api/jugadores?liga=${encodeURIComponent(liga)}`, ctrl.signal, () => setDespertando(true))
      .then(setDatos)
      .catch((e) => e.name !== "AbortError" && setError(e.message))
      .finally(() => setDespertando(false));
    return () => ctrl.abort();
  }, [liga]);

  const jugadores = datos?.jugadores ?? [];

  return (
    <div className="jugadores-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        <Icono nombre="flechaIzq" size={15} /> Volver
      </button>

      <header className="home-head">
        <h1>Jugadores</h1>
        <p className="muted">
          Quién anota y quién tira en cada liga, con sus últimos partidos. Sale de las estadísticas de ESPN, no de una tabla
          oficial de goleadores.
        </p>
      </header>

      <div className="news-filter-bar" role="group" aria-label="Liga">
        {Object.entries(ligas).map(([id, l]) => (
          <button
            key={id}
            type="button"
            aria-pressed={liga === id}
            className={`coin-filter-chip ${liga === id ? "active" : ""}`}
            onClick={() => setLiga(id)}
          >
            {l.nombre}
          </button>
        ))}
      </div>

      {error ? (
        <div className="panel state state-error" role="alert">
          <span className="state-icon"><Icono nombre="alerta" size={20} /></span>
          <span className="state-title">No se pudieron cargar los jugadores</span>
          <span className="state-desc">{error}</span>
        </div>
      ) : !datos ? (
        <div className="panel state" aria-busy="true" role="status">
          <div className="server-wake-spinner" />
          <span className="state-title">{despertando ? "Despertando el servidor…" : "Juntando estadísticas…"}</span>
          <span className="state-desc">La primera vez de cada liga tarda un poco; después queda guardado.</span>
        </div>
      ) : !jugadores.length ? (
        <div className="panel state">
          <span className="state-title">Sin datos de jugadores en esta liga</span>
          <span className="state-desc">ESPN aún no publica estadísticas por jugador aquí.</span>
        </div>
      ) : (
        <ol className="jug-lista">
          {jugadores.map((j, i) => (
            <li key={`${j.equipoId}-${j.id}`} className={`jug-fila${i < 3 ? " jug-podio" : ""}`}>
              <span className="jug-puesto">{i + 1}</span>
              <Retrato j={j} />
              <div className="jug-datos">
                <span className="jug-nombre">{j.nombre}</span>
                <span className="jug-meta">
                  {j.equipo}
                  {j.pos && POS[j.pos] ? ` · ${POS[j.pos]}` : ""}
                </span>
              </div>
              <div className="jug-cifras">
                <span className="jug-goles">
                  <b>{j.goles}</b> <small>goles</small>
                </span>
                <span className="jug-dato">
                  {j.tirosPuerta} <small>a puerta</small>
                </span>
                <span className="jug-dato">
                  {j.partidos} <small>PJ</small>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {datos && (
        <p className="tab-nota">
          Suma de los últimos partidos que ESPN tiene de cada equipo ({datos.liga}). No es la tabla oficial de la liga: sirve
          para ver quién está en racha.
        </p>
      )}
    </div>
  );
}
