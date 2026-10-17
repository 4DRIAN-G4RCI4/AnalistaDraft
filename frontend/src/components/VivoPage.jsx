import { useEffect, useState } from "react";
import { linkSeguro, momio, pct } from "../format";
import { nombreMercado } from "../mercados";
import { evaluar } from "../evaluar";
import { VivoDetalle } from "./EnVivo";
import Ganador from "./Ganador";
import MejorApuesta from "./MejorApuesta";

const CADA = 60e3;
const PRINCIPALES = ["Local", "Empate", "Visita", "Local o empate", "Visita o empate", "Hay ganador (sin empate)", "Más de 1.5 goles", "Más de 2.5 goles", "Menos de 2.5 goles", "Menos de 3.5 goles", "Ambos anotan", "No ambos anotan"];
const ESTADO = { si: ["✓", "Cumplida"], no: ["✗", "Fallida"], pendiente: ["⏳", "En juego"] };

// Predicciones del prepartido a revisar: lo recomendado y los mercados principales que tenían 60% o más.
function predicciones(pre) {
  const lista = (pre.resumen.destacadas.lista ?? []).map((x) => ({ mercado: x.mercado, prob: x.prob }));
  const principales = PRINCIPALES.filter((m) => pre.probs[m] >= 0.6).map((m) => ({ mercado: m, prob: pre.probs[m] }));
  const vistos = new Set();
  return [...lista, ...principales].filter((x) => !vistos.has(x.mercado) && vistos.add(x.mercado));
}

function Cumplidas({ pre, vivo }) {
  const filas = predicciones(pre)
    .map((x) => ({ ...x, r: evaluar(x.mercado, vivo) }))
    .filter((x) => x.r);
  const cuenta = (r) => filas.filter((x) => x.r === r).length;
  return (
    <section className="panel cumplidas">
      <div className="panel-head">
        <h2>¿Se cumplió el prepartido?</h2>
        <span className="panel-sub">
          ✓ {cuenta("si")} · ✗ {cuenta("no")} · ⏳ {cuenta("pendiente")}
        </span>
      </div>
      <ul className="cumplidas-lista">
        {filas.map((x) => (
          <li key={x.mercado} className={`res-${x.r}`}>
            <span className="res-icono" aria-hidden="true">
              {ESTADO[x.r][0]}
            </span>
            <span className="res-mercado">{nombreMercado(x.mercado, pre)}</span>
            <span className="res-prob">
              {pct(x.prob)} · justa {momio(1 / x.prob)}
            </span>
            <span className="res-estado">{ESTADO[x.r][1]}</span>
          </li>
        ))}
      </ul>
      <p className="tab-nota">Se actualiza con cada refresco. Los tiros por jugador y medio tiempo/final no se pueden revisar con los datos en vivo de ESPN.</p>
    </section>
  );
}

// Página de un partido en vivo (o recién terminado): marcador, estadísticas, prepartido y qué se cumplió.
export default function VivoPage({ liga, evento, ligas, boleto, onVolver }) {
  const [vivo, setVivo] = useState(null);
  const [error, setError] = useState(null);
  const [verPre, setVerPre] = useState(false);
  const [pre, setPre] = useState(null);
  const [errorPre, setErrorPre] = useState(false);
  const q = `liga=${encodeURIComponent(liga)}&evento=${encodeURIComponent(evento)}`;

  useEffect(() => {
    let activo = true;
    const cargar = () =>
      fetch(`/api/partido?${q}`)
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
          if (activo) setVivo(j);
        })
        .catch((e) => activo && setError(e.message));
    cargar();
    const t = setInterval(cargar, CADA);
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, [q]);

  function alternarPre() {
    if (!verPre && !pre) {
      fetch(`/api/prepartido?${q}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setPre)
        .catch(() => setErrorPre(true));
    }
    setVerPre((v) => !v);
  }

  if (error && !vivo) {
    return (
      <div className="panel state state-error" role="alert">
        <span className="state-title">No se pudo cargar el partido</span>
        <span className="state-desc">{error}</span>
        <button type="button" className="btn btn-secondary" onClick={onVolver}>
          ← Volver
        </button>
      </div>
    );
  }
  if (!vivo) {
    return (
      <div className="panel state" aria-busy="true" role="status">
        <div className="server-wake-spinner" />
        <span className="state-title">Cargando partido…</span>
      </div>
    );
  }

  const terminado = vivo.estado === "post";
  const Escudo = ({ e }) => (
    <div className="vivo-hero-equipo">
      {linkSeguro(e.logo) && <img src={e.logo} alt="" width="64" height="64" />}
      <b>{e.nombre}</b>
    </div>
  );

  return (
    <div className="partido-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        ← Volver a los partidos
      </button>

      <section className={`panel vivo-hero ${terminado ? "terminado" : ""}`}>
        <span className="match-liga">{ligas[liga]?.nombre}</span>
        <div className="vivo-hero-marcador">
          <Escudo e={vivo.local} />
          <div className="vivo-hero-centro">
            <span className="vivo-hero-goles">
              {vivo.local.goles} - {vivo.visita.goles}
            </span>
            <span className={terminado ? "vivo-hero-fin" : "vivo-minuto"}>
              {terminado ? "Final" : <><span className="vivo-punto" aria-hidden="true" /> {vivo.minuto}</>}
            </span>
          </div>
          <Escudo e={vivo.visita} />
        </div>
        <VivoDetalle p={vivo} boleto={terminado ? null : boleto} />
      </section>

      <button type="button" className="btn ver-pre" onClick={alternarPre} aria-expanded={verPre}>
        {verPre ? "Ocultar análisis prepartido" : "Ver análisis prepartido"}
      </button>

      {verPre &&
        (errorPre ? (
          <p className="error">No se pudo reconstruir el prepartido.</p>
        ) : !pre ? (
          <div className="panel state" role="status">
            <div className="server-wake-spinner" />
            <span className="state-title">Reconstruyendo el análisis de antes del inicio…</span>
          </div>
        ) : (
          <>
            <Cumplidas pre={pre} vivo={vivo} />
            <section className="panel partido-hero">
              <div className="panel-head">
                <h2>Análisis prepartido</h2>
                <span className="panel-sub">{pre.ajustadoACasas ? "con los momios de antes del inicio" : "solo estadística (la casa ya no publica los momios previos)"}</span>
              </div>
              <Ganador local={pre.local.nombre} visita={pre.visita.nombre} prob={{ local: pre.probs.Local, empate: pre.probs.Empate, visita: pre.probs.Visita }} />
              <MejorApuesta p={pre} boleto={boleto} completa />
            </section>
          </>
        ))}
    </div>
  );
}
