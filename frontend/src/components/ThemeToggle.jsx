import { useTheme } from "../useTheme";

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      className="theme-toggle"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
