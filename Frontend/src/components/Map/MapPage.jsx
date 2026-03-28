import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { getGeofences, getVehicles, updateVehicleLocation } from '../../services/api'
import toast from 'react-hot-toast'
import { Truck, Hexagon, CheckCircle, X } from 'lucide-react'

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const categoryColors = {
  delivery_zone: '#3b82f6',
  restricted_zone: '#ef4444',
  toll_zone: '#f59e0b',
  customer_area: '#22c55e',
}

// Captures every map click when active — geofences are made non-interactive so
// clicks inside polygon areas reach this handler too
function MapClickHandler({ active, onMapClick }) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng)
    },
  })
  return null
}

export default function MapPage() {
  const [geofences, setGeofences] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [drawMode, setDrawMode] = useState(false)
  const [drawPoints, setDrawPoints] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [locationMode, setLocationMode] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', category: 'delivery_zone' })
  const [loading, setLoading] = useState(false)

  const anyModeActive = drawMode || locationMode

  const load = useCallback(async () => {
    try {
      const [gf, vh] = await Promise.all([getGeofences(), getVehicles()])
      setGeofences(gf.data.geofences || [])
      setVehicles(vh.data.vehicles || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleMapClick = (latlng) => {
    if (locationMode && selectedVehicle) {
      handleUpdateLocation(selectedVehicle, latlng.lat, latlng.lng)
      return
    }
    if (drawMode) {
      setDrawPoints((pts) => [...pts, [latlng.lat, latlng.lng]])
    }
  }

  const handleUpdateLocation = async (vehicle, lat, lng) => {
    try {
      const res = await updateVehicleLocation({
        vehicle_id: vehicle.id,
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString(),
      })
      const gfs = res.data.current_geofences || []
      if (gfs.length > 0) {
        toast.success(`${vehicle.vehicle_number} is inside: ${gfs.map(g => g.geofence_name).join(', ')}`)
      } else {
        toast.success(`Location updated for ${vehicle.vehicle_number}`)
      }
      setLocationMode(false)
      setSelectedVehicle(null)
      load()
    } catch {
      toast.error('Failed to update location')
    }
  }

  const handleSubmitGeofence = async () => {
    if (drawPoints.length < 3) { toast.error('Draw at least 3 points'); return }
    if (!formData.name) { toast.error('Enter a geofence name'); return }
    setLoading(true)
    const coords = [...drawPoints, drawPoints[0]]
    try {
      const { createGeofence } = await import('../../services/api')
      await createGeofence({ ...formData, coordinates: coords })
      toast.success('Geofence created!')
      setDrawMode(false)
      setDrawPoints([])
      setShowForm(false)
      setFormData({ name: '', description: '', category: 'delivery_zone' })
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create geofence')
    }
    setLoading(false)
  }

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 className="page-title">Live Map</h1>
          <p className="page-subtitle">Interactive geofence and vehicle tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!drawMode ? (
            <button className="btn btn-primary" onClick={() => { setDrawMode(true); setLocationMode(false); setDrawPoints([]) }}>
              <Hexagon size={16} /> Draw Geofence
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => { setDrawMode(false); setDrawPoints([]) }}>
                <X size={16} /> Cancel
              </button>
              {drawPoints.length >= 3 && (
                <button className="btn btn-success" onClick={() => setShowForm(true)}>
                  <CheckCircle size={16} /> Finish ({drawPoints.length} pts)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>

        {/* Mode banners */}
        {drawMode && (
          <div className="draw-mode-banner" style={{ background: 'rgba(59,130,246,0.95)', color: 'white' }}>
            ✏️ Click anywhere on the map to add polygon points — {drawPoints.length} points added
          </div>
        )}
        {locationMode && (
          <div className="draw-mode-banner" style={{ background: 'rgba(34,197,94,0.95)', color: 'white' }}>
            📍 Click anywhere (including inside geofences) to place {selectedVehicle?.vehicle_number}
          </div>
        )}

        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: '100%', width: '100%', cursor: anyModeActive ? 'crosshair' : undefined }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Map click capture — must be inside MapContainer */}
          <MapClickHandler active={anyModeActive} onMapClick={handleMapClick} />

          {/* ── Geofences ──
              When anyModeActive: interactive=false so polygon does NOT
              consume the click — it falls through to MapClickHandler */}
          {geofences.map((gf) => (
            <Polygon
              key={gf.id}
              positions={gf.coordinates.map(([lat, lng]) => [lat, lng])}
              pathOptions={{
                color: categoryColors[gf.category] || '#3b82f6',
                fillOpacity: anyModeActive ? 0.06 : 0.15,
                weight: anyModeActive ? 1.5 : 2,
                interactive: !anyModeActive,   // KEY FIX: pass clicks through in active modes
              }}
            >
              {/* Only render Popup when not in an active mode */}
              {!anyModeActive && (
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong>{gf.name}</strong><br />
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {gf.category?.replace(/_/g, ' ')}
                    </span>
                    {gf.description && (
                      <><br /><span style={{ fontSize: 12 }}>{gf.description}</span></>
                    )}
                  </div>
                </Popup>
              )}
            </Polygon>
          ))}

          {/* ── Vehicle markers ──
              Also non-interactive in active modes */}
          {vehicles.filter(v => v.current_location).map((v) => (
            <Marker
              key={v.id}
              position={[v.current_location.latitude, v.current_location.longitude]}
              interactive={!anyModeActive}
            >
              {!anyModeActive && (
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong>{v.vehicle_number}</strong><br />
                    <span style={{ fontSize: 12 }}>Driver: {v.driver_name}</span><br />
                    <span style={{ fontSize: 12 }}>Type: {v.vehicle_type}</span><br />
                    <button
                      onClick={() => { setSelectedVehicle(v); setLocationMode(true); setDrawMode(false) }}
                      style={{ marginTop: 6, padding: '4px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                    >
                      Update Location
                    </button>
                  </div>
                </Popup>
              )}
            </Marker>
          ))}

          {/* Draw preview polygon */}
          {drawPoints.length > 1 && (
            <Polygon
              positions={[...drawPoints, drawPoints[0]]}
              pathOptions={{ color: '#f59e0b', fillOpacity: 0.08, dashArray: '6 4', weight: 2, interactive: false }}
            />
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(categoryColors).map(([cat, color]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: color, opacity: 0.8 }} />
            {cat.replace(/_/g, ' ')}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Truck size={12} /> Vehicle
        </div>
        {locationMode && (
          <button
            className="btn btn-danger"
            style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '0.78rem' }}
            onClick={() => { setLocationMode(false); setSelectedVehicle(null) }}
          >
            <X size={13} /> Cancel Location Update
          </button>
        )}
      </div>

      {/* Geofence creation modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 400, maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Create Geofence</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name *</label>
                <input className="input" placeholder="e.g. Downtown Zone" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
                <input className="input" placeholder="Optional" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Category *</label>
                <select className="input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  <option value="delivery_zone">Delivery Zone</option>
                  <option value="restricted_zone">Restricted Zone</option>
                  <option value="toll_zone">Toll Zone</option>
                  <option value="customer_area">Customer Area</option>
                </select>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {drawPoints.length} polygon points defined
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmitGeofence} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Create Geofence'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
