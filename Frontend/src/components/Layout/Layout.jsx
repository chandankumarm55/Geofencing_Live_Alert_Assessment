import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, Hexagon, Truck, Bell, AlertTriangle, Menu, X, Radio, Sun, Moon } from 'lucide-react'
import { useWSListener, useWSConnected } from '../../context/WebSocketContext'
import { useTheme } from '../../context/ThemeContext'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/map',        icon: Map,             label: 'Live Map'   },
  { to: '/geofences',  icon: Hexagon,         label: 'Geofences'  },
  { to: '/vehicles',   icon: Truck,           label: 'Vehicles'   },
  { to: '/alerts',     icon: Bell,            label: 'Alerts'     },
  { to: '/violations', icon: AlertTriangle,   label: 'Violations' },
]

const categoryColors = {
  delivery_zone:   '#2563eb',
  restricted_zone: '#dc2626',
  toll_zone:       '#d97706',
  customer_area:   '#16a34a',
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const connected = useWSConnected()
  const { theme, toggleTheme } = useTheme()

  useWSListener((alert) => {
    const color = categoryColors[alert.geofence?.category] || '#3b82f6'
    const isEntry = alert.event_type === 'entry'

    toast.custom(
      (t) => (
        <div
          className={`alert-toast animate-slide-in ${t.visible ? 'opacity-100' : 'opacity-0'}`}
          style={{ borderLeftColor: color }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={16} style={{ color }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 2, color: 'var(--text-primary)' }}>
                {isEntry ? '🚨 Geofence Entry' : '🚪 Geofence Exit'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{alert.vehicle?.vehicle_number}</strong>{' '}
                {isEntry ? 'entered' : 'exited'}{' '}
                <strong style={{ color }}>{alert.geofence?.geofence_name}</strong>
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                {new Date(alert.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ),
      { id: alert.event_id, duration: 8000 }
    )
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarOpen ? 228 : 56,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.25s ease',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '1rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(59,130,246,0.3)' }}>
            <Map size={17} color="white" />
          </div>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>GeoTrack</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>Vehicle Tracking</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.625rem 0.5rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* WS status */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: connected ? '#22c55e' : '#ef4444',
            boxShadow: connected ? '0 0 6px #22c55e90' : 'none',
            animation: connected ? 'pulseDot 2s infinite' : 'none',
          }} />
          {sidebarOpen && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {connected ? 'Live Connected' : 'Reconnecting…'}
            </span>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          height: 56,
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          gap: '0.75rem',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}
          >
            <Menu size={18} />
          </button>

          <div style={{ flex: 1 }} />

          {/* Live chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${connected ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            <Radio size={12} color={connected ? '#16a34a' : '#dc2626'} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: connected ? '#16a34a' : '#dc2626' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem', fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            title="Toggle dark/light mode"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
