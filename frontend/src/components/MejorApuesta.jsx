import { momio, pct } from "../format";
import { CATEGORIA, nombreMercado, pierna } from "../mercados";
import AddButton from "./AddButton";
import { MOMENTO } from "./Recomendaciones";

const TIPO = { goles: "Goles", jugadores: "Jugador", ...CATEGORIA };

// Lo más recomendable de este partido entre todos los mercados (goles, tiempos, corners, tarjetas, tiros, jugadores).
// completa: la página del partido muestra las 5 con su razón; la tarjeta solo 3.
export default function MejorApuesta({ p, boleto, completa = false }) {
  const { lista = [], valor } = p.resumen.destacadas;
  const { cuando } = p.resumen;
  const recomendadas = completa ? lista : lista.slice(0, 3);
  if (!recomendadas.length && !valor) {
    return <div className="mejor mejor-vacia">Sin una apuesta clara en este partido: mejor dejarlo fuera.</div>;
  }
  const [primera, ...resto] = recomendadas;
  const paga = (x) => (x.cuota ? `Paga ${momio(x.cuota)}` : `Paga justo ${momio(1 / x.prob)}`);

  return (
    <div className="mejor">
      {primera && (
        <>
          <div className="mejor-principal">
            <div>
              <span className="mejor-label">Lo más recomendable · {TIPO[primera.categoria]}</span>
              <span className="mejor-mercado">{primera.nombre}</span>
              <span className="mejor-meta">{paga(primera)}</span>
            </div>
            <div className="mejor-lado">
              <span className="mejor-prob">{pct(primera.prob)}</span>
              <AddButton boleto={boleto} sel={pierna(p, primera.mercado, primera.prob, primera.cuota)} />
            </div>
          </div>
          <p className="mejor-razon">{primera.razon}</p>
        </>
      )}
      {resto.map((x) => (
        <div key={x.mercado} className="mejor-linea">
          <span>
            <span className="mejor-tipo">{TIPO[x.categoria]}</span> <b>{x.nombre}</b> · {pct(x.prob)} · {paga(x).toLowerCase()}
            {completa && <span className="mejor-razon-linea">{x.razon}</span>}
          </span>
          <AddButton boleto={boleto} sel={pierna(p, x.mercado, x.prob, x.cuota)} />
        </div>
      ))}
      {valor && (
        <div className="mejor-linea">
          <span>
            <span className="mejor-tipo">Valor</span> <b>{nombreMercado(valor.mercado, p)}</b> · {pct(valor.prob)} · paga {momio(valor.cuota)}
            <span className="pct-pill up"> +{(valor.ventaja * 100).toFixed(1)} pts vs casas</span>
          </span>
          <AddButton boleto={boleto} sel={pierna(p, valor.mercado, valor.prob, valor.cuota)} />
        </div>
      )}
      <div className={`mejor-cuando reco-cuando ${cuando.momento}`}>
        {MOMENTO[cuando.momento][0]} <b>{MOMENTO[cuando.momento][1]}:</b> {cuando.texto}
      </div>
    </div>
  );
}
