import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// No StrictMode — prevents double WebSocket connections in development
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
