// MapaCemiterio.jsx (versão sem os botões de desenho/rotação/recarregar)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, LoadScript, Polygon } from "@react-google-maps/api";

export default function MapaCemiterio({ cemiterioId, height = 650 }) {
  // ---------- CONFIG ----------
  const API_BASE = (
    import.meta.env.VITE_API_BASE_URL ||
    window.location.origin.replace("localhost:5173", "127.0.0.1:8000").replace(":5173", ":8000") ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  // ---------- RESOLVE CEMITÉRIO ----------
  const idFromProp = useMemo(() => {
    const v = Number(cemiterioId);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [cemiterioId]);

  const idFromQS = useMemo(() => {
    const v = Number(new URLSearchParams(window.location.search).get("cemiterio"));
    return Number.isFinite(v) && v > 0 ? v : null;
  }, []);

  const [cemId, setCemId] = useState(idFromProp ?? idFromQS ?? null);

  // fallback: localStorage.cemiterioAtivo (pode ser número ou objeto {id})
  useEffect(() => {
    if (cemId != null) return;

    const readLS = () => {
      try {
        const raw = localStorage.getItem("cemiterioAtivo");
        if (!raw) return null;
        let v = null;
        try {
          const obj = JSON.parse(raw);
          v = obj?.id ?? obj;
        } catch {
          v = raw;
        }
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
      } catch {
        return null;
      }
    };

    const initial = readLS();
    if (initial) setCemId(initial);

    const onStorage = (e) => {
      if (e.key === "cemiterioAtivo") {
        const next = readLS();
        if (next) setCemId(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [cemId]);

  // ---------- ESTADO MAPA ----------
  const [map, setMap] = useState(null);
  const [limites, setLimites] = useState(null); // [{lat,lng}, ...]

  const onLoadMap = useCallback((m) => setMap(m), []);

  // Enquadra o polígono no mapa
  const fitTo = useCallback(
    (path) => {
      if (!map || !window.google || !Array.isArray(path) || path.length === 0) return;
      const b = new window.google.maps.LatLngBounds();
      path.forEach((p) => b.extend(p));
      map.fitBounds(b, { top: 24, right: 24, bottom: 24, left: 24 });
    },
    [map]
  );

  // ---------- API ----------
  async function getCemiterioById(id) {
    const r = await fetch(`${API_BASE}/api/cemiterios/${id}/`, { credentials: "include" });
    if (!r.ok) throw new Error(`GET cemiterios/${id} => HTTP ${r.status}`);
    return r.json();
  }

  // ---------- CARREGAR LIMITES ----------
  useEffect(() => {
    (async () => {
      if (cemId == null) {
        setLimites(null);
        return;
      }
      try {
        const c = await getCemiterioById(cemId);
        const arr = Array.isArray(c?.limites_mapa) ? c.limites_mapa : null;
        setLimites(arr && arr.length >= 3 ? arr : null);
      } catch (e) {
        console.error(e);
        setLimites(null);
      }
    })();
  }, [cemId, API_BASE]);

  useEffect(() => {
    if (limites?.length) fitTo(limites);
  }, [limites, fitTo]);

  // ---------- RENDER ----------
  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <div className="relative w-full rounded-xl overflow-hidden shadow" style={{ height }}>
        {/* Único controle: Centralizar */}
        <div className="absolute z-[5] top-3 right-3 flex gap-2">
          <button
            className="px-3 py-2 bg-white/95 rounded shadow text-sm"
            onClick={() => limites && fitTo(limites)}
            disabled={!limites?.length}
          >
            Centralizar
          </button>
        </div>

        <GoogleMap
          onLoad={onLoadMap}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={limites?.[0] || { lat: -23.43, lng: -51.94 }}
          zoom={17}
          options={{
            mapTypeId: "hybrid",        // pode trocar para "satellite" se preferir
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
            gestureHandling: "greedy",
            rotateControl: false,
          }}
        >
          {Array.isArray(limites) && limites.length >= 3 && (
            <Polygon
              paths={limites}
              options={{ strokeColor: "#16a34a", strokeWeight: 3, fillOpacity: 0.08 }}
            />
          )}
        </GoogleMap>
      </div>
    </LoadScript>
  );
}
