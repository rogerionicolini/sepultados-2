// MapaCemiterio.jsx — cemitério + quadras com rótulo e estilos melhores
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, LoadScript, Polygon, OverlayView } from "@react-google-maps/api";
import { api } from "../api/api";

/* ---------- helpers ---------- */
function normalizePolygon(cell) {
  if (!cell) return [];
  if (Array.isArray(cell) && cell.length && typeof cell[0] === "object" && "lat" in cell[0] && "lng" in cell[0]) {
    return cell.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  }
  if (Array.isArray(cell) && cell.length && Array.isArray(cell[0])) {
    return cell.map((p) => ({ lat: Number(p[0]), lng: Number(p[1]) }));
  }
  return [];
}
function centroidLatLng(path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  if (path.length < 3) {
    const lat = path.reduce((s, p) => s + p.lat, 0) / path.length;
    const lng = path.reduce((s, p) => s + p.lng, 0) / path.length;
    return { lat, lng };
  }
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const x0 = path[j].lng, y0 = path[j].lat;
    const x1 = path[i].lng, y1 = path[i].lat;
    const f = x0 * y1 - x1 * y0;
    area += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  area *= 0.5;
  if (!area) {
    const lat = path.reduce((s, p) => s + p.lat, 0) / path.length;
    const lng = path.reduce((s, p) => s + p.lng, 0) / path.length;
    return { lat, lng };
  }
  return { lat: cy / (6 * area), lng: cx / (6 * area) };
}

/* ---------- rótulo (mostra só em zoom alto) ---------- */
function QuadraLabel({ position, text, zoom }) {
  if (!position || (zoom ?? 0) < 18) return null; // esconde em zoom baixo
  const fontSize = Math.max(12, Math.min(26, Math.round((zoom ?? 18) * 1.15)));
  return (
    <OverlayView position={position} mapPaneName={OverlayView.OVERLAY_LAYER}>
      <div
        style={{
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          fontWeight: 700,
          fontSize: `${fontSize}px`,
          letterSpacing: "0.5px",
          color: "rgba(0,0,0,0.42)", // marca d'água
          textShadow:
            "1px 1px 0 rgba(255,255,255,0.75), -1px -1px 0 rgba(255,255,255,0.75)",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {text}
      </div>
    </OverlayView>
  );
}

/* ---------------- mapa ---------------- */
export default function MapaCemiterio({ cemiterioId, height = 650 }) {
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const idFromProp = useMemo(() => {
    const v = Number(cemiterioId);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [cemiterioId]);
  const idFromQS = useMemo(() => {
    const v = Number(new URLSearchParams(window.location.search).get("cemiterio"));
    return Number.isFinite(v) && v > 0 ? v : null;
  }, []);
  function readCemFromLS() {
    try {
      const raw = localStorage.getItem("cemiterioAtivo");
      if (!raw) return null;
      try {
        const obj = JSON.parse(raw);
        const id = obj?.id ?? obj;
        return Number(id) > 0 ? Number(id) : null;
      } catch {
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : null;
      }
    } catch {
      return null;
    }
  }
  const [cemId, setCemId] = useState(idFromProp ?? idFromQS ?? readCemFromLS());

  useEffect(() => {
    const onChanged = () => setCemId(readCemFromLS());
    window.addEventListener("cemiterio:changed", onChanged);
    const onStorage = (e) => { if (e.key === "cemiterioAtivo") onChanged(); };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cemiterio:changed", onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const [map, setMap] = useState(null);
  const [zoom, setZoom] = useState(18);
  const [limites, setLimites] = useState(null);
  const [quadras, setQuadras] = useState([]);

  const onLoadMap = useCallback((m) => setMap(m), []);
  const fitTo = useCallback((paths) => {
    if (!map || !window.google || !Array.isArray(paths) || paths.length === 0) return;
    const b = new window.google.maps.LatLngBounds();
    paths.forEach((p) => b.extend(p));
    map.fitBounds(b, { top: 24, right: 24, bottom: 24, left: 24 });
  }, [map]);

  // sincroniza zoom
  const onZoomChanged = useCallback(() => {
    if (map?.getZoom) setZoom(map.getZoom());
  }, [map]);

  async function fetchCemiterio(id) {
    const r = await api.get(`/cemiterios/${id}/`);
    return r.data;
  }
  async function fetchQuadras(id) {
    const r = await api.get(`/quadras/`, { params: { cemiterio: id } });
    return r.data;
  }

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!cemId) { setLimites(null); setQuadras([]); return; }
      try {
        const c = await fetchCemiterio(cemId);
        const lim = Array.isArray(c?.limites_mapa) ? normalizePolygon(c.limites_mapa) : [];
        if (!dead) setLimites(lim.length >= 3 ? lim : null);
      } catch { if (!dead) setLimites(null); }
      try {
        const arr = await fetchQuadras(cemId);
        const qs = (Array.isArray(arr) ? arr : [])
          .map((q) => {
            const paths = normalizePolygon(q?.poligono_mapa);
            return paths.length >= 3 ? { id: q.id, codigo: q.codigo, paths } : null;
          })
          .filter(Boolean);
        if (!dead) setQuadras(qs);
      } catch { if (!dead) setQuadras([]); }
    })();
    return () => { dead = true; };
  }, [cemId]);

  useEffect(() => {
    if (limites?.length) fitTo(limites);
    else if (quadras?.length) {
      const all = quadras.flatMap((q) => q.paths);
      if (all.length) fitTo(all);
    }
  }, [limites, quadras, fitTo]);

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <div className="relative w-full rounded-xl overflow-hidden shadow" style={{ height }}>
        <div className="absolute z-[5] top-3 right-3 flex gap-2">
          <button
            className="px-3 py-2 bg-white/95 rounded shadow text-sm"
            onClick={() => {
              if (limites?.length) fitTo(limites);
              else if (quadras?.length) {
                const all = quadras.flatMap((q) => q.paths);
                if (all.length) fitTo(all);
              }
            }}
            disabled={!limites?.length && !quadras?.length}
          >
            Centralizar
          </button>
        </div>

        <GoogleMap
          onLoad={onLoadMap}
          onZoomChanged={onZoomChanged}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={limites?.[0] || { lat: -23.43, lng: -51.94 }}
          zoom={17}
          options={{
            mapTypeId: "hybrid",
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
            gestureHandling: "greedy",
            rotateControl: false,
          }}
        >
          {/* Cemitério (verde) */}
          {Array.isArray(limites) && limites.length >= 3 && (
            <Polygon
              paths={limites}
              options={{
                strokeColor: "#16a34a",
                strokeOpacity: 1,
                strokeWeight: 3,
                fillOpacity: 0.10,
                clickable: false,
                zIndex: 1,
              }}
            />
          )}

          {/* Quadras (azul mais visível) + rótulo condicionado ao zoom */}
          {quadras.map((q) => {
            const pos = centroidLatLng(q.paths);
            return (
              <React.Fragment key={q.id}>
                <Polygon
                  paths={q.paths}
                  options={{
                    strokeColor: "#1d4ed8",   // azul bem visível
                    strokeOpacity: 1,
                    strokeWeight: 3,
                    fillColor: "#60a5fa",
                    fillOpacity: 0.18,        // mais forte que antes
                    clickable: false,
                    zIndex: 2,
                  }}
                />
                <QuadraLabel position={pos} text={q.codigo} zoom={zoom} />
              </React.Fragment>
            );
          })}
        </GoogleMap>
      </div>
    </LoadScript>
  );
}
