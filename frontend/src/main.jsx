import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ThemeProvider from './theme.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ServerWakeGate from './components/ServerWakeGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <ServerWakeGate>
          <App />
        </ServerWakeGate>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)

// Instalable y con arranque instantáneo aunque el servidor gratis esté dormido.
// En desarrollo no se registra: serviría archivos viejos mientras editas.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sin service worker la app sigue funcionando, solo pierde el arranque offline
    })
  })
}
