import { Component } from "react";
import Icono from "./Icono";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="state state-error panel" role="alert">
          <span className="state-icon">
            <Icono nombre="alerta" size={20} />
          </span>
          <span className="state-title">Algo salió mal</span>
          <span className="state-desc">
            Ocurrió un error inesperado. Recarga la página para continuar.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}