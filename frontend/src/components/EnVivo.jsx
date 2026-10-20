import { useEffect, useRef, useState } from "react";
import { linkSeguro, momio, pct } from "../format";
import AddButton from "./AddButton";
import Ganador from "./Ganador";
import Alineaciones from "./Alineaciones";
import Icono from "./Icono";

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

// La tarjeta se distingue por forma y color, y además lleva texto para quien no percibe el color.
const ICONO = {
  gol: <Icono nombre="balon" size={15} titulo="Gol" />,
  autogol: (
    <>
      <Icono nombre="balon" size={15} titulo="Autogol" /> (autogol)
    </>
  ),
  amarilla: <Icono nombre="tarjeta" size={15} className="icono-amarilla" titulo="Tarjeta amarilla" />,
  roja: <Icono nombre="tarjeta" size={15} className="icono-roja" titulo="Tarjeta roja" />,
};

const CADA = 60e3;

// Estadísticas, goles y tarjetas, quién puede ganar, alineaciones y sugerencias de un partido en juego.
export function VivoDetalle({ p, boleto }) {
  return (
    <>
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
    </>
  );
}

// Franja con los partidos que se están jugando ahora: marcador y minuto, se actualiza cada minuto.
// soloVivo: vista "En vivo" (todas las ligas y mensaje si no hay partidos en juego)
export default function EnVivo({ liga, ligas, boleto, soloVivo = false, onAbrir }) {
  const [partidos, setPartidos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [abiertos, setAbiertos] = useState({}); // id -> true/false (estadísticas desplegadas)
  const [goles, setGoles] = useState({}); // id del partido -> nombre del equipo que acaba de anotar
  const antes = useRef(null); // marcadores del refresco anterior

  // Compara con el refresco anterior: si un equipo sumó goles, se anima ~8 s.
  function actualizar(lista) {
    const previos = antes.current;
    antes.current = Object.fromEntries(lista.map((p) => [p.id, [p.local.goles, p.visita.goles]]));
    setCargado(true);
    if (!previos) return setPartidos(lista); // la primera carga no anima goles viejos
    const nuevos = {};
    for (const p of lista) {
      const [l, v] = previos[p.id] ?? [p.local.goles, p.visita.goles];
      if (p.local.goles > l) nuevos[p.id] = p.local.nombre;
      else if (p.visita.goles > v) nuevos[p.id] = p.visita.nombre;
    }
    setPartidos(lista);
    if (Object.keys(nuevos).length) {
      setGoles((g) => ({ ...g, ...nuevos }));
      setTimeout(() => setGoles((g) => Object.fromEntries(Object.entries(g).filter(([id]) => !(id in nuevos)))), 8000);
    }
  }

  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      fetch("/api/envivo")
        .then((r) => (r.ok ? r.json() : []))
        .then((x) => vivo && actualizar(Array.isArray(x) ? x : []))
        .catch(() => {});
    cargar();
    const t = setInterval(cargar, CADA);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const todas = soloVivo || liga === "hoy";
  const lista = todas ? partidos : partidos.filter((p) => p.liga === liga);
  if (!lista.length) {
    if (!soloVivo) return null;
    return (
      <section className="panel state">
        <span className="state-title">{cargado ? "Ahora no hay partidos en vivo" : "Buscando partidos en vivo…"}</span>
        <span className="state-desc">Se revisa cada minuto. Mientras, mira los partidos de Hoy.</span>
      </section>
    );
  }
  // con un solo partido se ve todo de entrada; con varios, compactos hasta que los despliegues
  const abierto = (p) => abiertos[p.id] ?? lista.length === 1;
  const alternar = (p) => setAbiertos((a) => ({ ...a, [p.id]: !abierto(p) }));

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
          <li key={p.id} className={goles[p.id] ? "con-gol" : ""}>
            {goles[p.id] && (
              <div className="gol-aviso" role="status">
                <span className="gol-texto">¡GOOOL!</span>
                <span className="gol-equipo">{goles[p.id]}</span>
              </div>
            )}
            {todas && <span className="match-liga">{ligas[p.liga]?.nombre}</span>}
            <Equipo e={p.local} />
            <b className="vivo-marcador">
              {p.local.goles} - {p.visita.goles}
            </b>
            <Equipo e={p.visita} />
            <span className="vivo-minuto">{p.minuto}</span>
            {onAbrir && (
              <button type="button" className="btn vivo-abrir" onClick={() => onAbrir(p)}>
                Abrir partido <Icono nombre="flechaDer" size={14} />
              </button>
            )}
            <button type="button" className="news-toggle vivo-desplegar" onClick={() => alternar(p)} aria-expanded={abierto(p)}>
              <span>{abierto(p) ? "Ocultar estadísticas" : "Ver estadísticas, sugerencias y alineaciones"}</span>
              <span aria-hidden="true">{abierto(p) ? "▴" : "▾"}</span>
            </button>
            {abierto(p) && (
            <>
            <VivoDetalle p={p} boleto={boleto} />

            </>
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
