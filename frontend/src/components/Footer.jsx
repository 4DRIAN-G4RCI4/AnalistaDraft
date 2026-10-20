import BrandIcon from "./BrandIcon";
import Icono from "./Icono";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col footer-col-brand">
          <div className="footer-brand">
            <div className="brand-mark" aria-hidden="true">
              <BrandIcon size={18} />
            </div>
            <span className="footer-brand-name">AnalistaDraft</span>
          </div>
          <p className="footer-brand-desc">
            Análisis de partidos de fútbol: tabla, valor de plantilla, noticias y momios, con un
            modelo estadístico para armar parlays informados.
          </p>
        </div>

        <div className="footer-col">
          <h3>Navegación</h3>
          <a href="/#partidos">Partidos</a>
          <a href="/#recomendado">Recomendado</a>
          <a href="/#parlays">Parlays</a>
        </div>

        <div className="footer-col">
          <h3>Fuentes</h3>
          <p className="footer-legal-text">
            Datos públicos y gratuitos: ESPN (partidos, estadísticas, noticias, momios DraftKings),
            transfermarkt-datasets (plantillas) y cuotas de las casas. Las probabilidades son
            estimaciones: nada es 100% seguro.
          </p>
        </div>

        <div className="footer-col">
          <h3>Desarrollado por</h3>
          <a className="footer-tecnopriv-link" href="https://tecnopriv.online" target="_blank" rel="noopener noreferrer">
            TecnoPriv <Icono nombre="enlaceExterno" size={13} />
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} AnalistaDraft</span>
      </div>
    </footer>
  );
}
