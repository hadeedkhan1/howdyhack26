import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { spots } from '../services/content'

const spotShortNames = {
  'gisp-beach': 'State Park · beach side',
  'gisp-bay': 'State Park · bay side',
  'galveston-pier': 'Galveston Fishing Pier',
}

// The park pin is the TPWD-published headquarters coordinate, not a precise
// beach/bay fishing access point. The pier point is mapped by OpenStreetMap.
const mapLocations = [
  { id: 'gisp-beach', lat: 29.198755, lon: -94.956212, title: 'Galveston Island State Park', note: 'Park HQ · beach fishing area nearby' },
  { id: 'gisp-bay', lat: 29.198755, lon: -94.956212, title: 'Galveston Island State Park', note: 'Park HQ · bay fishing area nearby' },
  { id: 'galveston-pier', lat: 29.2496751, lon: -94.8525322, title: 'Galveston Fishing Pier', note: '9001 Seawall Blvd' },
]

const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

function MapFocus({ location, spotId }) {
  const map = useMap()
  const previousSpot = useRef(spotId)
  useEffect(() => {
    if (!location || previousSpot.current === spotId) return
    previousSpot.current = spotId
    map.flyTo([location.lat, location.lon], 14, { duration: 0.8 })
  }, [location, map, spotId])
  return null
}

function makeMarkerIcon(selected, label) {
  return L.divIcon({
    className: 'fish-map-marker-wrap',
    html: `<span class="fish-map-marker${selected ? ' selected' : ''}"><span class="marker-dot">✳</span><span class="marker-label">${label}</span></span>`,
    iconSize: [44, 48],
    iconAnchor: [22, 42],
  })
}

export default function SpotMap({ windows = [], selectedSpot, onSelect }) {
  const active = spots.find((spot) => spot.id === selectedSpot) || spots[0]
  const [layer, setLayer] = useState('satellite')
  const activeLocation = mapLocations.find((location) => location.id === active?.id) || mapLocations[0]
  const markers = useMemo(() => [mapLocations[0], mapLocations[2]], [])
  const destination = encodeURIComponent(active?.name || 'Galveston fishing spots')
  const destinationCoords = `${activeLocation.lat},${activeLocation.lon}`

  return <section className="panel spot-panel" aria-label="Choose a fishing spot">
    <div className="section-heading"><div><h2>Galveston, from above</h2></div><span className="round-icon">⌖</span></div>
    <div className="satellite-map">
      <MapContainer center={[29.225, -94.906]} zoom={11} scrollWheelZoom={false} zoomControl={false} aria-label="Satellite map of Galveston fishing locations">
        <TileLayer url={layer === 'satellite' ? satelliteUrl : streetUrl} attribution={layer === 'satellite' ? 'Tiles &copy; Esri, Maxar, Earthstar Geographics' : '&copy; OpenStreetMap contributors'} />
        {markers.map((location) => {
          const spot = spots.find((entry) => entry.id === location.id)
          const isSelected = location.id === active?.id || (location.id === 'gisp-beach' && ['gisp-beach', 'gisp-bay'].includes(active?.id))
          const markerLabel = location.id === 'gisp-beach' ? 'STATE PARK' : 'FISHING PIER'
          return <Marker key={location.id} position={[location.lat, location.lon]} icon={makeMarkerIcon(isSelected, markerLabel)} eventHandlers={{ click: () => onSelect?.(spot.id) }}>
            <Tooltip direction="top" offset={[0, -26]}>{location.title} · {location.note}</Tooltip>
          </Marker>
        })}
        <MapFocus location={activeLocation} spotId={active?.id} />
      </MapContainer>
      <div className="map-layer-control" role="group" aria-label="Map layer">
        <button type="button" className={layer === 'satellite' ? 'active' : ''} onClick={() => setLayer('satellite')} aria-pressed={layer === 'satellite'}>Satellite</button>
        <button type="button" className={layer === 'street' ? 'active' : ''} onClick={() => setLayer('street')} aria-pressed={layer === 'street'}>Map</button>
      </div>
    </div>
    <p className="map-location-note">Park marker shows TPWD headquarters; fishing areas are on both the beach and bay sides. <a href="https://tpwd.texas.gov/state-parks/galveston-island/map" target="_blank" rel="noreferrer">View official park map ↗</a></p>
    <div className="spot-list">
      {spots.map((spot, index) => {
        const topWindow = windows.find((window) => window.spotId === spot.id)
        return <button type="button" key={spot.id} onClick={() => onSelect?.(spot.id)} className={`spot-option ${active?.id === spot.id ? 'selected' : ''}`} aria-pressed={active?.id === spot.id}>
          <span className="spot-number">0{index + 1}</span><span className="spot-option-copy"><b>{spotShortNames[spot.id]}</b><small>{spot.type === 'surf' ? 'Open Gulf · shore fishing' : spot.type === 'bay' ? 'Sheltered water · shore fishing' : 'Pier · easy access'}</small></span>
          {topWindow ? <span className="spot-window">{topWindow.start}</span> : <span className="spot-arrow">↗</span>}
        </button>
      })}
    </div>
    <a className="button button-outline directions-button" href={`https://www.google.com/maps/search/?api=1&query=${destinationCoords}%20(${destination})`} target="_blank" rel="noreferrer">Open directions in Maps <span>↗</span></a>
  </section>
}
