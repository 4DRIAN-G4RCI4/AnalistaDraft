export default function Disclaimer() {
  return (
    <div className="disclaimer" role="note">
      <span className="warn-icon" aria-hidden="true">
        ⚠
      </span>
      <span>
        <strong>Datos públicos, no certezas.</strong> Todo sale de fuentes públicas y gratuitas (ESPN, Transfermarkt y las
        cuotas que publican las casas de apuestas). Los porcentajes son <strong>probabilidades estimadas</strong> por un modelo
        estadístico: <strong>ninguna apuesta es 100% segura</strong>, y un 85% también falla más o menos 1 de cada 7 veces.
        Esto es información, no asesoría de apuestas. Si apuestas, hazlo solo siendo mayor de edad, con dinero que puedas perder
        y sin perseguir pérdidas.
      </span>
    </div>
  );
}
