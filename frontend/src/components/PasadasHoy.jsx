import MatchCard from "./MatchCard";

export default function PasadasHoy({ finalizados, ligas, boleto, onAbrir, onVolver }) {
  return (
    <div className="pasadas-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        ← Volver
      </button>
      <header className="home-head">
        <h1>Pasadas de hoy</h1>
        <p className="muted">Partidos del día ya finalizados. Ábrelos para ver si los parlays se cumplieron.</p>
      </header>
      {finalizados.length === 0 ? (
        <div className="panel state">
          <span className="state-title">Aún no hay partidos finalizados hoy</span>
          <span className="state-desc">Vuelve más tarde cuando hayan terminado partidos del día.</span>
        </div>
      ) : (
        <div className="match-grid">
          {finalizados.map((p) => (
            <MatchCard
              key={p.id}
              p={p}
              boleto={boleto}
              onAbrir={onAbrir}
              ligaNombre={ligas[p.liga]?.nombre ?? null}
              finalizado
            />
          ))}
        </div>
      )}
    </div>
  );
}
