import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const api = axios.create({ baseURL: BASE_URL })

// Geofences
export const getGeofences = (category) =>
  api.get('/geofences', { params: category ? { category } : {} })
export const createGeofence = (data) => api.post('/geofences', data)
export const deleteGeofence = (id) => api.delete(`/geofences/${id}`)

// Vehicles
export const getVehicles = () => api.get('/vehicles')
export const createVehicle = (data) => api.post('/vehicles', data)
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}`)
export const updateVehicleLocation = (data) => api.post('/vehicles/location', data)
export const getVehicleLocation = (vehicleId) =>
  api.get(`/vehicles/location/${vehicleId}`)

// Alerts
export const getAlerts = (filters) => api.get('/alerts', { params: filters })
export const configureAlert = (data) => api.post('/alerts/configure', data)
export const deleteAlert = (id) => api.delete(`/alerts/${id}`)

// Violations
export const getViolations = (filters) =>
  api.get('/violations/history', { params: filters })

export const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:8080') + '/ws/alerts'

export default api
