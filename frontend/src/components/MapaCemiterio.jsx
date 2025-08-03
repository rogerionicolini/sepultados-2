import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';

function ControladorDeDesenho({ onPoligonoCriado }) {
  const map = useMap();

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: '#28a745',
          },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
      },
    });

    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (event) {
      const layer = event.layer;
      drawnItems.addLayer(layer);

      const coords = layer.getLatLngs()[0].map((latlng) => ({
        lat: latlng.lat,
        lng: latlng.lng,
      }));

      console.log('Coordenadas geradas:', coords);
      onPoligonoCriado(coords); // você pode salvar isso via API
    });

    return () => {
      map.off();
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, onPoligonoCriado]);

  return null;
}

export default function MapaCemiterio() {
  const centroCemiterio = [-23.414, -51.930]; // Ajuste para o centro do seu cemitério

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden shadow">
      <MapContainer center={centroCemiterio} zoom={18} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <ControladorDeDesenho
          onPoligonoCriado={(coords) => {
            // Aqui você pode salvar no backend depois
            console.log('Salvar essas coordenadas:', coords);
          }}
        />
      </MapContainer>
    </div>
  );
}
