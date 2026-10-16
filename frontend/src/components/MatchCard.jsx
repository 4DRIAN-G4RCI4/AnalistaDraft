import { fecha } from "../format";
import { Enfrentamiento } from "./Equipo";
import MejorApuesta from "./MejorApuesta";

// Tarjeta compacta de la lista: lo principal y "Ver más" para la página completa del partido.
export default function MatchCard({ p, boleto, onAbrir }) {
  const alertas = p.resumen.alertas.length + p.noticias.filter((n) => n.alerta).length;
  return (
    <article className="panel match">
      <div className="match-date">{fecha(p.fecha)}</div>
      <Enfrentamiento p={p} />
      <MejorApuesta p={p} boleto={boleto} />
      <button type="button" className="btn ver-mas" onClick={() => onAbrir(p)}>
        Ver más: todos los datos del partido →
      </button>
      {alertas > 0 && <span className="ver-mas-nota alert-text">{alertas} alerta(s) en el análisis</span>}
    </article>
  );
}
