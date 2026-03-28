import { useEffect, useState } from 'react'
import { getGeofences, getVehicles, getAlerts, getViolations } from '../../services/api'
import { Hexagon, Truck, Bell, AlertTriangle, TrendingUp, Activity, RefreshCw } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({ geofences: 0, vehicles: 0, alerts: 0, violations: 0 })
  const [recentViolations, setRecentViolations] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [gf, vh, al, vi] = await Promise.all([
        getGeofences(), getVehicles(), getAlerts(), getViolations({ limit: 8 })
      ])
      setStats({
        geofences: gf.data.geofences?.length || 0,
        vehicles: vh.data.vehicles?.length || 0,
        alerts: al.data.alerts?.length || 0,
        violations: vi.data.total_count || 0,
      })
      setRecentViolations(vi.data.violations || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const statCards = [
    { label: 'Total Geofences', value: stats.geofences, icon: Hexagon, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    { label: 'Registered Vehicles', value: stats.vehicles, icon: Truck, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    { label: 'Alert Rules', value: stats.alerts, icon: Bell, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Total Violations', value: stats.violations, icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  ]

  const eventBadge = (type) => (
    <span style={{
      padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
      background: type === 'entry' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
      color: type === 'entry' ? '#f87171' : '#4ade80'
    }}>
      {type === 'entry' ? '▶ Entry' : '◀ Exit'}
    </span>
  )

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time overview of your geofencing system</p>
        </div>
        <button className="btn btn-secondary" onClick={load} title="Refresh data">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 8, fontWeight: 500 }}>{label}</p>
                <p style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? <span className="spinner" /> : value}
                </p>
              </div>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={22} color={color} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#4ade80' }}>
              <TrendingUp size={11} />
              <span>Active</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Violations */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <Activity size={17} color="#f59e0b" />
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Activity</h2>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {recentViolations.length} recent events
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : recentViolations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            <AlertTriangle size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
            <p style={{ fontSize: '0.875rem' }}>No violations recorded yet</p>
            <p style={{ fontSize: '0.8rem', marginTop: 4, opacity: 0.7 }}>Create geofences, register vehicles, and configure alerts to get started</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Geofence</th>
                  <th>Event</th>
                  <th>Location</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentViolations.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.vehicle_number}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{v.geofence_name}</td>
                    <td>{eventBadge(v.event_type)}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {v.latitude?.toFixed(4)}, {v.longitude?.toFixed(4)}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(v.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
