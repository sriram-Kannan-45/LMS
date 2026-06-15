import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Single CSS entry point — Vite will code-split and tree-shake unused styles
import './index.css'
import './premium-enhancements.css'
import './styles/saas-premium.css'

// Route-specific styles are loaded lazily by the components that need them

const RootElement = import.meta.env.DEV ? (
  <React.StrictMode>
    <App />
  </React.StrictMode>
) : (
  <App />
)

ReactDOM.createRoot(document.getElementById('root')).render(RootElement)
