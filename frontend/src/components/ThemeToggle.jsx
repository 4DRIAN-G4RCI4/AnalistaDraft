import { useTheme } from "../useTheme";
import Icono from "./Icono";

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      className="theme-toggle"
    >
      <Icono nombre={dark ? "sol" : "luna"} size={18} />
    </button>
  );
}
