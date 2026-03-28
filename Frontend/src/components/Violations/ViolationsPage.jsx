import { useEffect, useState } from 'react'
import { getViolations, getVehicles, getGeofences } from '../../services/api'
import toast from 'react-hot-toast'
import { AlertTriangle, RefreshCw, Filter, X } from 'lucide-react'

export default function ViolationsPage() {
  const [violations, setViolations] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [geofences, setGeofences] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ vehicle_id: '', geofence_id: '', start_date: '', end_date: '', limit: 50 })

  const load = async (f = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (f.vehicle_id)  params.vehicle_id  = f.vehicle_id
      if (f.geofence_id) params.geofence_id = f.geofence_id
      if (f.start_date)  params.start_date  = new Date(f.start_date).toISOString()
      if (f.end_date)    params.end_date    = new Date(f.end_date).toISOString()
      if (f.limit)       params.limit       = f.limit

      const res = await getViolations(params)
      setViolations(res.data.violations || [])
      setTotalCount(res.data.total_count || 0)
    } catch { toast.error('Failed to load violations') }
    setLoading(false)
  }

  const loadDropdowns = async () => {
    try {
      const [vh, gf] = await Promise.all([getVehicles(), getGeofences()])
      setVehicles(vh.data.vehicles || [])
      setGeofences(gf.data.geofences || [])
    } catch {}
  }

  useEffect(() => { load(); loadDropdowns() }, [])

  const handleFilter = (e) => { e.preventDefault(); load(filters) }

  const handleReset = () => {
    const reset = { vehicle_id: '', geofence_id: '', start_date: '', end_date: '', limit: 50 }
    setFilters(reset)
    load(reset)
  }

  const EventBadge = ({ type }) => (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
      background: type === 'entry' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
      color:      type === 'entry' ? '#dc2626'              : '#16a34a',
    }}>
      {type === 'entry' ? '▶ Entry' : '◀ Exit'}
    </span>
  )

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Violation History</h1>
          <p className="page-subtitle">Historical geofence entry/exit events &mdash; {totalCount} total</p>
        </div>
        <button className="btn btn-secondary" onClick={() => load()} title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── Filters ── */}
      <form onSubmit={handleFilter} className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.875rem' }}>
          <Filter size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filters</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Vehicle</label>
            <select className="input" value={filters.vehicle_id} onChange={e => setFilters({ ...filters, vehicle_id: e.target.value })}>
              <option value="">All vehicles</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Geofence</label>
            <select className="input" value={filters.geofence_id} onChange={e => setFilters({ ...filters, geofence_id: e.target.value })}>
              <option value="">All geofences</option>
              {geofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Start Date</label>
            <input className="input" type="datetime-local" value={filters.start_date} onChange={e => setFilters({ ...filters, start_date: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>End Date</label>
            <input className="input" type="datetime-local" value={filters.end_date} onChange={e => setFilters({ ...filters, end_date: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Limit (max 500)</label>
            <select className="input" value={filters.limit} onChange={e => setFilters({ ...filters, limit: parseInt(e.target.value) })}>
              {[25, 50, 100, 250, 500].map(n => <option key={n} value={n}>{n} records</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: '0.875rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            <X size={14} /> Reset
          </button>
          <button type="submit" className="btn btn-primary">
            <Filter size={14} /> Apply Filters
          </button>
        </div>
      </form>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : violations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={44} style={{ margin: '0 auto 12px', color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No violations found</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4, opacity: 0.7 }}>
            Try adjusting your filters or trigger some geofence events first
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vehicle</th>
                <th>Geofence</th>
                <th>Event</th>
                <th>Location</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, i) => (
                <tr key={v.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.vehicle_number}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{v.geofence_name}</td>
                  <td><EventBadge type={v.event_type} /></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {v.latitude?.toFixed(5)}, {v.longitude?.toFixed(5)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(v.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {violations.length} of {totalCount} records
          </div>
        </div>
      )}
    </div>
  )
}
