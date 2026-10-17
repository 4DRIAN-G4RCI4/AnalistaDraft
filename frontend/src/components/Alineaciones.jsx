import { linkSeguro } from "../format";
import { lineas } from "../alineacion";

function Jugador({ j }) {
  return (
    <span className="alin-jugador" title={`${j.nombre}${j.pos && j.pos !== "SUB" ? ` · ${j.pos}` : ""}`}>
      <span className="alin-num">{j.numero || "·"}</span>
      <span className="alin-nombre">{j.corto || j.nombre}</span>
    </span>
  );
}

function Cancha({ equipo, a }) {
  const titulares = a.jugadores.filter((j) => j.titular);
  const suplentes = a.jugadores.filter((j) => !j.titular);
  const filas = lineas(titulares, a.formacion);
  return (
    <div className="alin-equipo">
      <div className="alin-head">
        {linkSeguro(equipo.logo) && <img src={equipo.logo} alt="" width="28" height="28" />}
        <b>{equipo.nombre}</b>
        {a.formacion && <span className="alin-formacion">{a.formacion}</span>}
      </div>
      {filas ? (
        // de adelante (arriba) hacia el portero (abajo)
        <ul className="cancha" aria-label={`Titulares de ${equipo.nombre}`}>
          {[...filas].reverse().map((fila, i) => (
            <li key={i} className="cancha-fila">
              {fila.map((j) => (
                <Jugador key={j.nombre} j={j} />
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="alin-lista">
          {titulares.map((j) => (
            <li key={j.nombre}>
              <span className="alin-num">{j.numero || "·"}</span> {j.nombre}
            </li>
          ))}
        </ul>
      )}
      {suplentes.length > 0 && (
        <div className="alin-suplentes">
          <span className="market-overview-label">Suplentes</span>
          <div>
            {suplentes.map((j) => (
              <span key={j.nombre} className="alin-chip">
                {j.numero && <b>{j.numero}</b>} {j.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Titulares en la cancha según su formación y suplentes. ESPN los publica ~1 h antes del partido.
export default function Alineaciones({ local, visita, alineaciones }) {
  const equipos = [local, visita].map((e) => ({ e, a: alineaciones?.[e.id] }));
  const hay = (a) => a?.jugadores?.some((j) => j.titular);
  if (!equipos.some(({ a }) => hay(a))) {
    return <p className="muted news-empty">Aún no se publican. ESPN las da como 1 hora antes del partido.</p>;
  }
  return (
    <div className="alin-grid">
      {equipos.map(({ e, a }) =>
        hay(a) ? (
          <Cancha key={e.id} equipo={e} a={a} />
        ) : (
          <p key={e.id} className="muted news-empty">
            {e.nombre}: sin publicar todavía.
          </p>
        ),
      )}
    </div>
  );
}
