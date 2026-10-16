import { useCallback, useEffect, useState } from "react";

// Caché en memoria del navegador: cambiar de liga y volver no vuelve a pedir datos.
// El backend además guarda en disco (ESPN 30 min-2 h, Transfermarkt 24 h).
const TTL = 10 * 60e3;
const cache = new Map();

// En producción el backend (Render, plan gratis) se duerme sin visitas y tarda ~1 min en despertar:
// mientras tanto el proxy responde 502/503/504, así que se reintenta en vez de mostrar error.
const DESPIERTA = [502, 503, 504];
const REINTENTOS = 8;
const ESPERA = 8000;

export async function pedir(url, signal, alEsperar) {
  for (let intento = 0; ; intento++) {
    const r = await fetch(url, { signal });
    if (DESPIERTA.includes(r.status) && intento < REINTENTOS) {
      alEsperar();
      await new Promise((ok) => setTimeout(ok, ESPERA));
      continue;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }
}

export function useLigas() {
  const [ligas, setLigas] = useState({});
  useEffect(() => {
    const ctrl = new AbortController();
    pedir("/api/ligas", ctrl.signal, () => {})
      .then(setLigas)
      .catch(() => setLigas({}));
    return () => ctrl.abort();
  }, []);
  return ligas;
}

export function useAnalisis(liga, dias) {
  const clave = `${liga}:${dias}`;
  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState({ data: null, loading: true, error: null, despertando: false });

  useEffect(() => {
    if (!liga) return;
    const c = cache.get(clave);
    if (c && Date.now() - c.t < TTL) {
      setEstado({ data: c.data, loading: false, error: null, despertando: false });
      return;
    }
    const ctrl = new AbortController();
    setEstado((s) => ({ ...s, loading: true, error: null }));
    pedir(`/api/analisis?liga=${encodeURIComponent(liga)}&dias=${dias}`, ctrl.signal, () =>
      setEstado((s) => ({ ...s, despertando: true })),
    )
      .then((j) => {
        cache.set(clave, { t: Date.now(), data: j });
        setEstado({ data: j, loading: false, error: null, despertando: false });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setEstado({ data: null, loading: false, error: e.message, despertando: false });
      });
    return () => ctrl.abort();
  }, [liga, dias, clave, version]);

  const refrescar = useCallback(() => {
    cache.delete(clave);
    setVersion((v) => v + 1);
  }, [clave]);

  return { ...estado, refrescar };
}
