import { useEffect, useState } from "react";
import { fecha, linkSeguro, momio, pct } from "../format";
import { CATEGORIA, nombreMercado, pierna } from "../mercados";
import { Enfrentamiento, FORMA } from "./Equipo";
import Puntos from "./Puntos";
import MejorApuesta from "./MejorApuesta";
import AddButton from "./AddButton";
import Historial from "./Historial";
import Ganador from "./Ganador";

const PRINCIPALES = [
  "Local", "Empate", "Visita", "Local o empate", "Visita o empate", "Hay ganador (sin empate)",
  "Más de 1.5 goles", "Más de 2.5 goles", "Menos de 2.5 goles", "Menos de 3.5 goles", "Ambos anotan", "No ambos anotan",
];

// Una fila de mercado. est = estadística pura (solo goles); casa = cuota de las casas si existe.
function Fila({ p, m, prob, est, casa, destacado, boleto, soloEst, simple }) {
  const dif = casa && est != null ? est - casa.prob : null; // positivo = posible valor
  return (
    <tr className={destacado ? "pick" : ""}>
      <td>{nombreMercado(m, p)}</td>
      {!simple && (
        <td className="bar-cell">
          <div className="prob-bar">
            <i style={{ width: pct(prob) }} />
          </div>
        </td>
      )}
      <td className="final">
        <span className={`prob-nivel ${prob >= 0.75 ? "alta" : prob >= 0.6 ? "media" : "baja"}`}>{pct(prob)}</span>
      </td>
      {/* Lo que paga: la cuota real de la casa, o la justa (1 / probabilidad) si la casa no la publica */}
      <td className="paga" title={casa?.mejorCasa ? `Mejor pago: ${casa.mejorCasa}` : casa ? undefined : "Momio justo según la probabilidad"}>
        {casa ? <b>{momio(casa.cuota)}</b> : <span className="justo">{prob > 0.01 ? momio(1 / prob) : "—"}</span>}
      </td>
      {!soloEst && !simple && (
        <>
          <td className={dif > 0.03 ? "up" : dif < -0.03 ? "down" : ""}>{est != null ? pct(est) : "—"}</td>
          <td>{casa ? pct(casa.prob) : "—"}</td>
        </>
      )}
      <td>
        <AddButton boleto={boleto} sel={pierna(p, m, prob, casa?.cuota ?? null)} />
      </td>
    </tr>
  );
}

const NOTA = {
  tiempos: "Con los goles esperados del partido y en qué tiempo suelen caer los goles de estos equipos.",
  jugadores: "Su parte de los tiros y goles de su equipo en los últimos partidos × lo que se espera del equipo hoy. Si ya hay alineación y no es titular, baja mucho.",
  otros: "Calculado con sus últimos partidos (incluye copas). Las casas no publican estas cuotas gratis: es solo estadística.",
  tiros: "Tiros totales = todos los intentos (a puerta, desviados y bloqueados), como los cuenta ESPN. Cada casa tiene sus reglas (algunas no cuentan los bloqueados) y ESPN no publica gratis los tiros dentro del área: lo más confiable es Tiros a puerta.",
};

// Probabilidades por jugador: anotar, tiros a puerta y tiros.
const COLUMNAS = [
  ["prob", "Anota", (n) => `${n} anota`],
  ["prob2", "2+ goles", (n) => `${n} 2+ goles`],
  ["puerta1", "1+ a puerta", (n) => `${n} 1+ tiros a puerta`],
  ["puerta2", "2+ a puerta", (n) => `${n} 2+ tiros a puerta`],
  ["tiros1", "1+ tiros", (n) => `${n} 1+ tiros`],
  ["tiros2", "2+ tiros", (n) => `${n} 2+ tiros`],
  ["tiros3", "3+ tiros", (n) => `${n} 3+ tiros`],
];

const SIMPLES = ["prob", "puerta1", "tiros2"];

function Jugadores({ p, boleto, simple }) {
  const columnas = simple ? COLUMNAS.filter(([k]) => SIMPLES.includes(k)) : COLUMNAS;
  return [
    ["local", p.local],
    ["visita", p.visita],
  ].map(([lado, e]) => {
    const lista = p.goleadores?.[lado] ?? [];
    return (
      <div key={lado} className="jugadores-equipo">
        <h3 className="forma-titulo">{e.nombre}</h3>
        {!lista.length ? (
          <p className="muted news-empty">Sin datos de jugadores en sus últimos partidos.</p>
        ) : (
          <div className="table-wrap">
            <table className={`prob-table jugadores-tabla ${simple ? "simple" : ""}`}>
              <thead>
                <tr>
                  <th>Jugador</th>
                  {columnas.map(([k, t]) => (
                    <th key={k}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <span className="jugador-nombre">{j.nombre}</span>
                      <span className="jugador-meta">
                        {j.pos} · {j.goles} G · {j.tirosPuerta} AP · {j.tiros} T en {j.partidos} PJ
                        {j.titularConfirmado === true && " · titular"}
                        {j.titularConfirmado === false && " · suplente"}
                      </span>
                    </td>
                    {columnas.map(([k, , mercado]) => (
                      <td key={k}>
                        {j[k] == null ? (
                          "—"
                        ) : (
                          <span className="celda-jugador">
                            {pct(j[k])}
                            <AddButton boleto={boleto} sel={pierna(p, mercado(j.nombre), j[k])} />
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  });
}

function Forma({ p }) {
  if (!p.forma) return <p className="muted news-empty">Sin datos de sus últimos partidos.</p>;
  return (
    <div className="forma-grid">
      {[p.local, p.visita].map((e, i) => {
        const f = i === 0 ? p.forma.local : p.forma.visita;
        return (
          <div key={e.id}>
            <h3 className="forma-titulo">
              {e.nombre}: últimos {f.resultados.length}
            </h3>
            <ul className="forma-lista">
              {f.resultados.map((r, j) => (
                <li key={j}>
                  <span className={`form-dot ${FORMA[r.resultado]?.[1] ?? ""}`}>{FORMA[r.resultado]?.[0] ?? "?"}</span>
                  <span className="forma-marcador">{r.marcador}</span>
                  <span className="forma-rival">
                    {r.local ? "vs" : "@"} {r.rival}
                  </span>
                  <span className="forma-comp">
                    {r.competicion} · {fecha(r.fecha)}
                  </span>
                </li>
              ))}
            </ul>
            {f.favor && (
              <p className="forma-prom">
                Promedio: {f.favor.corners.toFixed(1)} corners · {f.favor.tiros.toFixed(1)} tiros · {f.favor.tirosPuerta.toFixed(1)} a puerta ·{" "}
                {f.favor.tarjetas.toFixed(1)} tarjetas
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Noticias({ noticias }) {
  if (!noticias.length) return <p className="muted news-empty">Sin noticias recientes de estos equipos.</p>;
  return (
    <ul className="news-list">
      {noticias.map((n, i) => (
        <li key={i} className="news-item">
          <div className="news-item-text">
            {linkSeguro(n.url) ? (
              <a className="news-item-title" href={n.url} target="_blank" rel="noopener noreferrer">
                {n.alerta && <span className="alert-text">⚠ </span>}
                {n.titulo}
              </a>
            ) : (
              <span className="news-item-title">{n.titulo}</span>
            )}
            {n.resumen && <span className="news-summary">{n.resumen}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Página de un partido con todos sus datos.
export default function PartidoPage({ p, boleto, onVolver }) {
  const [tab, setTab] = useState("principales");
  const [verTodos, setVerTodos] = useState(false); // por defecto solo las más probables
  const r = p.resumen;
  const d = r.destacadas;
  const picks = new Set([d.valor?.mercado, ...(d.lista ?? []).map((x) => x.mercado)].filter(Boolean));
  const confirmadas = p.alineacion?.[p.local.id] && p.alineacion?.[p.visita.id];

  useEffect(() => {
    document.title = `${p.titulo} — AnalistaDraft`;
    return () => {
      document.title = "AnalistaDraft — Análisis de fútbol y parlays";
    };
  }, [p.titulo]);

  const tabs = [
    ["principales", "Principales"],
    ["goles", "Goles"],
    ...Object.keys(p.extras ?? {}).map((c) => [c, CATEGORIA[c]]),
    ["jugadores", "Jugadores"],
  ];
  const soloEst = !["principales", "goles"].includes(tab); // sin cuotas de casas
  const deGoles = (m) => [m, p.probs[m], p.modelo?.[m], p.mercado[m]];
  const filas =
    tab === "principales"
      ? PRINCIPALES.map(deGoles)
      : tab === "goles"
        ? Object.keys(p.probs).filter((m) => !PRINCIPALES.includes(m)).map(deGoles)
        : tab === "jugadores"
          ? []
          : Object.entries(p.extras[tab].probs).map(([m, prob]) => [m, prob, null, null]);

  // Vista simple: las más probables (60% o más), de mayor a menor
  const masProbables = filas.filter(([, prob]) => prob >= 0.6).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const simple = !verTodos;
  const visibles = simple ? masProbables : filas;

  return (
    <div className="partido-page">
      <button type="button" className="btn btn-secondary volver" onClick={onVolver}>
        ← Volver a los partidos
      </button>

      <section className="panel partido-hero">
        <div className="match-date">{fecha(p.fecha)}</div>
        <Enfrentamiento p={p} />
        <div className="match-chips">
          <span className={`fuente-chip ${p.ajustadoACasas ? "casas" : ""}`}>
            {p.ajustadoACasas ? `Ajustado a las casas (${p.casa})` : "Solo estadística"}
          </span>
          <span className={`fuente-chip ${confirmadas ? "casas" : "neutro"}`}>
            {confirmadas ? "Alineaciones confirmadas" : "Alineaciones aún no publicadas"}
          </span>
          <span className="fuente-chip neutro">
            Marcador probable {p.marcador.local}-{p.marcador.visita} ({pct(p.marcador.prob)})
          </span>
        </div>
        <Ganador local={p.local.nombre} visita={p.visita.nombre} prob={{ local: p.probs.Local, empate: p.probs.Empate, visita: p.probs.Visita }} />
        <MejorApuesta p={p} boleto={boleto} completa />
      </section>

      <div className="partido-grid">
        <div className="partido-lateral">
        <section className="panel">
          <div className="panel-head">
            <h2>Mercados</h2>
            <span className="panel-sub">{simple ? "solo las más probables" : "Paga en gris = momio justo (la casa no lo publica)"}</span>
          </div>
          <div className="timeframe-group tabs" role="group" aria-label="Tipo de mercado">
            {tabs.map(([id, nombre]) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                className={`timeframe-btn ${tab === id ? "active" : ""}`}
                onClick={() => {
                  setTab(id);
                  setVerTodos(false);
                }}
              >
                {nombre}
              </button>
            ))}
          </div>

          {tab === "jugadores" ? (
            <Jugadores p={p} boleto={boleto} simple={simple} />
          ) : (
            <table className="prob-table">
              <thead>
                <tr>
                  <th>Mercado</th>
                  {!simple && <th className="bar-cell" aria-hidden="true" />}
                  <th>Prob.</th>
                  <th>Paga</th>
                  {!soloEst && !simple && (
                    <>
                      <th>Estad.</th>
                      <th>{p.casa ? `Casas (${p.casa})` : "Casas"}</th>
                    </>
                  )}
                  <th>
                    <span className="visually-hidden">Boleto</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(([m, prob, est, casa]) => (
                  <Fila key={m} p={p} m={m} prob={prob} est={est} casa={casa} destacado={picks.has(m)} boleto={boleto} soloEst={soloEst} simple={simple} />
                ))}
                {!visibles.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Ningún mercado llega a 60% aquí.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {(
            <button type="button" className="link-btn" onClick={() => setVerTodos((v) => !v)} aria-expanded={verTodos}>
              {verTodos ? "− Ver solo lo principal" : tab === "jugadores" ? "+ Ver todas las columnas (2+ goles, 3+ tiros…)" : `+ Ver todos los mercados (${filas.length}) con detalle`}
            </button>
          )}
          {tab !== "jugadores" && (
            <p className="tab-nota">
              <b>Paga</b> en negritas = cuota real de las casas. En gris = cuota justa según la probabilidad: tu casa pagará un poco menos.
            </p>
          )}
          {soloEst && <p className="tab-nota">{NOTA[tab] ?? NOTA.otros}</p>}
        </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Noticias</h2>
              <span className="panel-sub">{p.noticias.length}</span>
            </div>
            <Noticias noticias={p.noticias} />
          </section>


        </div>

        <div className="partido-lateral">
          <section className="panel">
            <div className="panel-head">
              <h2>Análisis</h2>
            </div>
            <Puntos fuertes={r.fuertes} alertas={r.alertas} datos={r.datos} balance={[r.balance]} />
          </section>



        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Últimos partidos</h2>
          <span className="panel-sub">incluye copas</span>
        </div>
        <Forma p={p} />
      </section>

      <section className="panel historial-panel">
        <div className="panel-head">
          <h2>Qué se habría ganado</h2>
          <span className="panel-sub">en sus últimos partidos</span>
        </div>
        <p className="tab-nota">Apuestas comunes que se cumplieron en cada partido reciente. Que se haya cumplido antes no garantiza que se repita.</p>
        <Historial p={p} />
      </section>
    </div>
  );
}
