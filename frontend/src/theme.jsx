import { useEffect, useState } from "react";
import { ThemeContext } from "./themeContext";

function getInitialDark() {
  try {
    const stored = localStorage.getItem("analista-theme");
    if (stored) return stored === "dark";
  } catch {
    // localStorage bloqueado/inaccesible (modo privado, políticas del navegador, etc.)
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function ThemeProvider({ children }) {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("analista-theme", dark ? "dark" : "light");
    } catch {
      // Si no se puede persistir la preferencia, la app sigue funcionando
      // solo que no recordará el tema entre visitas.
    }
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}
