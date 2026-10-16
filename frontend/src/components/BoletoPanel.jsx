import { useEffect, useState } from "react";
import { analizarBoleto, probManual } from "../boleto";
import { fecha, momio, pct } from "../format";
import Puntos from "./Puntos";

const numero = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const dinero = (n) => `$${n.toFixed(2)}`;

// Simulador de boleto: calcula probabilidad y ganancia estimada. Aquí no se apuesta.
// La cuota sale sola: lo que pagan las casas y, donde no publican, la cuota justa del modelo.
export default function BoletoPanel({ boleto, abierto, setAbierto }) {
  const [monto, setMonto] = useState("");
  const [manual, setManual] = useState({ texto: "", cuota: "" });
  const [verManual, setVerManual] = useState(false);
  const [verAnalisis, setVerAnalisis] = useState(false);
  const { piernas, quitar, vaciar, agregar } = boleto;

  const cuota = piernas.reduce((c, x) => c * (x.cuota ?? 1 / x.prob), 1);
  const todasConCasa = piernas.length > 0 && piernas.every((x) => x.cuota);
  const a = analizarBoleto(piernas, { monto: numero(monto) ?? 0 });
  const apuesta = numero(monto);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, setAbierto]);

  function agregarManual(e) {
    e.preventDefault();
    const c = numero(manual.cuota);
    if (!manual.texto.trim() || !c || c <= 1) return;
    agregar({ partido: "Selección manual", mercado: manual.texto.trim().slice(0, 80), prob: probManual(c), cuota: c, manual: true });
    setManual({ texto: "", cuota: "" });
  }

  return (
    <>
      {!abierto && piernas.length > 0 && (
        <button type="button" className="boleto-fab" onClick={() => setAbierto(true)}>
          <span aria-hidden="true">🧮</span> Simulador ({piernas.length}) · <b>{pct(a.prob)}</b> · cuota {cuota.toFixed(2)}
        </button>
      )}
      {abierto && <div className="drawer-overlay" onClick={() => setAbierto(false)} aria-hidden="true" />}

      <aside className={`boleto-drawer ${abierto ? "open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="boleto-titulo" aria-hidden={!abierto} inert={!abierto}>
        <div className="drawer-head">
          <h2 id="boleto-titulo">Simulador de boleto ({piernas.length})</h2>
          <button type="button" className="leg-remove" onClick={() => setAbierto(false)} aria-label="Cerrar simulador">
            ×
          </button>
        </div>
        <p className="simulador-nota">Aquí no se apuesta: solo calcula qué tan probable es y cuánto ganarías. Para apostar, ármalo en tu casa de apuestas.</p>

        {!piernas.length ? (
          <p className="parlay-desc">
            Agrega selecciones con el <b>+</b> de cada partido.
          </p>
        ) : (
          <ul className="boleto-legs">
            {piernas.map((x) => (
              <li key={`${x.partidoId ?? x.partido}|${x.mercado}`}>
                <div className="leg-main">
                  <span className="leg-market">{x.mercado}</span>
                  <span className="leg-date">
                    {x.manual ? "Selección manual" : x.partido}
                    {x.fecha && ` · ${fecha(x.fecha)}`}
                  </span>
                </div>
                <span className="leg-paga">{(x.cuota ?? 1 / x.prob).toFixed(2)}</span>
                <span className={`prob-chip ${x.prob < 0.6 ? "riesgo" : ""}`}>{pct(x.prob)}</span>
                <button type="button" className="leg-remove" onClick={() => quitar(x)} aria-label={`Quitar ${x.mercado}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {a && (
          <>
            <label className="simulador-monto">
              <span className="market-overview-label">¿Cuánto apostarías?</span>
              <input inputMode="decimal" placeholder="Ej. 50" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </label>

            <div className="boleto-resumen">
              <div>
                <span className="market-overview-label">Prob. de acertar</span>
                <span className="boleto-prob">{pct(a.prob)}</span>
              </div>
              <div className="parlay-odds">
                <span>
                  Cuota <b>{momio(cuota)}</b>
                </span>
                {apuesta ? (
                  <>
                    <span>
                      Si aciertas cobras <b>{dinero(apuesta * cuota)}</b>
                    </span>
                    <span className="pct-pill up">Ganancia {dinero(apuesta * (cuota - 1))}</span>
                  </>
                ) : (
                  <span className="muted">Escribe un monto para ver tu ganancia</span>
                )}
              </div>
            </div>
            <p className="simulador-nota">
              {todasConCasa
                ? "Cuota calculada con lo que pagan las casas. La de tu casa puede variar un poco."
                : "Cuota estimada: donde la casa no publica cuota se usa la justa según la probabilidad. Tu casa pagará algo menos."}
            </p>

            <button type="button" className="news-toggle" onClick={() => setVerAnalisis((v) => !v)} aria-expanded={verAnalisis}>
              <span>
                Análisis del boleto
                {a.alertas.length > 0 && <span className="alert-text"> · {a.alertas.length} alerta(s)</span>}
              </span>
              <span aria-hidden="true">{verAnalisis ? "▴" : "▾"}</span>
            </button>
            {verAnalisis && <Puntos fuertes={a.fuertes} alertas={a.alertas} balance={a.balance} />}
          </>
        )}

        <button type="button" className="link-btn" onClick={() => setVerManual((v) => !v)} aria-expanded={verManual}>
          {verManual ? "− Ocultar selección manual" : "+ Agregar algo que no está aquí (con su momio)"}
        </button>
        {verManual && (
          <form className="boleto-manual" onSubmit={agregarManual}>
            <label className="visually-hidden" htmlFor="manual-texto">Selección manual</label>
            <input
              id="manual-texto"
              placeholder="Ej. Bayern más de 8.5 corners"
              value={manual.texto}
              maxLength={80}
              onChange={(e) => setManual((m) => ({ ...m, texto: e.target.value }))}
            />
            <label className="visually-hidden" htmlFor="manual-cuota">Momio decimal</label>
            <input
              id="manual-cuota"
              className="input-corto"
              inputMode="decimal"
              placeholder="Momio 1.45"
              value={manual.cuota}
              onChange={(e) => setManual((m) => ({ ...m, cuota: e.target.value }))}
            />
            <button type="submit" className="btn btn-secondary">Agregar</button>
          </form>
        )}

        {piernas.length > 0 && (
          <button type="button" className="link-btn boleto-vaciar" onClick={vaciar}>
            Vaciar simulador
          </button>
        )}
      </aside>
    </>
  );
}
