// Iconos trazados en un solo lenguaje: rejilla de 24, grosor 2, extremos redondeados y currentColor,
// para que acompañen al texto en cualquier tamaño y color igual que los símbolos del sistema.
const TRAZOS = {
  check: <path d="M4.5 12.5l5 5 10-11" />,
  cruz: <path d="M6 6l12 12M18 6L6 18" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 3.8L21 19.5H3z" />
      <path d="M12 9.8v4.4M12 17.2v.1" />
    </>
  ),
  prohibido: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.2 6.2l11.6 11.6" />
    </>
  ),
  trofeo: (
    <>
      <path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 5.5H5a2.5 2.5 0 0 0 2.5 2.5M16.5 5.5H19a2.5 2.5 0 0 1-2.5 2.5" />
      <path d="M12 13v3.5M8.8 20h6.4" />
    </>
  ),
  balon: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.6l3.3 2.4-1.3 4h-4l-1.3-4z" />
    </>
  ),
  tarjeta: <rect x="7.5" y="3.8" width="9" height="16.4" rx="1.6" />,
  sol: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4" />
    </>
  ),
  luna: <path d="M20 13.4A8.5 8.5 0 0 1 10.6 4a8.5 8.5 0 1 0 9.4 9.4z" />,
  calculadora: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2.2" />
      <path d="M8 7.5h8M8.5 12h.1M12 12h.1M15.5 12h.1M8.5 16h.1M12 16h.1M15.5 16h.1" />
    </>
  ),
  mas: <path d="M12 5.5v13M5.5 12h13" />,
  flechaIzq: <path d="M11 5.5L4.5 12l6.5 6.5M4.5 12h15" />,
  flechaDer: <path d="M13 5.5l6.5 6.5-6.5 6.5M19.5 12h-15" />,
  flechaArriba: <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />,
  flechaAbajo: <path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" />,
  enlaceExterno: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5L11 13" />
      <path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
    </>
  ),
  guion: <path d="M5.5 12h13" />,
  tabla: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9 9.5v10" />
    </>
  ),
  jugador: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
};

export default function Icono({ nombre, size = 16, className = "", titulo = null }) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return null;
  return (
    <svg
      className={`icono ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={titulo ? "img" : undefined}
      aria-label={titulo ?? undefined}
      aria-hidden={titulo ? undefined : "true"}
    >
      {titulo && <title>{titulo}</title>}
      {trazo}
    </svg>
  );
}
