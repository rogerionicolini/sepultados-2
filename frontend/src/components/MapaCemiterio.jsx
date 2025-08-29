import React, { useEffect } from "react";
import { MapContainer, TileLayer, useMap, useMapEvent } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";

/** Garante que o Leaflet recalcule o tamanho do mapa após montar/resizar */
function FixResize() {
  const map = useMap();

  useEffect(() => {
    // invalida no mount e um pouco depois (caso o layout ainda esteja acomodando)
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 150);

    function onResize() {
      map.invalidateSize();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [map]);

  // também invalida quando o mapa terminar de carregar
  useMapEvent("load", () => {
    map.invalidateSize();
  });

  return null;
}

/** Controle de desenho (polígono) com limpeza correta no unmount */
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
          shapeOptions: { color: "#28a745" },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems },
    });

    map.addControl(drawControl);

    function onCreated(event) {
      const layer = event.layer;
      drawnItems.addLayer(layer);
      const coords = layer.getLatLngs()[0].map((latlng) => ({
        lat: latlng.lat,
        lng: latlng.lng,
      }));
      // console.log("Coordenadas geradas:", coords);
      if (onPoligonoCriado) onPoligonoCriado(coords);
    }

    map.on(L.Draw.Event.CREATED, onCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, onCreated);
      try { map.removeControl(drawControl); } catch {}
      try { map.removeLayer(drawnItems); } catch {}
    };
  }, [map, onPoligonoCriado]);

  return null;
}

export default function MapaCemiterio() {
  // Ajuste para o centro do seu cemitério
  const centroCemiterio = [-23.414, -51.930];

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden shadow">
      <MapContainer
        center={centroCemiterio}
        zoom={18}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
        whenReady={(e) => e.target.invalidateSize()}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <FixResize />

        <ControladorDeDesenho
          onPoligonoCriado={(coords) => {
            // console.log("Salvar essas coordenadas:", coords);
            // TODO: enviar para a API quando quiser persistir
          }}
        />
      </MapContainer>
    </div>
  );
}
