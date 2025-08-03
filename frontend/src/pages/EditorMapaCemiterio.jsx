import React, { useRef } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

export default function EditorMapaCemiterio({ onSalvar }) {
  const featureGroupRef = useRef();

  const handleCreate = (e) => {
    const layer = e.layer;
    const coords = layer.getLatLngs()[0].map((latlng) => [
      latlng.lat,
      latlng.lng,
    ]);
    onSalvar(coords);
  };

  return (
    <MapContainer
      center={[-23.438, -51.929]} // centro inicial do mapa
      zoom={18}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FeatureGroup ref={featureGroupRef}>
        <EditControl
          position="topright"
          onCreated={handleCreate}
          draw={{
            rectangle: false,
            polyline: false,
            circle: false,
            marker: false,
            circlemarker: false,
            polygon: {
              shapeOptions: {
                color: "green",
              },
            },
          }}
        />
      </FeatureGroup>
    </MapContainer>
  );
}
