import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { WebSocketProvider } from './context/WebSocketContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout/Layout'
import Dashboard from './components/Dashboard/Dashboard'
import MapPage from './components/Map/MapPage'
import GeofencesPage from './components/Geofences/GeofencesPage'
import VehiclesPage from './components/Vehicles/VehiclesPage'
import AlertsPage from './components/Alerts/AlertsPage'
import ViolationsPage from './components/Violations/ViolationsPage'

export default function App() {
  return (
    <ThemeProvider>
      <WebSocketProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                fontSize: '0.875rem',
              },
              duration: 6000,
            }}
          />
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/geofences" element={<GeofencesPage />} />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/violations" element={<ViolationsPage />} />
            </Routes>
          </Layout>
        </Router>
      </WebSocketProvider>
    </ThemeProvider>
  )
}
