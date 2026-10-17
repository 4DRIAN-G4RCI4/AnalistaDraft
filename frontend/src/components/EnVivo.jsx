import { useEffect, useState } from "react";
import { linkSeguro } from "../format";

const CADA = 60e3;

// Franja con los partidos que se están jugando ahora: marcador y minuto, se actualiza cada minuto.
export default function EnVivo({ liga, ligas }) {
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
        <span className="panel-sub">se actualiza cada minuto · sin análisis</span>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
