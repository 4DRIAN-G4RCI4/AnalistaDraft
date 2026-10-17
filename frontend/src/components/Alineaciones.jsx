// Titulares y suplentes de cada equipo. ESPN los publica ~1 h antes del partido.
export default function Alineaciones({ p }) {
  const equipos = [p.local, p.visita].map((e) => ({ e, a: p.alineaciones?.[e.id] }));
  if (!equipos.some(({ a }) => a?.jugadores?.some((j) => j.titular))) {
    return <p className="muted news-empty">Aún no se publican. ESPN las da como 1 hora antes del partido: vuelve a abrir el partido cerca de la hora.</p>;
  }
  return (
    <div className="forma-grid">
      {equipos.map(({ e, a }) => {
        const titulares = a?.jugadores.filter((j) => j.titular) ?? [];
        const suplentes = a?.jugadores.filter((j) => !j.titular) ?? [];
        return (
          <div key={e.id}>
            <h3 className="forma-titulo">
              {e.nombre}
              {a?.formacion && <span className="muted"> · {a.formacion}</span>}
            </h3>
            {titulares.length ? (
              <>
                <ul className="alineacion">
                  {titulares.map((j) => (
                    <li key={j.nombre}>
                      <span className="alin-pos">{j.pos === "SUB" ? "" : j.pos}</span> {j.nombre}
                    </li>
                  ))}
                </ul>
                {suplentes.length > 0 && (
                  <p className="forma-prom">
                    <b>Suplentes:</b> {suplentes.map((j) => j.nombre).join(", ")}
                  </p>
                )}
              </>
            ) : (
              <p className="muted news-empty">Sin publicar todavía.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
