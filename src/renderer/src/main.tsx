import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Capturar errores no manejados del renderer y enviarlos al log del main process
window.addEventListener('unhandledrejection', (event) => {
  window.electronAPI?.logError(
    `Unhandled Promise Rejection: ${event.reason}`,
    event.reason?.stack
  )
})

window.addEventListener('error', (event) => {
  window.electronAPI?.logError(event.message, event.error?.stack)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
