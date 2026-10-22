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
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')

      // Si hay una versión nueva esperando, se activa y la página se recarga una sola vez:
      // sin esto un service worker viejo puede quedarse sirviendo una copia que ya no sirve.
      let recargando = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargando) return
        recargando = true
        window.location.reload()
      })
      const activar = (sw) => sw?.state === 'installed' && navigator.serviceWorker.controller && sw.postMessage('actualizar')
      activar(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing
        nuevo?.addEventListener('statechange', () => activar(nuevo))
      })
    } catch {
      // sin service worker la app sigue funcionando, solo pierde el arranque offline
    }
  })
}
