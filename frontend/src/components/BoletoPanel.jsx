import { useEffect, useRef, useState } from "react";
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
  const [momioCasa, setMomioCasa] = useState(""); // el que te da tu casa (p. ej. Draftea); manda sobre el estimado
  const [manual, setManual] = useState({ texto: "", cuota: "" });
  const [verManual, setVerManual] = useState(false);
  const [verAnalisis, setVerAnalisis] = useState(false);
  const { piernas, quitar, vaciar, agregar } = boleto;

  const deTuCasa = numero(momioCasa) > 1 ? numero(momioCasa) : null;
  const cuota = deTuCasa ?? piernas.reduce((c, x) => c * (x.cuota ?? 1 / x.prob), 1);
  const todasConCasa = piernas.length > 0 && piernas.every((x) => x.cuota);
  const a = analizarBoleto(piernas, { monto: numero(monto) ?? 0, momio: deTuCasa });
  const apuesta = numero(monto);

  const panel = useRef(null);
  const cerrar = useRef(null);
  const fab = useRef(null);

  // Diálogo accesible: el foco entra al abrir, no se escapa con Tab y vuelve a donde estaba al cerrar.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement;
    requestAnimationFrame(() => cerrar.current?.focus());
    const alTeclear = (e) => {
      if (e.key === "Escape") return setAbierto(false);
      if (e.key !== "Tab") return;
      const enfocables = panel.current.querySelectorAll("button, input, a[href]");
      const primero = enfocables[0], ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      // el botón flotante se vuelve a montar al cerrar: se le regresa el foco ya montado
      requestAnimationFrame(() => (fab.current ?? (previo?.isConnected ? previo : null))?.focus());
    };
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
        <button ref={fab} type="button" className="boleto-fab" onClick={() => setAbierto(true)}>
          <span aria-hidden="true">🧮</span> Simulador ({piernas.length}) · <b>{pct(a.prob)}</b> · cuota {cuota.toFixed(2)}
        </button>
      )}
      {abierto && <div className="drawer-overlay" onClick={() => setAbierto(false)} aria-hidden="true" />}

      <aside ref={panel} className={`boleto-drawer ${abierto ? "open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="boleto-titulo" aria-hidden={!abierto} inert={!abierto}>
        <div className="drawer-head">
          <h2 id="boleto-titulo">Simulador de boleto ({piernas.length})</h2>
          <button ref={cerrar} type="button" className="leg-remove" onClick={() => setAbierto(false)} aria-label="Cerrar simulador">
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
            <label className="simulador-monto">
              <span className="market-overview-label">Momio que te da tu casa (opcional)</span>
              <input inputMode="decimal" placeholder={`Ej. 2.41 · estimado ${piernas.reduce((c, x) => c * (x.cuota ?? 1 / x.prob), 1).toFixed(2)}`} value={momioCasa} onChange={(e) => setMomioCasa(e.target.value)} />
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
              {deTuCasa
                ? `Con el momio de tu casa. Según nuestra probabilidad (${pct(a.prob)}), lo justo sería ${a.cuotaJusta.toFixed(2)}: ${deTuCasa >= a.cuotaJusta ? "tu casa paga más que eso." : "tu casa paga menos que eso."}`
                : todasConCasa
                  ? "Cuota calculada con lo que pagan las casas. La de tu casa puede variar un poco."
                  : "Cuota estimada. Si son varias del mismo partido (SGP), tu casa calcula su propio momio: escríbelo arriba para ver tu ganancia real."}
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
