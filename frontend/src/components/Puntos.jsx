// Bloque "Puntos fuertes / Alertas / Datos / Balance", usado por partido y por boleto.
export default function Puntos({ fuertes = [], alertas = [], datos = [], balance = [] }) {
  const secciones = [
    ["fuertes", "Puntos fuertes", fuertes],
    ["alertas", "Alertas / mayor riesgo", alertas],
    ["datos", "Datos del partido", datos],
    ["balance", "Balance", balance],
  ].filter(([, , items]) => items.length);

  return (
    <div className="puntos">
      {secciones.map(([clase, titulo, items]) => (
        <div key={clase} className={`puntos-bloque ${clase}`}>
          <h3>{titulo}</h3>
          <ul>
            {items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
