import { useEffect, useState } from "react";
import { linkSeguro, momio, pct } from "../format";
import AddButton from "./AddButton";
import Ganador from "./Ganador";
import Alineaciones from "./Alineaciones";

// Botón "Ver alineaciones": las pide solo al abrirlas.
function VerAlineaciones({ p }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  function alternar() {
    if (!abierto && !datos) {
      fetch(`/api/alineacion?liga=${encodeURIComponent(p.liga)}&evento=${encodeURIComponent(p.id)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setDatos)
        .catch(() => setError(true));
    }
    setAbierto((v) => !v);
  }
  return (
    <div className="vivo-alin">
      <button type="button" className="news-toggle" onClick={alternar} aria-expanded={abierto}>
        <span>{abierto ? "Ocultar alineaciones" : "Ver alineaciones"}</span>
        <span aria-hidden="true">{abierto ? "▴" : "▾"}</span>
      </button>
      {abierto &&
        (error ? (
          <p className="muted news-empty">No se pudieron cargar.</p>
        ) : !datos ? (
          <p className="muted news-empty">Cargando…</p>
        ) : (
          <Alineaciones local={p.local} visita={p.visita} alineaciones={datos} />
        ))}
    </div>
  );
}

const ICONO = { gol: "⚽", autogol: "⚽ (autogol)", amarilla: "🟨", roja: "🟥" };

const CADA = 60e3;

// Franja con los partidos que se están jugando ahora: marcador y minuto, se actualiza cada minuto.
export default function EnVivo({ liga, ligas, boleto }) {
  const [partidos, setPartidos] = useState([]);

  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      fetch("/api/envivo")
        .then((r) => (r.ok ? r.json() : []))
        .then((x) => vivo && setPartidos(Array.isArray(x) ? x : []))
        .catch(() => {});
    cargar();
    const t = setInterval(cargar, CADA);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const lista = liga === "hoy" ? partidos : partidos.filter((p) => p.liga === liga);
  if (!lista.length) return null;

  const Equipo = ({ e }) => (
    <span className="vivo-equipo">
      {linkSeguro(e.logo) && <img src={e.logo} alt="" width="20" height="20" />}
      {e.nombre}
    </span>
  );

  return (
    <section className="panel en-vivo" aria-labelledby="vivo-titulo">
      <div className="panel-head">
        <h2 id="vivo-titulo">
          <span className="vivo-punto" aria-hidden="true" /> En vivo
        </h2>
        <span className="panel-sub">se actualiza cada minuto</span>
      </div>
      <ul className="vivo-lista">
        {lista.map((p) => (
          <li key={p.id}>
            {liga === "hoy" && <span className="match-liga">{ligas[p.liga]?.nombre}</span>}
            <Equipo e={p.local} />
            <b className="vivo-marcador">
              {p.local.goles} - {p.visita.goles}
            </b>
            <Equipo e={p.visita} />
            <span className="vivo-minuto">{p.minuto}</span>
            <table className="vivo-stats">
              <thead>
                <tr>
                  <th>{p.local.nombre}</th>
                  <th />
                  <th>{p.visita.nombre}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["corners", "Tiros de esquina"],
                  ["tirosPuerta", "Tiros a puerta"],
                  ["tiros", "Tiros totales"],
                ].map(([k, n]) => (
                  <tr key={k}>
                    <td>{p.local[k]}</td>
                    <th scope="row">{n}</th>
                    <td>{p.visita[k]}</td>
                  </tr>
                ))}
                <tr>
                  <td>{p.eventos.filter((e) => e.local && e.tipo !== "gol" && e.tipo !== "autogol").length}</td>
                  <th scope="row">Tarjetas (total {p.eventos.filter((e) => e.tipo === "amarilla" || e.tipo === "roja").length})</th>
                  <td>{p.eventos.filter((e) => !e.local && e.tipo !== "gol" && e.tipo !== "autogol").length}</td>
                </tr>
              </tbody>
            </table>
            {p.eventos.length > 0 && (
              <ul className="vivo-eventos">
                {p.eventos.map((e, i) => (
                  <li key={i}>
                    <span>{e.minuto}</span> {ICONO[e.tipo]} <b>{e.jugador || "—"}</b> ({e.local ? p.local.nombre : p.visita.nombre})
                  </li>
                ))}
              </ul>
            )}
            {p.ganador && <Ganador local={p.local.nombre} visita={p.visita.nombre} prob={p.ganador} />}
            <VerAlineaciones p={p} />
            {p.sugerencias?.length > 0 && (
              <div className="vivo-sug">
                <span className="vivo-razon">{p.razon}</span>
                {p.sugerencias.map((s) => (
                  <span key={s.mercado} className="vivo-pick">
                    <b>{s.mercado}</b> {pct(s.prob)} · justa {momio(1 / s.prob)}
                    {boleto && (
                      <AddButton
                        boleto={boleto}
                        sel={{ partidoId: `vivo-${p.id}`, partido: `${p.local.nombre} vs ${p.visita.nombre} (en vivo, ${p.minuto})`, mercado: s.mercado, prob: s.prob, cuota: null }}
                      />
                    )}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="tab-nota">
        En vivo: goles esperados de antes del partido (según las casas) ajustados al marcador y al tiempo que queda. No considera
        expulsiones ni cómo va el juego, y las cuotas en vivo cambian cada minuto: compara con tu casa antes de apostar.
      </p>
    </section>
  );
}
