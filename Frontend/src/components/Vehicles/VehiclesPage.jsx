import { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { getVehicles, createVehicle, updateVehicleLocation, getGeofences, deleteVehicle } from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Truck, MapPin, X, RefreshCw, Navigation, Trash2 } from 'lucide-react'

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom vehicle icon (blue pin)
const vehicleIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#3b82f6;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

// Selected vehicle icon (orange pin)
const selectedIcon = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:#f59e0b;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 10px rgba(245,158,11,0.5)"></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
})

const categoryColors = {
  delivery_zone: '#3b82f6',
  restricted_zone: '#ef4444',
  toll_zone: '#f59e0b',
  customer_area: '#22c55e',
}

const VEHICLE_TYPES = ['truck', 'car', 'van', 'motorcycle', 'bus']

// Handles map clicks for location picking
function LocationPicker({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (active) onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([])
  const [geofences, setGeofences] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [showLocationPanel, setShowLocationPanel] = useState(false)
  const [pickedLat, setPickedLat] = useState(null)
  const [pickedLng, setPickedLng] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [mapPickMode, setMapPickMode] = useState(false)
  const [form, setForm] = useState({ vehicle_number: '', driver_name: '', vehicle_type: 'truck', phone: '' })
  const mapRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [vRes, gRes] = await Promise.all([getVehicles(), getGeofences()])
      setVehicles(vRes.data.vehicles || [])
      setGeofences(gRes.data.geofences || [])
    } catch {
      toast.error('Failed to load data')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // When a vehicle is selected for location update, pre-fill with current location
  const openLocationPanel = (vehicle) => {
    setSelectedVehicle(vehicle)
    if (vehicle.current_location) {
      setPickedLat(vehicle.current_location.latitude)
      setPickedLng(vehicle.current_location.longitude)
    } else {
      setPickedLat(null)
      setPickedLng(null)
    }
    setMapPickMode(false)
    setShowLocationPanel(true)
  }

  const handleMapPick = (lat, lng) => {
    setPickedLat(parseFloat(lat.toFixed(6)))
    setPickedLng(parseFloat(lng.toFixed(6)))
    setMapPickMode(false)
    toast.success(`Location pinned: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, { duration: 2000 })
  }

  const handleUpdateLocation = async () => {
    if (pickedLat === null || pickedLng === null) {
      toast.error('Click on the map to set a location first')
      return
    }
    setSubmitting(true)
    try {
      const res = await updateVehicleLocation({
        vehicle_id: selectedVehicle.id,
        latitude: pickedLat,
        longitude: pickedLng,
        timestamp: new Date().toISOString(),
      })
      const gfs = res.data.current_geofences || []
      if (gfs.length > 0) {
        toast.success(`Location updated! Inside ${gfs.length} geofence(s): ${gfs.map(g => g.geofence_name).join(', ')}`)
      } else {
        toast.success(`Location updated for ${selectedVehicle.vehicle_number}`)
      }
      setShowLocationPanel(false)
      setSelectedVehicle(null)
      setPickedLat(null)
      setPickedLng(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update location')
    }
    setSubmitting(false)
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!form.vehicle_number || !form.driver_name || !form.phone) {
      toast.error('All fields are required')
      return
    }
    setSubmitting(true)
    try {
      await createVehicle(form)
      toast.success('Vehicle registered!')
      setShowCreate(false)
      setForm({ vehicle_number: '', driver_name: '', vehicle_type: 'truck', phone: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register vehicle')
    }
    setSubmitting(false)
  }

  const handleDeleteVehicle = async (v) => {
    if (!window.confirm(`Delete vehicle "${v.vehicle_number}"?\n\nThis will also remove its location history and alert rules.`)) return
    try {
      await deleteVehicle(v.id)
      toast.success(`Deleted: ${v.vehicle_number}`)
      if (selectedVehicle?.id === v.id) {
        setSelectedVehicle(null)
        setShowLocationPanel(false)
      }
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete vehicle')
    }
  }

  // Build picked location marker
  const pickedMarker = pickedLat !== null && pickedLng !== null
    ? L.marker([pickedLat, pickedLng], { icon: selectedIcon })
    : null

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Vehicles</h1>
          <p className="page-subtitle">Register and track your fleet</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load} title="Refresh"><RefreshCw size={15} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> Register Vehicle</button>
        </div>
      </div>

      {/* Register form */}
      {showCreate && (
        <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>Register New Vehicle</h3>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <form onSubmit={handleCreateSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Vehicle Number *</label>
                <input className="input" value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} placeholder="KA-01-AB-1234" />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Driver Name *</label>
                <input className="input" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} placeholder="John Doe" />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Vehicle Type *</label>
                <select className="input" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Phone *</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1234567890" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '0.875rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <span className="spinner" /> : 'Register'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Location update panel with embedded map ── */}
      {showLocationPanel && selectedVehicle && (
        <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Navigation size={18} color="#f59e0b" />
              <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>
                Update Location — <span style={{ color: '#f59e0b' }}>{selectedVehicle.vehicle_number}</span>
              </h3>
            </div>
            <button onClick={() => { setShowLocationPanel(false); setMapPickMode(false) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem', alignItems: 'start' }}>
            {/* Map */}
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', height: 360 }}>
              {mapPickMode && (
                <div className="draw-mode-banner" style={{ background: 'rgba(245,158,11,0.95)', color: 'white' }}>
                  Click anywhere on the map to set vehicle location
                </div>
              )}
              <MapContainer
                center={
                  pickedLat ? [pickedLat, pickedLng] :
                  selectedVehicle.current_location ? [selectedVehicle.current_location.latitude, selectedVehicle.current_location.longitude] :
                  [20.5937, 78.9629]
                }
                zoom={pickedLat ? 13 : 5}
                style={{ height: '100%', width: '100%', cursor: mapPickMode ? 'crosshair' : 'grab' }}
                ref={mapRef}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationPicker active={mapPickMode} onPick={handleMapPick} />

                {/* All geofences — non-interactive in pick mode so clicks pass through to the map */}
                {geofences.map((gf) => (
                  <Polygon
                    key={gf.id}
                    positions={gf.coordinates.map(([lat, lng]) => [lat, lng])}
                    pathOptions={{
                      color: categoryColors[gf.category] || '#3b82f6',
                      fillOpacity: mapPickMode ? 0.08 : 0.12,
                      weight: 2,
                      interactive: !mapPickMode,
                    }}
                    eventHandlers={mapPickMode ? {} : undefined}
                  >
                    {!mapPickMode && (
                      <Popup>
                        <strong>{gf.name}</strong><br />
                        <span style={{ fontSize: 12, color: '#64748b' }}>{gf.category?.replace('_', ' ')}</span>
                      </Popup>
                    )}
                  </Polygon>
                ))}

                {/* Other vehicles */}
                {vehicles.filter(v => v.id !== selectedVehicle.id && v.current_location).map((v) => (
                  <Marker key={v.id} position={[v.current_location.latitude, v.current_location.longitude]} icon={vehicleIcon}>
                    <Popup><strong>{v.vehicle_number}</strong><br />{v.driver_name}</Popup>
                  </Marker>
                ))}

                {/* Picked / current location marker */}
                {pickedLat !== null && (
                  <Marker position={[pickedLat, pickedLng]} icon={selectedIcon}>
                    <Popup>
                      <strong>{selectedVehicle.vehicle_number}</strong><br />
                      New location: {pickedLat.toFixed(5)}, {pickedLng.toFixed(5)}
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>

            {/* Sidebar controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ padding: '0.875rem', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>SELECTED LOCATION</p>
                {pickedLat !== null ? (
                  <>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {pickedLat.toFixed(6)}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {pickedLng.toFixed(6)}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No location selected yet</p>
                )}
              </div>

              <button
                className={`btn ${mapPickMode ? 'btn-warning' : 'btn-primary'}`}
                style={{ justifyContent: 'center' }}
                onClick={() => setMapPickMode(!mapPickMode)}
              >
                <MapPin size={15} />
                {mapPickMode ? 'Cancel Pick' : 'Pick on Map'}
              </button>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Or type coordinates manually:</p>
                <input
                  className="input"
                  style={{ marginBottom: 6 }}
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={pickedLat ?? ''}
                  onChange={e => setPickedLat(parseFloat(e.target.value) || null)}
                />
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={pickedLng ?? ''}
                  onChange={e => setPickedLng(parseFloat(e.target.value) || null)}
                />
              </div>

              <button
                className="btn btn-success"
                style={{ justifyContent: 'center', marginTop: 'auto' }}
                onClick={handleUpdateLocation}
                disabled={submitting || pickedLat === null}
              >
                {submitting ? <span className="spinner" /> : <><Navigation size={15} /> Confirm Location</>}
              </button>

              {/* Legend */}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <p style={{ marginBottom: 4, fontWeight: 500, color: 'var(--text-secondary)' }}>Map Legend</p>
                {Object.entries(categoryColors).map(([cat, color]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.7 }} />
                    {cat.replace(/_/g, ' ')}
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                  Selected vehicle
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : vehicles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Truck size={48} style={{ margin: '0 auto 1rem', color: 'var(--border)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No vehicles registered yet</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Vehicle Number</th>
                <th>Driver</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Current Location</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} style={selectedVehicle?.id === v.id ? { background: 'rgba(245,158,11,0.06)' } : {}}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.vehicle_number}</span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{v.id}</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{v.driver_name}</td>
                  <td><span className="badge badge-blue">{v.vehicle_type}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{v.phone}</td>
                  <td><span className="badge badge-green">{v.status}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {v.current_location ? (
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {v.current_location.latitude?.toFixed(4)}, {v.current_location.longitude?.toFixed(4)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>No location set</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.8rem', border: selectedVehicle?.id === v.id ? '1px solid #f59e0b' : undefined }}
                        onClick={() => openLocationPanel(v)}
                      >
                        <MapPin size={13} /> Update
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                        onClick={() => handleDeleteVehicle(v)}
                        title="Delete vehicle"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
