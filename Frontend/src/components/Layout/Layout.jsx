import { useState, useEffect, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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

const MOBILE_BREAKPOINT = 768

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= MOBILE_BREAKPOINT)
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT)
  const connected = useWSConnected()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  // Track viewport size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(mobile)
      // Auto-close sidebar when resizing to mobile
      if (mobile) setSidebarOpen(false)
      // Auto-open when going to desktop
      if (!mobile) setSidebarOpen(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-close sidebar on route change (mobile only)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [location.pathname, isMobile])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

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
            <div style={{ flex: 1, minWidth: 0 }}>
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

  // Sidebar styles
  const sidebarStyle = isMobile
    ? {
        // Mobile: fixed overlay
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 260,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.3)' : 'none',
      }
    : {
        // Desktop: inline sidebar
        width: sidebarOpen ? 228 : 56,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.25s ease',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }

  // Whether labels should show in sidebar
  const showLabels = isMobile ? true : sidebarOpen

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* ── Mobile backdrop ── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1050,
            backdropFilter: 'blur(2px)',
            transition: 'opacity 0.25s',
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <div style={{ padding: '1rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(59,130,246,0.3)' }}>
            <Map size={17} color="white" />
          </div>
          {showLabels && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>GeoTrack</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>Vehicle Tracking</div>
            </div>
          )}
          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, marginLeft: 'auto', flexShrink: 0 }}
            >
              <X size={18} />
            </button>
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
              title={!showLabels ? label : undefined}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {showLabels && <span>{label}</span>}
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
          {showLabels && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {connected ? 'Live Connected' : 'Reconnecting…'}
            </span>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header className="app-header">
          <button
            onClick={toggleSidebar}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}
          >
            <Menu size={18} />
          </button>

          <div style={{ flex: 1 }} />

          {/* Live chip */}
          <div className="header-chip" style={{
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
            className="theme-toggle-btn"
            title="Toggle dark/light mode"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </header>

        {/* Page content */}
        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  )
}
