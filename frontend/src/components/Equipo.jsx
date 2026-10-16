import { eur, linkSeguro } from "../format";

export const FORMA = { W: ["G", "win"], D: ["E", "draw"], L: ["P", "loss"] };

export default function Equipo({ e }) {
  return (
    <div className="team">
      {linkSeguro(e.logo) ? <img src={e.logo} alt="" width="44" height="44" /> : <div className="team-logo-ph" />}
      <span className="team-name">{e.nombre}</span>
      <span className="team-meta">{e.pos ? `${e.pos}º · ${e.gf}-${e.gc} en ${e.pj} PJ` : "sin tabla"}</span>
      <span className="team-meta">Plantilla {eur(e.valor)}</span>
      <div className="form-row" aria-label={`Forma reciente: ${e.forma || "sin datos"}`}>
        {[...e.forma].map((c, i) => (
          <span key={i} className={`form-dot ${FORMA[c]?.[1] ?? ""}`}>{FORMA[c]?.[0] ?? c}</span>
        ))}
      </div>
    </div>
  );
}

// Encabezado del partido: los dos equipos y los goles esperados al centro.
export function Enfrentamiento({ p }) {
  return (
    <div className="match-teams">
      <Equipo e={p.local} />
      <div className="match-vs">
        <span className="match-xg">
          {p.golesEsperados.local.toFixed(1)} – {p.golesEsperados.visita.toFixed(1)}
        </span>
        <span className="match-xg-label">goles esp.</span>
      </div>
      <Equipo e={p.visita} />
    </div>
  );
}
