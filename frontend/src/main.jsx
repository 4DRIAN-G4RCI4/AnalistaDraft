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
