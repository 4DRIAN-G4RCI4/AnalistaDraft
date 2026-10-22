import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import BrandIcon from "./BrandIcon";
import Icono from "./Icono";

const VISTAS = [
  ["tablas", "Tablas", "tabla"],
  ["jugadores", "Jugadores", "jugador"],
  ["pasadas", "Pasadas", "reloj"],
  ["aciertos", "Aciertos", "check"],
];

const ANCLAS = [
  ["partidos", "Partidos"],
  ["recomendado", "Recomendado"],
  ["parlays", "Parlays"],
];

export default function NavBar({ enBoleto = 0, base = "", onBoleto, onVista }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // con el menú abierto no se desplaza el fondo, y Escape lo cierra
  useEffect(() => {
    if (!menu) return;
    const alTecla = (e) => e.key === "Escape" && setMenu(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTecla);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", alTecla);
    };
  }, [menu]);

  const irA = (v) => {
    setMenu(false);
    onVista(v);
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""}`} aria-label="Navegación principal">
        <div className="navbar-brand">
          <div className="brand-mark" aria-hidden="true">
            <BrandIcon />
          </div>
          <span className="navbar-title">AnalistaDraft</span>
        </div>

        <div className="navbar-links">
          {ANCLAS.map(([id, texto]) => (
            <a key={id} href={`${base}#${id}`}>
              {texto}
            </a>
          ))}
          {VISTAS.map(([v, texto]) => (
            <a
              key={v}
              href={`?vista=${v}`}
              onClick={(e) => {
                e.preventDefault();
                onVista(v);
              }}
            >
              {texto}
            </a>
          ))}
          <button type="button" className="nav-boleto" onClick={onBoleto}>
            Simulador{enBoleto ? ` (${enBoleto})` : ""}
          </button>
        </div>

        <div className="navbar-tools">
          <ThemeToggle />
          <button
            type="button"
            className="nav-hamburguesa"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
            aria-expanded={menu}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            {enBoleto > 0 && <i className="nav-punto" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {menu && (
        <>
          <div className="menu-fondo" onClick={() => setMenu(false)} aria-hidden="true" />
          <aside className="menu-panel" role="dialog" aria-modal="true" aria-label="Menú">
            <div className="menu-cabecera">
              <span className="menu-titulo">Menú</span>
              <button type="button" className="menu-cerrar" onClick={() => setMenu(false)} aria-label="Cerrar menú">
                <Icono nombre="cruz" size={18} />
              </button>
            </div>

            <nav className="menu-lista" aria-label="Secciones">
              {VISTAS.map(([v, texto, icono]) => (
                <button key={v} type="button" className="menu-item" onClick={() => irA(v)}>
                  <Icono nombre={icono} size={18} />
                  <span>{texto}</span>
                  <Icono nombre="flechaDer" size={15} className="menu-flecha" />
                </button>
              ))}
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenu(false);
                  onBoleto();
                }}
              >
                <Icono nombre="calculadora" size={18} />
                <span>Simulador{enBoleto ? ` (${enBoleto})` : ""}</span>
                <Icono nombre="flechaDer" size={15} className="menu-flecha" />
              </button>
            </nav>

            <div className="menu-separador" />

            <nav className="menu-lista menu-anclas" aria-label="En esta página">
              {ANCLAS.map(([id, texto]) => (
                <a key={id} className="menu-item" href={`${base}#${id}`} onClick={() => setMenu(false)}>
                  <span>{texto}</span>
                </a>
              ))}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
