import { useEffect, useState, useCallback } from 'react'
import { getAlerts, configureAlert, deleteAlert, getGeofences, getVehicles } from '../../services/api'
import { useWSListener, useWSConnected } from '../../context/WebSocketContext'
import toast from 'react-hot-toast'
import { Bell, Plus, X, AlertTriangle, Wifi, WifiOff, Hexagon, Truck, Trash2 } from 'lucide-react'

const categoryColors = {
  delivery_zone:   '#2563eb',
  restricted_zone: '#dc2626',
  toll_zone:       '#d97706',
  customer_area:   '#16a34a',
}

function EventBadge({ type }) {
  const isEntry = type === 'entry'
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
      background: isEntry ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
      color:      isEntry ? '#dc2626'              : '#16a34a',
    }}>
      {isEntry ? '▶ ENTRY' : '◀ EXIT'}
    </span>
  )
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([])
  const [geofences, setGeofences] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [liveAlerts, setLiveAlerts] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ geofence_id: '', vehicle_id: '', event_type: 'entry' })
  const connected = useWSConnected()

  useWSListener(useCallback((alert) => {
    setLiveAlerts((prev) => [{ ...alert, receivedAt: new Date() }, ...prev].slice(0, 100))
  }, []))

  const load = async () => {
    setLoading(true)
    try {
      const [al, gf, vh] = await Promise.all([getAlerts(), getGeofences(), getVehicles()])
      setAlerts(al.data.alerts || [])
      setGeofences(gf.data.geofences || [])
      setVehicles(vh.data.vehicles || [])
    } catch { toast.error('Failed to load data') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.geofence_id) { toast.error('Select a geofence'); return }
    setSubmitting(true)
    try {
      const payload = { geofence_id: form.geofence_id, event_type: form.event_type }
      if (form.vehicle_id) payload.vehicle_id = form.vehicle_id
      await configureAlert(payload)
      toast.success('Alert rule configured!')
      setShowCreate(false)
      setForm({ geofence_id: '', vehicle_id: '', event_type: 'entry' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to configure alert')
    }
    setSubmitting(false)
  }

  const handleDeleteAlert = async (al) => {
    if (!window.confirm(`Delete this alert rule for "${al.geofence_name || al.geofence_id}"?`)) return
    try {
      await deleteAlert(al.alert_id)
      toast.success('Alert rule deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete alert')
    }
  }

  const eventTypeBg = (t) => t === 'entry' ? 'rgba(239,68,68,0.1)' : t === 'exit' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)'
  const eventTypeColor = (t) => t === 'entry' ? '#dc2626' : t === 'exit' ? '#16a34a' : '#d97706'

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">Configure rules and monitor real-time events</p>
        </div>
        <div className="page-header-actions">
          {/* Live status chip */}
          <div className="header-chip" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8,
            background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {connected ? <Wifi size={13} color="#16a34a" /> : <WifiOff size={13} color="#dc2626" />}
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: connected ? '#16a34a' : '#dc2626' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Configure Alert
          </button>
        </div>
      </div>

      <div className="responsive-grid-2-main">

        {/* ═══ LEFT: Alert Rules ═══ */}
        <div>
          <p className="section-label">
            <Bell size={13} /> Alert Rules ({alerts.length})
          </p>

          {/* Create form */}
          {showCreate && (
            <div className="card" style={{ marginBottom: '0.75rem', border: '1px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>New Alert Rule</span>
                <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Geofence *</label>
                    <select className="input" value={form.geofence_id} onChange={e => setForm({ ...form, geofence_id: e.target.value })}>
                      <option value="">Select geofence…</option>
                      {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
                      Vehicle <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank = all vehicles)</span>
                    </label>
                    <select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}>
                      <option value="">All vehicles</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Event Type *</label>
                    <select className="input" value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
                      <option value="entry">Entry — when vehicle enters</option>
                      <option value="exit">Exit — when vehicle exits</option>
                      <option value="both">Both — entry and exit</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: '0.875rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={submitting}>
                    {submitting ? <span className="spinner" /> : 'Save Rule'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Alert rules list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : alerts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <Bell size={32} style={{ margin: '0 auto 10px', color: 'var(--border)' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No alert rules configured</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4, opacity: 0.7 }}>
                Create a rule to start receiving real-time alerts
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {alerts.map((al) => (
                <div key={al.alert_id} className="card" style={{ padding: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Bell size={14} color="var(--accent)" />
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                          {al.geofence_name || al.geofence_id}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Truck size={11} />
                          {al.vehicle_number || 'All vehicles'}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: eventTypeBg(al.event_type), color: eventTypeColor(al.event_type) }}>
                        {al.event_type.toUpperCase()}
                      </span>
                      <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>{al.status}</span>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        onClick={() => handleDeleteAlert(al)}
                        title="Delete this rule"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Live Alert Feed ═══ */}
        <div>
          <p className="section-label" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} color="#d97706" /> Live Feed ({liveAlerts.length})
            </span>
            {liveAlerts.length > 0 && (
              <button
                onClick={() => setLiveAlerts([])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'inherit' }}
              >
                Clear
              </button>
            )}
          </p>

          {liveAlerts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                {connected
                  ? <Wifi size={22} color="#16a34a" />
                  : <WifiOff size={22} color="var(--text-muted)" />
                }
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
                {connected ? 'Listening for alerts…' : 'Connecting to alert stream…'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 6 }}>
                Update a vehicle location inside a geofence to trigger an alert
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 540, overflowY: 'auto', paddingRight: 2 }}>
              {liveAlerts.map((al, i) => {
                const color = categoryColors[al.geofence?.category] || 'var(--accent)'
                return (
                  <div key={`${al.event_id}-${i}`} className="card animate-fade-in" style={{ padding: '0.875rem', borderLeft: `3px solid ${color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <EventBadge type={al.event_type} />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {al.receivedAt?.toLocaleTimeString()}
                      </span>
                    </div>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{al.vehicle?.vehicle_number}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 1 }}>{al.vehicle?.driver_name}</p>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Hexagon size={12} color={color} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{al.geofence?.geofence_name}</span>
                    </div>
                    <div style={{ marginTop: 3, fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      📍 {al.location?.latitude?.toFixed(5)}, {al.location?.longitude?.toFixed(5)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
