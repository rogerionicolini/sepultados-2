// MapaCemiterio.jsx — cemitério + quadras + túmulos (retângulo) com popup de Google Maps
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, LoadScript, Polygon, OverlayView, InfoWindow } from "@react-google-maps/api";
import { api } from "../api/api";

/* ---------------- util ---------------- */
function normalizePolygon(cell) {
  if (!cell) return [];
  if (Array.isArray(cell) && cell.length && typeof cell[0] === "object" && "lat" in cell[0] && "lng" in cell[0]) {
    return cell.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  }
  if (Array.isArray(cell) && cell.length && Array.isArray(cell[0])) {
    return cell.map(p => ({ lat: Number(p[0]), lng: Number(p[1]) }));
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

/** desloca em metros a partir de (lat,lng) */
function offsetMeters({ lat, lng }, dx, dy) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  return {
    lat: lat + (dy / mPerDegLat),
    lng: lng + (dx / mPerDegLng),
  };
}

/** gera retângulo (w,h em metros), com rotação angDeg a partir do centro */
function rectangleFromCenter(center, w = 1.8, h = 0.9, angDeg = 0) {
  const rad = (angDeg * Math.PI) / 180;
  const hw = w / 2, hh = h / 2;

  const pts = [
    { x: -hw, y: -hh }, // TL
    { x:  hw, y: -hh }, // TR
    { x:  hw, y:  hh }, // BR
    { x: -hw, y:  hh }, // BL
  ].map(({ x, y }) => {
    const xr = x * Math.cos(rad) - y * Math.sin(rad);
    const yr = x * Math.sin(rad) + y * Math.cos(rad);
    return offsetMeters(center, xr, yr);
  });

  return pts;
}

/* ---- rótulo de quadra (só em zoom alto) ---- */
function QuadraLabel({ position, text, zoom }) {
  if (!position || (zoom ?? 0) < 18) return null;
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
          color: "rgba(0,0,0,0.42)",
          textShadow: "1px 1px 0 rgba(255,255,255,0.75), -1px -1px 0 rgba(255,255,255,0.75)",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {text}
      </div>
    </OverlayView>
  );
}

/* ---------------- componente ---------------- */
export default function MapaCemiterio({ cemiterioId, height = 650 }) {
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const MAX_ZOOM_ON_FOCUS = 21;
  const PADRAO_LxH = { w: 1.8, h: 0.9 };

  // resolve cemitério
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
    } catch { return null; }
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

  // estado do mapa
  const [map, setMap] = useState(null);
  const [zoom, setZoom] = useState(18);
  const [limites, setLimites] = useState(null);
  const [quadras, setQuadras] = useState([]);
  const [showTumulos, setShowTumulos] = useState(true);

  // tumulosRaw = vindo da API (sem retângulo aplicado)
  const [tumulosRaw, setTumulosRaw] = useState([]);
  const [openInfoId, setOpenInfoId] = useState(null);

  const onLoadMap = useCallback((m) => setMap(m), []);
  const onZoomChanged = useCallback(() => { if (map?.getZoom) setZoom(map.getZoom()); }, [map]);

  const fitTo = useCallback((paths) => {
    if (!map || !window.google || !Array.isArray(paths) || paths.length === 0) return;
    const b = new window.google.maps.LatLngBounds();
    paths.forEach((p) => b.extend(p));
    map.fitBounds(b, { top: 24, right: 24, bottom: 24, left: 24 });
  }, [map]);

  // API
  async function fetchCemiterio(id) {
    const r = await api.get(`/cemiterios/${id}/`);
    return r.data;
  }
  async function fetchQuadras(id) {
    const r = await api.get(`/quadras/`, { params: { cemiterio: id } });
    return r.data;
  }
  async function fetchTumulos(id) {
    const r = await api.get(`/tumulos/`, { params: { cemiterio: id } });
    const data = Array.isArray(r.data) ? r.data : [];
    // armazenamos dados essenciais; ângulo final será aplicado depois (usando mapa de quadras)
    return data
      .map((t) => {
        const p =
          t.localizacao ||
          t.posicao ||
          (t.lat && t.lng ? { lat: t.lat, lng: t.lng } : null) ||
          (t.latitude && t.longitude ? { lat: t.latitude, lng: t.longitude } : null);

        const center = p ? { lat: Number(p.lat), lng: Number(p.lng) } : null;
        const quadraId = t.quadra?.id ?? t.quadra ?? null;
        const quadraCodigo = t.quadra?.codigo ?? null;
        const angPersonalizado =
          t.angulo_graus ?? t.angulo ?? t.anguloGraus ?? null; // tolerante a nomes diferentes

        return center
          ? {
              id: t.id,
              codigo: t.identificador || t.codigo || t.nome || `Túmulo ${t.id}`,
              status: t.status || "desconhecido",
              center,
              quadraId,
              quadraCodigo,
              angPersonalizado,
            }
          : null;
      })
      .filter(Boolean);
  }

  // carregar dados
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!cemId) { setLimites(null); setQuadras([]); setTumulosRaw([]); return; }

      try {
        const c = await fetchCemiterio(cemId);
        const lim = Array.isArray(c?.limites_mapa) ? normalizePolygon(c.limites_mapa) : [];
        if (!dead) setLimites(lim.length >= 3 ? lim : null);
      } catch { if (!dead) setLimites(null); }

      try {
        const arr = await fetchQuadras(cemId);
        const qs = (Array.isArray(arr) ? arr : [])
          .map(q => {
            const paths = normalizePolygon(q?.poligono_mapa);
            return paths.length >= 3 ? { id: q.id, codigo: q.codigo, paths, grid: q.grid_params || {} } : null;
          })
          .filter(Boolean);
        if (!dead) setQuadras(qs);
      } catch { if (!dead) setQuadras([]); }

      try {
        const ts = await fetchTumulos(cemId);
        if (!dead) setTumulosRaw(ts);
      } catch { if (!dead) setTumulosRaw([]); }
    })();
    return () => { dead = true; };
  }, [cemId]);

  // mapa: quadraId -> angulo (grid_params.angulo)
  const anguloPorQuadra = useMemo(() => {
    const m = new Map();
    for (const q of quadras) {
      const a = q?.grid?.angulo;
      const n = a === undefined || a === null || a === "" ? null : Number(a);
      if (Number.isFinite(n)) m.set(q.id, n);
    }
    return m;
  }, [quadras]);

  // tumulos prontos para render (aplicando ângulo final e retângulo)
  const tumulos = useMemo(() => {
    return tumulosRaw.map((t) => {
      const angPersonal = t.angPersonalizado;
      const angParsed = angPersonal !== null && angPersonal !== undefined && angPersonal !== ""
        ? Number(angPersonal)
        : null;

      const angFinal = Number.isFinite(angParsed)
        ? angParsed
        : (anguloPorQuadra.get(t.quadraId) ?? 0);

      const rect = rectangleFromCenter(t.center, PADRAO_LxH.w, PADRAO_LxH.h, angFinal);

      return {
        id: t.id,
        codigo: t.codigo,
        status: t.status,
        center: t.center,
        quadra: { id: t.quadraId, codigo: t.quadraCodigo },
        angulo: angFinal,
        rect,
      };
    });
  }, [tumulosRaw, anguloPorQuadra]);

  // centralizar quando carrega
  useEffect(() => {
    if (limites?.length) fitTo(limites);
    else if (quadras?.length) {
      const all = quadras.flatMap(q => q.paths);
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
                const all = quadras.flatMap(q => q.paths);
                if (all.length) fitTo(all);
              }
            }}
          >
            Centralizar
          </button>
          <button
            className="px-3 py-2 bg-white/95 rounded shadow text-sm"
            onClick={() => setShowTumulos(v => !v)}
          >
            {showTumulos ? "Ocultar túmulos" : "Mostrar túmulos"}
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
            zoomControl: true,
            maxZoom: 22,
            clickableIcons: false,
          }}
        >
          {/* Cemitério */}
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

          {/* Quadras */}
          {quadras.map((q) => {
            const pos = centroidLatLng(q.paths);
            return (
              <React.Fragment key={q.id}>
                <Polygon
                  paths={q.paths}
                  options={{
                    strokeColor: "#1d4ed8",
                    strokeOpacity: 1,
                    strokeWeight: 3,
                    fillColor: "#60a5fa",
                    fillOpacity: 0.18,
                    clickable: false,
                    zIndex: 2,
                  }}
                />
                <QuadraLabel position={pos} text={q.codigo} zoom={zoom} />
              </React.Fragment>
            );
          })}

          {/* Túmulos */}
          {showTumulos && tumulos.map(t => (
            <React.Fragment key={t.id}>
              <Polygon
                paths={t.rect}
                options={{
                  strokeColor: t.status === "ocupado" ? "#dc2626" : (t.status === "reservado" ? "#f59e0b" : "#22c55e"),
                  strokeOpacity: 0.95,
                  strokeWeight: 2,
                  fillColor: t.status === "ocupado" ? "#dc2626" : (t.status === "reservado" ? "#f59e0b" : "#22c55e"),
                  fillOpacity: 0.25,
                  zIndex: 3,
                }}
                onClick={() => {
                  if (map && t.center) {
                    map.panTo(t.center);
                    const current = map.getZoom() || 17;
                    if (current < MAX_ZOOM_ON_FOCUS) map.setZoom(MAX_ZOOM_ON_FOCUS);
                  }
                  setOpenInfoId(t.id);
                }}
              />

              {openInfoId === t.id && t.center && (
                <InfoWindow
                  position={t.center}
                  onCloseClick={() => setOpenInfoId(null)}
                  options={{ pixelOffset: new window.google.maps.Size(0, -8) }}
                >
                  <div style={{ minWidth: 190 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Túmulo {t.codigo}</div>
                    {t.quadra?.codigo && (
                      <div style={{ fontSize: 12, marginBottom: 4 }}>Quadra: {t.quadra.codigo}</div>
                    )}
                    <div style={{ fontSize: 12, marginBottom: 10 }}>
                      Status: {t.status}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <a
                        href={`https://www.google.com/maps?q=${t.center.lat},${t.center.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        ➤ Ver no Google Maps
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${t.center.lat},${t.center.lng}&travelmode=driving`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        🧭 Traçar rota
                      </a>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          ))}
        </GoogleMap>
      </div>
    </LoadScript>
  );
}
