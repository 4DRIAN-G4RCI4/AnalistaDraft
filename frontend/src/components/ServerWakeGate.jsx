import { useEffect, useState } from "react";
import { pedir } from "../hooks/useAnalisis";

const LENTO_MS = 3000;

// El backend gratuito de Render se duerme tras 15 min sin tráfico y tarda ~1 min en despertar.
// Mientras tanto se muestra esta pantalla en vez de la app vacía (igual que en Tradia).
export default function ServerWakeGate({ children }) {
  const [listo, setListo] = useState(false);
  const [lento, setLento] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => setLento(true), LENTO_MS);
    pedir("/api/ligas", ctrl.signal, () => setLento(true))
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer);
        if (!ctrl.signal.aborted) setListo(true);
      });
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  if (listo) return children;

  return (
    <div className="server-wake" role="status">
      <div className="server-wake-spinner" aria-hidden="true" />
      <p className="server-wake-title">Cargando AnalistaDraft…</p>
      {lento && (
        <p className="server-wake-desc">
          El servidor estaba en reposo y está despertando. Esto puede tardar hasta un minuto la primera vez.
        </p>
      )}
    </div>
  );
}
