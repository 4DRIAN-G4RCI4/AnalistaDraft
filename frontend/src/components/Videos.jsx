import { useEffect, useRef, useState } from "react";
import { linkSeguro } from "../format";
import Icono from "./Icono";

const minutos = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : null);

// Una jugada. No carga el video hasta que se toca: son MP4 grandes y la mayoría no se ven.
function Clip({ v }) {
  const [reproduciendo, setReproduciendo] = useState(false);
  const video = useRef(null);

  useEffect(() => {
    if (reproduciendo) video.current?.play().catch(() => {});
  }, [reproduciendo]);

  const dur = minutos(v.duracion);
  return (
    <figure className="clip">
      {reproduciendo ? (
        <video ref={video} className="clip-video" src={v.mp4} controls playsInline preload="metadata" poster={linkSeguro(v.portada) ? v.portada : undefined} />
      ) : (
        <button type="button" className="clip-portada" onClick={() => setReproduciendo(true)} aria-label={`Reproducir: ${v.titulo}`}>
          {linkSeguro(v.portada) && <img src={v.portada} alt="" loading="lazy" />}
          <span className="clip-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
              <path d="M8 5.2v13.6L19 12z" />
            </svg>
          </span>
          {dur && <span className="clip-duracion">{dur}</span>}
        </button>
      )}
      <figcaption className="clip-titulo">{v.titulo}</figcaption>
    </figure>
  );
}

// Jugadas y resumen del partido, de ESPN. Solo aparece si el partido ya tiene video.
export default function Videos({ liga, evento }) {
  const [clips, setClips] = useState(null);

  useEffect(() => {
    if (!liga || !evento) return;
    const ctrl = new AbortController();
    fetch(`/api/videos?liga=${encodeURIComponent(liga)}&evento=${encodeURIComponent(evento)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((v) => setClips(Array.isArray(v) ? v : []))
      .catch(() => setClips([]));
    return () => ctrl.abort();
  }, [liga, evento]);

  if (!clips?.length) return null; // sin video no se muestra nada: no hay hueco vacío

  return (
    <section className="panel videos">
      <div className="panel-head">
        <h2>Jugadas y resumen</h2>
        <span className="panel-sub">video de ESPN</span>
      </div>
      <div className="clips">
        {clips.map((v) => (
          <Clip key={v.id} v={v} />
        ))}
      </div>
      <p className="tab-nota">
        <Icono nombre="enlaceExterno" size={12} /> Los publica ESPN; no todos los partidos tienen.
      </p>
    </section>
  );
}
