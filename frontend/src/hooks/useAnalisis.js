import { useCallback, useEffect, useState } from "react";

// Caché en memoria del navegador: cambiar de liga y volver no vuelve a pedir datos.
// El backend además guarda en disco (ESPN 30 min-2 h, Transfermarkt 24 h).
const TTL = 10 * 60e3;
const cache = new Map();

// Copia en el navegador (localStorage) del último análisis de cada vista: al volver al sitio se muestra
// al instante mientras llega el nuevo, aunque el servidor gratis esté despertando (~1 min).
const GUARDADO = "analista-cache:";
const MAX_GUARDADOS = 4; // ~100-400 KB cada uno; localStorage da ~5 MB
export function leerGuardado(clave) {
  try {
    return JSON.parse(localStorage.getItem(GUARDADO + clave));
  } catch {
    return null;
  }
}
export function guardar(clave, data) {
  try {
    const claves = Object.keys(localStorage).filter((k) => k.startsWith(GUARDADO) && k !== GUARDADO + clave);
    for (const k of claves.slice(0, Math.max(0, claves.length - MAX_GUARDADOS + 1))) localStorage.removeItem(k);
    localStorage.setItem(GUARDADO + clave, JSON.stringify(data));
  } catch {
    // sin espacio o bloqueado: solo se pierde la carga instantánea
  }
}
export const hayGuardado = () => {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith(GUARDADO));
  } catch {
    return false;
  }
};

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
  const [ligas, setLigas] = useState(() => leerGuardado("ligas") ?? {});
  useEffect(() => {
    const ctrl = new AbortController();
    pedir("/api/ligas", ctrl.signal, () => {})
      .then((l) => {
        setLigas(l);
        guardar("ligas", l);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  return ligas;
}

export function useAnalisis(liga, dias) {
  const clave = `${liga}:${dias}`;
  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState({ data: null, loading: true, error: null, despertando: false, actualizando: false });

  useEffect(() => {
    if (!liga) return;
    const c = cache.get(clave);
    if (c && Date.now() - c.t < TTL) {
      setEstado({ data: c.data, loading: false, error: null, despertando: false, actualizando: false });
      return;
    }
    // lo guardado se muestra ya; lo nuevo lo reemplaza al llegar
    const previo = leerGuardado(clave);
    setEstado(previo ? { data: previo, loading: false, error: null, despertando: false, actualizando: true } : (s) => ({ ...s, loading: true, error: null }));
    const ctrl = new AbortController();
    pedir(`/api/analisis?liga=${encodeURIComponent(liga)}&dias=${dias}`, ctrl.signal, () =>
      setEstado((s) => ({ ...s, despertando: true })),
    )
      .then((j) => {
        cache.set(clave, { t: Date.now(), data: j });
        guardar(clave, j);
        setEstado({ data: j, loading: false, error: null, despertando: false, actualizando: false });
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        // si había datos guardados se siguen mostrando; el error solo sale si no hay nada
        setEstado((s) => (s.data ? { ...s, actualizando: false } : { data: null, loading: false, error: e.message, despertando: false, actualizando: false }));
      });
    return () => ctrl.abort();
  }, [liga, dias, clave, version]);

  const refrescar = useCallback(() => {
    cache.delete(clave);
    setVersion((v) => v + 1);
  }, [clave]);

  return { ...estado, refrescar };
}
