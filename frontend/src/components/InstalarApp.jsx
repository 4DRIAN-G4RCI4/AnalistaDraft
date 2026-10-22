import { useEffect, useState } from "react";
import Icono from "./Icono";

const OCULTO = "analista-instalar-oculto";
const ESPERA_TRAS_CERRAR = 30 * 24 * 60 * 60e3; // si lo cierran, no insistir en un mes

const yaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

function silenciado() {
  try {
    const t = Number(localStorage.getItem(OCULTO));
    return Boolean(t) && Date.now() - t < ESPERA_TRAS_CERRAR;
  } catch {
    return false;
  }
}

// Aviso para añadir la app a la pantalla de inicio. Solo en teléfono, solo si no está instalada,
// y si lo cierran no vuelve en un mes: un banner que insiste molesta más de lo que ayuda.
export default function InstalarApp() {
  const [evento, setEvento] = useState(null); // el que da Chrome para instalar en un toque
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (yaInstalada() || silenciado() || !window.matchMedia("(max-width: 1024px)").matches) return;

    // Chrome y Edge: el navegador avisa cuando la app cumple los requisitos
    const alPoder = (e) => {
      e.preventDefault(); // sin esto el navegador muestra su propio aviso
      setEvento(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", alPoder);

    // iOS no tiene esa API: se instala a mano desde Compartir, así que se explica cómo
    const t = esIOS() ? setTimeout(() => setVisible(true), 3000) : null;

    const alInstalar = () => setVisible(false);
    window.addEventListener("appinstalled", alInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoder);
      window.removeEventListener("appinstalled", alInstalar);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!visible) return null;

  const cerrar = () => {
    setVisible(false);
    try {
      localStorage.setItem(OCULTO, String(Date.now()));
    } catch {
      // sin localStorage el aviso volverá a salir; no es grave
    }
  };

  const instalar = async () => {
    if (!evento) return;
    evento.prompt();
    await evento.userChoice;
    setVisible(false);
  };

  return (
    <div className="instalar-app" role="region" aria-label="Instalar la aplicación">
      <span className="instalar-icono" aria-hidden="true">
        <img src="/icono-192.png" alt="" width="34" height="34" />
      </span>
      <div className="instalar-texto">
        <b>Instala AnalistaDraft</b>
        <span>
          {evento
            ? "Ábrela desde tu pantalla de inicio y carga al instante."
            : "Toca Compartir y luego “Añadir a pantalla de inicio”."}
        </span>
      </div>
      {evento && (
        <button type="button" className="btn instalar-btn" onClick={instalar}>
          Instalar
        </button>
      )}
      <button type="button" className="instalar-cerrar" onClick={cerrar} aria-label="Ocultar este aviso">
        <Icono nombre="cruz" size={16} />
      </button>
    </div>
  );
}
