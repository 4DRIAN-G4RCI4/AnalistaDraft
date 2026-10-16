import { useEffect, useState } from "react";

const CLAVE = "analista-boleto";

function cargar() {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE));
    return Array.isArray(b) ? b : [];
  } catch {
    return [];
  }
}

// Boleto del usuario, guardado en este navegador.
export function useBoleto() {
  const [piernas, setPiernas] = useState(cargar);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(piernas));
    } catch {
      // sin persistencia: el boleto vive solo mientras la pestaña esté abierta
    }
  }, [piernas]);

  const id = (x) => `${x.partidoId ?? x.partido}|${x.mercado}`;
  const tiene = (x) => piernas.some((y) => id(y) === id(x));
  const agregar = (...nuevas) => setPiernas((ps) => [...ps, ...nuevas.filter((x) => !ps.some((y) => id(y) === id(x)))]);
  const quitar = (x) => setPiernas((ps) => ps.filter((y) => id(y) !== id(x)));
  const alternar = (x) => (tiene(x) ? quitar(x) : agregar(x));
  const vaciar = () => setPiernas([]);

  return { piernas, tiene, agregar, quitar, alternar, vaciar };
}
