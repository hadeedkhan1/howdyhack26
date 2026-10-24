import { MapContainer, TileLayer } from 'react-leaflet'

// A quiet, non-interactive Galveston map gives every screen the same sense of place.
export default function AmbientMap() {
  return (
    <div className="ambient-map" aria-hidden="true">
      <MapContainer
        center={[29.225, -94.906]}
        zoom={10}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        dragging={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        />
      </MapContainer>
      <span className="ambient-map-credit">Imagery © Esri, Maxar, Earthstar Geographics</span>
    </div>
  )
}