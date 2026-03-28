import { useEffect, useState } from 'react'
import { getGeofences, createGeofence, deleteGeofence } from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Hexagon, X, ChevronDown, Trash2 } from 'lucide-react'

const CATEGORIES = ['delivery_zone', 'restricted_zone', 'toll_zone', 'customer_area']

const categoryStyle = {
  delivery_zone:   { color: '#2563eb', darkColor: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  label: 'Delivery Zone' },
  restricted_zone: { color: '#dc2626', darkColor: '#f87171', bg: 'rgba(239,68,68,0.12)',   label: 'Restricted Zone' },
  toll_zone:       { color: '#d97706', darkColor: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  label: 'Toll Zone' },
  customer_area:   { color: '#16a34a', darkColor: '#4ade80', bg: 'rgba(34,197,94,0.12)',   label: 'Customer Area' },
}

function CategoryBadge({ category }) {
  const s = categoryStyle[category] || { color: '#475569', darkColor: '#94a3b8', bg: 'rgba(100,116,139,0.12)', label: category }
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: '0.72rem',
      fontWeight: 600,
      background: s.bg,
      color: `var(--cat-color, ${s.color})`,
    }}
    className={`cat-badge-${category}`}
    >
      {s.label}
    </span>
  )
}

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: 'delivery_zone', coordsText: '' })
  const [expandedId, setExpandedId] = useState(null)

  const load = async (cat) => {
    setLoading(true)
    try {
      const res = await getGeofences(cat)
      setGeofences(res.data.geofences || [])
    } catch { toast.error('Failed to load geofences') }
    setLoading(false)
  }

  useEffect(() => { load(filterCat) }, [filterCat])

  const parseCoords = (text) => {
    try {
      const lines = text.trim().split('\n').filter(Boolean)
      return lines.map(line => {
        const parts = line.split(',').map(s => parseFloat(s.trim()))
        if (parts.length !== 2 || parts.some(isNaN)) throw new Error()
        return parts
      })
    } catch { return null }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    const coords = parseCoords(form.coordsText)
    if (!coords || coords.length < 3) {
      toast.error('Enter at least 3 coordinates (one per line: lat, lng)')
      return
    }
    setSubmitting(true)
    try {
      await createGeofence({ name: form.name, description: form.description, category: form.category, coordinates: [...coords, coords[0]] })
      toast.success('Geofence created!')
      setShowCreate(false)
      setForm({ name: '', description: '', category: 'delivery_zone', coordsText: '' })
      load(filterCat)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create geofence')
    }
    setSubmitting(false)
  }

  const getCatColor = (category) => categoryStyle[category]?.color || '#475569'
  const getCatBg    = (category) => categoryStyle[category]?.bg    || 'rgba(100,116,139,0.12)'
  const getCatLabel = (category) => categoryStyle[category]?.label || category

  const handleDelete = async (e, gf) => {
    e.stopPropagation()
    if (!window.confirm(`Delete geofence "${gf.name}"?\n\nThis will also remove any associated alert rules.`)) return
    try {
      await deleteGeofence(gf.id)
      toast.success(`Deleted: ${gf.name}`)
      load(filterCat)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete geofence')
    }
  }

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Geofences</h1>
          <p className="page-subtitle">Manage virtual boundaries</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Geofence
        </button>
      </div>

      {/* ── Category Filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${filterCat === '' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterCat('')}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`btn ${filterCat === cat ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterCat(cat)}
          >
            {getCatLabel(cat)}
          </button>
        ))}
      </div>

      {/* ── Create Form ── */}
      {showCreate && (
        <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>Create New Geofence</h3>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Downtown Zone" />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Category *</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{getCatLabel(c)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
                <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Coordinates * &nbsp;
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(one per line: latitude, longitude)</span>
                </label>
                <textarea
                  className="input"
                  style={{ height: 110, fontFamily: 'monospace', fontSize: '0.8rem' }}
                  value={form.coordsText}
                  onChange={e => setForm({ ...form, coordsText: e.target.value })}
                  placeholder={'12.9716, 77.5946\n12.9800, 77.5946\n12.9800, 77.6050\n12.9716, 77.6050'}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '0.875rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <span className="spinner" /> : <><Plus size={15} /> Create</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : geofences.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Hexagon size={44} style={{ margin: '0 auto 12px', color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No geofences found</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4, opacity: 0.7 }}>
            {filterCat ? 'Try a different category filter' : 'Create your first geofence using the button above'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {geofences.map((gf) => {
            const color = getCatColor(gf.category)
            const bg    = getCatBg(gf.category)
            const label = getCatLabel(gf.category)
            const expanded = expandedId === gf.id
            return (
              <div
                key={gf.id}
                className="card"
                style={{ cursor: 'pointer', padding: '1rem 1.25rem' }}
                onClick={() => setExpandedId(expanded ? null : gf.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Hexagon size={19} color={color} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{gf.name}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                        {gf.id} &bull; {gf.coordinates?.length} points
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, background: bg, color }}>
                      {label}
                    </span>
                    <span className="badge badge-green">{gf.status}</span>
                    <ChevronDown
                      size={16}
                      color="var(--text-muted)"
                      style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </div>
                </div>

                {expanded && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    {gf.description && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{gf.description}</p>
                    )}
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Created: {new Date(gf.created_at).toLocaleString()}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Coordinates:</p>
                    <div style={{
                      fontFamily: 'monospace', fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-primary)',
                      borderRadius: 6, padding: '0.625rem',
                      maxHeight: 110, overflowY: 'auto',
                      border: '1px solid var(--border)',
                    }}>
                      {gf.coordinates?.map((c, i) => (
                        <div key={i}>[{c[0]?.toFixed(6)}, {c[1]?.toFixed(6)}]</div>
                      ))}
                    </div>
                    <div style={{ marginTop: '0.875rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '5px 14px', fontSize: '0.8rem' }}
                        onClick={(e) => handleDelete(e, gf)}
                      >
                        <Trash2 size={14} /> Delete Geofence
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
