import { useEffect, useRef, useState } from "react";
import NavBar from "./components/NavBar";
import Disclaimer from "./components/Disclaimer";
import Footer from "./components/Footer";
import ParlayCard from "./components/ParlayCard";
import MatchCard from "./components/MatchCard";
import PartidoPage from "./components/PartidoPage";
import Recomendaciones from "./components/Recomendaciones";
import { nombreMercado } from "./mercados";
import BoletoPanel from "./components/BoletoPanel";
import { useBoleto } from "./hooks/useBoleto";
import { useAnalisis, useLigas } from "./hooks/useAnalisis";

const DIAS = [3, 7, 14];

const parametro = (k) => new URLSearchParams(window.location.search).get(k);

function ligaInicial() {
  if (parametro("liga")) return parametro("liga");
  try {
    return localStorage.getItem("analista-liga") || "mex.1";
  } catch {
    return "mex.1";
  }
}

export default function App() {
  const ligas = useLigas();
  const [liga, setLiga] = useState(ligaInicial);
  const [dias, setDias] = useState(7);
  const { data, loading, error, despertando, refrescar } = useAnalisis(liga, dias);
  const boleto = useBoleto();
  const [boletoAbierto, setBoletoAbierto] = useState(false);

  // Página de un partido: ?liga=…&partido=… (sirve el botón Atrás y los enlaces directos)
  const [partidoId, setPartidoId] = useState(() => parametro("partido"));
  const scrollLista = useRef(0);
  useEffect(() => {
    const alNavegar = () => setPartidoId(parametro("partido"));
    window.addEventListener("popstate", alNavegar);
    return () => window.removeEventListener("popstate", alNavegar);
  }, []);
  const partido = partidoId && data?.partidos.find((x) => x.id === partidoId);
  useEffect(() => {
    if (partidoId && data && !partido && dias < 14) setDias(14); // enlace a un partido más lejano
  }, [partidoId, data, partido, dias]);
  useEffect(() => {
    window.scrollTo(0, partidoId ? 0 : scrollLista.current);
  }, [partidoId]);

  function abrirPartido(p) {
    scrollLista.current = window.scrollY;
    window.history.pushState(null, "", `?liga=${encodeURIComponent(liga)}&partido=${encodeURIComponent(p.id)}`);
    setPartidoId(p.id);
  }
  function volver() {
    window.history.pushState(null, "", window.location.pathname);
    setPartidoId(null);
  }

  // Cada selección del parlay con la fecha del partido y el nombre del equipo en vez de "Local"/"Visita".
  const conDetalle = (parlay) =>
    parlay && {
      ...parlay,
      piernas: parlay.piernas.map((x) => {
        const p = data.partidos.find((y) => y.id === x.partidoId);
        return { ...x, fecha: p?.fecha, mercado: p ? nombreMercado(x.mercado, p) : x.mercado };
      }),
    };
  const parlays = data && { masProbable: conDetalle(data.parlays.masProbable), conValor: conDetalle(data.parlays.conValor) };

  function elegirLiga(id) {
    setLiga(id);
    try {
      localStorage.setItem("analista-liga", id);
    } catch {
      // sin persistencia: solo no recuerda la liga
    }
  }

  const cargando = (
    <div className="panel state" aria-busy="true">
      <div className="server-wake-spinner" />
      <span className="state-title">{despertando ? "Despertando el servidor…" : "Analizando partidos…"}</span>
      <span className="state-desc">
        {despertando
          ? "Estaba dormido por falta de visitas; tarda alrededor de un minuto. No cierres la página."
          : "La primera vez descarga plantillas y estadísticas de los últimos partidos (~20 s); después queda guardado."}
      </span>
    </div>
  );

  return (
    <div className="app">
      <NavBar enBoleto={boleto.piernas.length} base={partidoId ? "/" : ""} onBoleto={() => setBoletoAbierto(true)} />

      {partidoId ? (
        partido ? (
          <PartidoPage p={partido} boleto={boleto} onVolver={volver} />
        ) : error || (data && dias >= 14) ? (
          <div className="panel state state-error" role="alert">
            <span className="state-title">No se encontró el partido</span>
            <span className="state-desc">{error || "Puede que ya se haya jugado o que no esté en los próximos 14 días."}</span>
            <button type="button" className="btn btn-secondary" onClick={volver}>
              ← Volver a los partidos
            </button>
          </div>
        ) : (
          cargando
        )
      ) : (
        <>
          <header className="home-head">
            <h1>
              Partidos y <span className="text-gradient">apuestas más probables</span>
            </h1>
            <p className="muted">Toca un partido para ver todo su análisis. Probabilidades estimadas con datos públicos, no certezas.</p>
          </header>

          <div className="filters">
            <div className="news-filter-bar" role="tablist" aria-label="Liga">
              {Object.entries(ligas).map(([id, l]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={liga === id}
                  className={`coin-filter-chip ${liga === id ? "active" : ""}`}
                  onClick={() => elegirLiga(id)}
                >
                  {l.nombre}
                </button>
              ))}
            </div>
            <div className="timeframe-group" aria-label="Rango de días">
              {DIAS.map((d) => (
                <button key={d} type="button" className={`timeframe-btn ${dias === d ? "active" : ""}`} onClick={() => setDias(d)}>
                  {d} días
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="panel state state-error" role="alert">
              <span className="state-icon" aria-hidden="true">⚠</span>
              <span className="state-title">No se pudo cargar el análisis</span>
              <span className="state-desc">{error}</span>
            </div>
          ) : loading || !data ? (
            cargando
          ) : (
            <>
              {/* Partidos a la izquierda; lo más recomendable en una columna aparte a la derecha */}
              <div className="home-grid">
                <section id="partidos" aria-label="Partidos">
                  {data.partidos.length ? (
                    <div className="match-grid">
                      {data.partidos.map((p) => (
                        <MatchCard key={p.id} p={p} boleto={boleto} onAbrir={abrirPartido} />
                      ))}
                    </div>
                  ) : (
                    <div className="panel state">
                      <span className="state-title">No hay partidos programados</span>
                      <span className="state-desc">Prueba con un rango de días mayor.</span>
                    </div>
                  )}
                </section>
                <aside id="recomendado" className="home-aside">
                  <Recomendaciones partidos={data.partidos} boleto={boleto} onAbrir={abrirPartido} />
                </aside>
              </div>

              <h2 id="parlays" className="section-title">Parlays sugeridos</h2>
              <p className="muted parlays-nota">Ideas de combinación para analizar. Aquí no se apuesta: si te late, ármalo en tu casa de apuestas.</p>
              <div className="parlay-grid">
                <ParlayCard
                  destacado
                  titulo="Más probable"
                  descripcion="La selección más probable de cada partido, una por partido. Paga poco, falla menos."
                  parlay={parlays.masProbable}
                />
                <ParlayCard
                  titulo="Con valor vs casas"
                  descripcion="Donde la estadística ve más probabilidad que lo que pagan las casas. Más riesgo, mejor pago."
                  parlay={parlays.conValor}
                />
              </div>

              <p className="updated">
                Datos de las {new Date(data.actualizado).toLocaleTimeString("es-MX")} (guardados en caché){" "}
                <button type="button" className="link-btn" onClick={refrescar}>
                  Actualizar
                </button>
              </p>
            </>
          )}
        </>
      )}

      <BoletoPanel boleto={boleto} abierto={boletoAbierto} setAbierto={setBoletoAbierto} />
      <Disclaimer />
      <Footer />
    </div>
  );
}
