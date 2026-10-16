import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import BrandIcon from "./BrandIcon";

export default function NavBar({ enBoleto = 0, base = "", onBoleto }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""}`} aria-label="Navegación principal">
      <div className="navbar-brand">
        <div className="brand-mark" aria-hidden="true">
          <BrandIcon />
        </div>
        <span className="navbar-title">AnalistaDraft</span>
      </div>

      <div className="navbar-links">
        <a href={`${base}#partidos`}>Partidos</a>
        <a href={`${base}#recomendado`}>Recomendado</a>
        <a href={`${base}#parlays`}>Parlays</a>
        <button type="button" className="nav-boleto" onClick={onBoleto}>
          Simulador{enBoleto ? ` (${enBoleto})` : ""}
        </button>
      </div>

      <div className="navbar-tools">
        <ThemeToggle />
      </div>
    </nav>
  );
}
