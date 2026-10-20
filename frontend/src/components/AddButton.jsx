import Icono from "./Icono";
export default function AddButton({ boleto, sel }) {
  const dentro = boleto.tiene(sel);
  return (
    <button
      type="button"
      className={`add-btn ${dentro ? "on" : ""}`}
      onClick={() => boleto.alternar(sel)}
      aria-label={`${dentro ? "Quitar del" : "Agregar al"} boleto: ${sel.mercado}`}
      aria-pressed={dentro}
    >
      <Icono nombre={dentro ? "check" : "mas"} size={14} />
    </button>
  );
}
