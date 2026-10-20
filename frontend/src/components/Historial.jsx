import { fecha } from "../format";
import { ganadoras, resumen } from "../historial";
import Icono from "./Icono";

// Feed: en cada uno de sus últimos partidos, qué apuestas comunes se habrían ganado.
export default function Historial({ p }) {
  if (!p.forma) return <p className="muted news-empty">Sin datos de sus últimos partidos.</p>;
  return (
    <div className="historial">
      {[
        [p.local, p.forma.local],
        [p.visita, p.forma.visita],
      ].map(([e, f]) => (
        <div key={e.id}>
          <h3 className="forma-titulo">{e.nombre}</h3>
          <ul className="hist-resumen">
            {resumen(f.resultados).map((x) => (
              <li key={x.nombre} className={x.veces / x.de >= 0.8 ? "alto" : ""}>
                {x.nombre} <b>{x.veces}/{x.de}</b>
              </li>
            ))}
          </ul>
          <ul className="hist-feed">
            {f.resultados.map((r, i) => {
              const g = ganadoras(r);
              return (
                <li key={i}>
                  <span className="hist-partido">
                    <b>{r.marcador}</b> {r.local ? "vs" : "@"} {r.rival} · {fecha(r.fecha)}
                    {r.corners != null && ` · ${r.corners} corners`}
                  </span>
                  <span className="hist-chips">
                    {g.length ? g.map((n) => <span key={n} className="hist-chip"><Icono nombre="check" size={12} /> {n}</span>) : <span className="muted">Ninguna</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
