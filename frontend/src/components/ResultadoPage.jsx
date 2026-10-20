import { useEffect, useState } from "react";
import { linkSeguro, momio, pct } from "../format";
import { nombreMercado } from "../mercados";
import { evaluar } from "../evaluar";
import { VivoDetalle } from "./EnVivo";
import ParlayPartidoCard from "./ParlayPartidoCard";
import { armarParlaysPartido } from "../parlaysPartido";
import Icono from "./Icono";

const PRINCIPALES = ["Local", "Empate", "Visita", "Local o empate", "Visita o empate", "Hay ganador (sin empate)", "Más de 1.5 goles", "Más de 2.5 goles", "Menos de 2.5 goles", "Menos de 3.5 goles", "Ambos anotan", "No ambos anotan"];
const ESTADO = { si: ["check", "Se cumplió"], no: ["cruz", "No se cumplió"] };

// Las predicciones del prepartido que se pueden revisar con el resultado final.
function predicciones(pre) {
  const lista = (pre.resumen?.destacadas?.lista ?? []).map((x) => ({ mercado: x.mercado, prob: x.prob }));
  const principales = PRINCIPALES.filter((m) => pre.probs[m] >= 0.6).map((m) => ({ mercado: m, prob: pre.probs[m] }));
  const vistos = new Set();
  return [...lista, ...principales].filter((x) => !vistos.has(x.mercado) && vistos.add(x.mercado));
}

// Cómo estuvo el partido en una frase, a partir del marcador y las estadísticas.
function comoEstuvo(v) {
  const gl = v.local.goles, gv = v.visita.goles, total = gl + gv;
  const dif = Math.abs(gl - gv);
  const nL = v.local.nombre, nV = v.visita.nombre;
  const frases = [];

  if (gl === gv) frases.push(total === 0 ? `Empate sin goles entre ${nL} y ${nV}.` : `Empataron ${gl}-${gv}.`);
  else {
    const gana = gl > gv ? nL : nV;
    frases.push(dif >= 3 ? `Goleada de ${gana} por ${Math.max(gl, gv)}-${Math.min(gl, gv)}.` : dif === 1 ? `${gana} ganó apretado ${Math.max(gl, gv)}-${Math.min(gl, gv)}.` : `${gana} ganó ${Math.max(gl, gv)}-${Math.min(gl, gv)}.`);
  }

  if (total >= 5) frases.push("Partido de muchos goles.");
  else if (total === 0) frases.push("Ningún equipo logró anotar.");
  else if (total <= 1) frases.push("Partido cerrado, con pocos goles.");

  const tp = (v.local.tirosPuerta ?? 0) + (v.visita.tirosPuerta ?? 0);
  if (tp > 0) {
    const masTiros = (v.local.tirosPuerta ?? 0) > (v.visita.tirosPuerta ?? 0) ? nL : nV;
    const dTiros = Math.abs((v.local.tirosPuerta ?? 0) - (v.visita.tirosPuerta ?? 0));
    if (dTiros >= 4) frases.push(`${masTiros} dominó el arco rival (${v.local.tirosPuerta}-${v.visita.tirosPuerta} tiros a puerta).`);
  }

  const rojas = v.eventos.filter((e) => e.tipo === "roja");
  if (rojas.length) frases.push(`${rojas.length === 1 ? "Hubo una expulsión" : `Hubo ${rojas.length} expulsiones`}: ${rojas.map((r) => r.jugador || "—").join(", ")}.`);

  const amarillas = v.eventos.filter((e) => e.tipo === "amarilla").length;
  if (amarillas >= 6) frases.push(`Partido áspero, con ${amarillas} amarillas.`);

  const corners = (v.local.corners ?? 0) + (v.visita.corners ?? 0);
  if (corners >= 12) frases.push(`Mucha presión en área: ${corners} corners en total.`);

  return frases.join(" ");
}

function Cumplidas({ pre, vivo }) {
  const filas = predicciones(pre)
    .map((x) => ({ ...x, r: evaluar(x.mercado, vivo) }))
    .filter((x) => x.r === "si" || x.r === "no");
  if (!filas.length) return null;
  const aciertos = filas.filter((x) => x.r === "si").length;
  return (
    <section className="panel cumplidas">
      <div className="panel-head">
        <h2>¿Se cumplieron las predicciones?</h2>
        <span className="panel-sub">
          {aciertos} de {filas.length} acertadas
        </span>
      </div>
      <ul className="cumplidas-lista">
        {filas.map((x) => (
          <li key={x.mercado} className={`res-${x.r}`}>
            <span className="res-icono"><Icono nombre={ESTADO[x.r][0]} size={16} /></span>
            <span className="res-mercado">{nombreMercado(x.mercado, pre)}</span>
            <span className="res-prob">{pct(x.prob)} · justa {momio(1 / x.prob)}</span>
            <span className="res-estado">{ESTADO[x.r][1]}</span>
          </li>
        ))}
      </ul>
      <p className="tab-nota">Los tiros por jugador y descanso/final no se pueden revisar con los datos de ESPN.</p>
    </section>
  );
}

// Página de un partido ya terminado: resultado, cómo estuvo y si los parlays se cumplieron.
export default function ResultadoPage({ liga, evento, ligas, onVolver }) {
  const [vivo, setVivo] = useState(null);
  const [pre, setPre] = useState(null);
  const [error, setError] = useState(null);
  const q = `liga=${encodeURIComponent(liga)}&evento=${encodeURIComponent(evento)}`;

  useEffect(() => {
    fetch(`/api/partido?${q}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
        setVivo(j);
      })
      .catch((e) => setError(e.message));
    fetch(`/api/prepartido?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPre)
      .catch(() => {});
  }, [q]);

  if (error && !vivo) {
    return (
      <div className="panel state state-error" role="alert">
        <span className="state-title">No se pudo cargar el partido</span>
        <span className="state-desc">{error}</span>
        <button type="button" className="btn btn-secondary" onClick={onVolver}><Icono nombre="flechaIzq" size={15} /> Volver</button>
      </div>
    );
  }
  if (!vivo) {
    return (
      <div className="panel state" aria-busy="true" role="status">
        <div className="server-wake-spinner" />
        <span className="state-title">Cargando el resultado…</span>
      </div>
    );
  }

  const parlays = pre && (pre.resumen?.parlays ?? armarParlaysPartido(pre));
  const Escudo = ({ e }) => (
    <div className="vivo-hero-equipo">
      {linkSeguro(e.logo) && <img src={e.logo} alt="" width="64" height="64" />}
      <b>{e.nombre}</b>
    </div>
  );

  return (
    <div className="partido-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}><Icono nombre="flechaIzq" size={15} /> Volver a Pasadas</button>

      <section className="panel vivo-hero terminado">
        <span className="match-liga">{ligas[liga]?.nombre}</span>
        <div className="vivo-hero-marcador">
          <Escudo e={vivo.local} />
          <div className="vivo-hero-centro">
            <span className="vivo-hero-goles">{vivo.local.goles} - {vivo.visita.goles}</span>
            <span className="vivo-hero-fin">Final</span>
          </div>
          <Escudo e={vivo.visita} />
        </div>
        <p className="resultado-resumen">{comoEstuvo(vivo)}</p>
        {/* sin boleto: el partido ya terminó, no hay nada que apostar */}
        <VivoDetalle p={vivo} boleto={null} />
      </section>

      {!pre ? (
        <div className="panel state" role="status">
          <div className="server-wake-spinner" />
          <span className="state-title">Reconstruyendo las predicciones de antes del inicio…</span>
        </div>
      ) : (
        <>
          {parlays && (parlays.factible || parlays.sonador) && (
            <section className="parlays-partido-container">
              <div className="section-head-simple">
                <h2 className="section-title">¿Se cumplieron los parlays?</h2>
                <p className="muted parlays-nota">Las combinadas que el sitio sugirió antes del partido, revisadas con el resultado final.</p>
              </div>
              <div className="parlay-grid">
                {parlays.factible && <ParlayPartidoCard parlay={parlays.factible} p={pre} vivo={vivo} boleto={null} destacado />}
                {parlays.sonador && <ParlayPartidoCard parlay={parlays.sonador} p={pre} vivo={vivo} boleto={null} />}
              </div>
            </section>
          )}
          <Cumplidas pre={pre} vivo={vivo} />
        </>
      )}
    </div>
  );
}
