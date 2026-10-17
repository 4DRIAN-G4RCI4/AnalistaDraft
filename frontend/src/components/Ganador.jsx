import { pct } from "../format";

// Quién puede ganar: barra Local / Empate / Visita con el más probable resaltado.
export default function Ganador({ local, visita, prob }) {
  const items = [
    ["local", local, prob.local],
    ["empate", "Empate", prob.empate],
    ["visita", visita, prob.visita],
  ];
  const [, favorito, pFav] = items.reduce((m, x) => (x[2] > m[2] ? x : m));
  return (
    <div className="ganador">
      <span className="ganador-titulo">
        {favorito === "Empate" ? "Lo más probable: empate" : `Puede ganar: ${favorito}`} <b>{pct(pFav)}</b>
      </span>
      <div className="ganador-barra" role="img" aria-label={items.map(([, n, p]) => `${n} ${pct(p)}`).join(", ")}>
        {items.map(([k, , p]) => (
          <i key={k} className={k} style={{ width: pct(p) }} />
        ))}
      </div>
      <span className="ganador-leyenda">
        {items.map(([k, n, p]) => (
          <span key={k} className={k}>
            {n} {pct(p)}
          </span>
        ))}
      </span>
    </div>
  );
}
