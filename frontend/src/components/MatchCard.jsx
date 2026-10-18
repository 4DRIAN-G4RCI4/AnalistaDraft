import { fecha } from "../format";
import { Enfrentamiento } from "./Equipo";
import MejorApuesta from "./MejorApuesta";
import Ganador from "./Ganador";

// Tarjeta compacta de la lista: lo principal y "Ver más" para la página completa del partido.
export default function MatchCard({ p, boleto, onAbrir, ligaNombre, finalizado = false }) {
  const alertas = p.resumen.alertas.length + p.noticias.filter((n) => n.alerta).length;
  return (
    <article className={`panel match${finalizado ? " match-finalizado" : ""}`}>
      <div className="match-date">
        {ligaNombre && <span className="match-liga">{ligaNombre}</span>}
        {finalizado && <span className="match-finalizado-chip">Finalizado</span>}
        {fecha(p.fecha)}
      </div>
      <Enfrentamiento p={p} />
      {finalizado && p.marcadorFinal && (
        <div className="match-resultado-final">
          <span className="match-goles-final">{p.marcadorFinal.local.goles} – {p.marcadorFinal.visita.goles}</span>
          <span className="match-resultado-label">Resultado final</span>
        </div>
      )}
      <Ganador local={p.local.nombre} visita={p.visita.nombre} prob={{ local: p.probs.Local, empate: p.probs.Empate, visita: p.probs.Visita }} />
      <MejorApuesta p={p} boleto={boleto} />
      <button type="button" className="btn ver-mas" onClick={() => onAbrir(p)}>
        {finalizado ? "Ver si se cumplieron los parlays →" : "Ver más: todos los datos del partido →"}
      </button>
      {alertas > 0 && <span className="ver-mas-nota alert-text">{alertas} alerta(s) en el análisis</span>}
    </article>
  );
}
