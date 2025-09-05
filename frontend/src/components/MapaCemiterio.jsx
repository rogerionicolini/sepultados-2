// MapaCemiterio.jsx — popup ÚNICO sem ângulo/tamanho e sem PDF
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Polygon, OverlayView, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { api } from "../api/api";

/* ---------------- utils ---------------- */
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

function offsetMeters({ lat, lng }, dx, dy) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  return { lat: lat + (dy / mPerDegLat), lng: lng + (dx / mPerDegLng) };
}

function rectangleFromCenter(center, w = 2.0, h = 1.0, angDeg = 0) {
  const rad = (angDeg * Math.PI) / 180;
  const hw = w / 2, hh = h / 2;
  const pts = [
    { x: -hw, y: -hh },
    { x:  hw, y: -hh },
    { x:  hw, y:  hh },
    { x: -hw, y:  hh },
  ].map(({ x, y }) => {
    const xr = x * Math.cos(rad) - y * Math.sin(rad);
    const yr = x * Math.sin(rad) + y * Math.cos(rad);
    return offsetMeters(center, xr, yr);
  });
  return pts;
}

function toNum(v, fallback = null) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}
function fmtDataBR(d) {
  if (!d || typeof d !== "string") return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

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
  const PADRAO_LxH = { w: 2.0, h: 1.0 };

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: [],
  });

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
        const obj = JSON.parse(raw); const id = obj?.id ?? obj;
        return Number(id) > 0 ? Number(id) : null;
      } catch { const n = Number(raw); return Number.isFinite(n) && n > 0 ? n : null; }
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

  // dados base
  const [tumulosRaw, setTumulosRaw] = useState([]);

  // popup ÚNICO
  const [ativo, setAtivo] = useState(null);            // { ...tumulo }
  const [sepLoading, setSepLoading] = useState(false);
  const [sepultados, setSepultados] = useState([]);    // [{id, nome, data, exumado, trasladado}]
  const infoRef = useRef(null);                        // ref da janela (fecha fantasmas)

  const onZoomChanged = useCallback(() => { if (map?.getZoom) setZoom(map.getZoom()); }, [map]);
  const fitTo = useCallback((paths) => {
    if (!map || !isLoaded || !Array.isArray(paths) || paths.length === 0) return;
    const b = new window.google.maps.LatLngBounds();
    paths.forEach((p) => b.extend(p));
    map.fitBounds(b, { top: 24, right: 24, bottom: 24, left: 24 });
  }, [map, isLoaded]);

  // API
  async function fetchCemiterio(id) { return (await api.get(`/cemiterios/${id}/`)).data; }
  async function fetchQuadras(id)   { return (await api.get(`/quadras/`,  { params: { cemiterio: id } })).data; }
  async function fetchTumulos(id)   { 
    const r = await api.get(`/tumulos/`, { params: { cemiterio: id } });
    const data = Array.isArray(r.data) ? r.data : [];
    return data.map((t) => {
      const p = t.localizacao || t.posicao ||
        (t.lat && t.lng ? { lat: t.lat, lng: t.lng } : null) ||
        (t.latitude && t.longitude ? { lat: t.latitude, lng: t.longitude } : null);
      const center = p ? { lat: Number(p.lat), lng: Number(p.lng) } : null;
      if (!center) return null;

      // 🔹 título com linha e quadra quando existirem
      const base = t.identificador || t.codigo || t.nome || `${t.id}`;
      const linhaTxt =
        (t.usar_linha && (t.linha ?? null) !== null)
          ? `L ${String(t.linha).padStart(2, "0")}`
          : null;
      const quadraTxt = t.quadra?.codigo ? `Q ${t.quadra.codigo}` : null;

      return {
        id: t.id,
        // Ex.: "102 — L 05 — Q A"
        codigo: [base, linhaTxt, quadraTxt].filter(Boolean).join(" — "),
        status: t.status || "desconhecido",
        center,
        quadraId: t.quadra?.id ?? t.quadra ?? null,
        quadraCodigo: t.quadra?.codigo ?? null,
        comprimento: toNum(t.comprimento_m ?? t.comprimento ?? t.length ?? t.length_m, null),
        largura:     toNum(t.largura_m     ?? t.largura     ?? t.width  ?? t.width_m,  null),
        anguloTumulo: toNum(t.angulo_graus ?? t.angulo ?? t.anguloGraus, null),
      };
    }).filter(Boolean);
  }
  async function fetchSepultadosDoTumulo(cemiterioId, tumuloId) {
    setSepLoading(true); setSepultados([]);
    try {
      const r = await api.get(`/sepultados/`, { params: { cemiterio: cemiterioId, tumulo: tumuloId } });
      const arr = Array.isArray(r.data) ? r.data : [];
      setSepultados(arr.map(s => ({
        id: s.id,
        nome: s.nome || s.nome_completo || s.nome_sepultado || s.name || `#${s.id}`,
        data: s.data_sepultamento || s.data || "",
        exumado: !!s.exumado,
        trasladado: !!s.trasladado,
        status_display: s.status_display || s.status || null,
      })));
    } catch { setSepultados([]); }
    finally { setSepLoading(false); }
  }

  // carregar dados base
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

  // ângulo por quadra
  const anguloPorQuadra = useMemo(() => {
    const m = new Map();
    for (const q of quadras) {
      const a = q?.grid?.angulo;
      const n = a === undefined || a === null || a === "" ? null : Number(a);
      if (Number.isFinite(n)) m.set(q.id, n);
    }
    return m;
  }, [quadras]);

  // tumulos renderizáveis
  const tumulos = useMemo(() => {
    return tumulosRaw.map((t) => {
      const angQuadra = anguloPorQuadra.get(t.quadraId);
      const angFinal  = Number.isFinite(t?.anguloTumulo) ? t.anguloTumulo : (angQuadra ?? 0);
      const w = Number.isFinite(t?.comprimento) && t.comprimento > 0 ? t.comprimento : PADRAO_LxH.w;
      const h = Number.isFinite(t?.largura)     && t.largura     > 0 ? t.largura     : PADRAO_LxH.h;
      const rect = rectangleFromCenter(t.center, w, h, angFinal);
      return { ...t, angulo: angFinal, comprimento: w, largura: h, rect };
    });
  }, [tumulosRaw, anguloPorQuadra]);

  // recentraliza
  const fitAll = useCallback(() => {
    if (!map || !isLoaded) return;
    if (limites?.length) return fitTo(limites);
    if (quadras?.length) {
      const all = quadras.flatMap(q => q.paths);
      if (all.length) fitTo(all);
    }
  }, [map, isLoaded, limites, quadras, fitTo]);
  useEffect(() => { fitAll(); }, [fitAll, limites, quadras, map, isLoaded]);

  const infoPixelOffset = useMemo(
    () => (isLoaded && window.google ? new window.google.maps.Size(0, -8) : undefined),
    [isLoaded]
  );

  // carrega sepultados quando abre o popup
  useEffect(() => {
    if (ativo?.id && cemId) fetchSepultadosDoTumulo(cemId, ativo.id);
  }, [ativo?.id, cemId]);

  if (loadError) return <div className="p-4 bg-red-50 border border-red-200 rounded">Falha ao carregar o Google Maps.</div>;
  if (!isLoaded)  return <div className="p-4 bg-white border rounded shadow" style={{ height }}>Carregando mapa...</div>;

  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow" style={{ height }}>
      <div className="absolute z-[5] top-3 right-3 flex gap-2">
        <button className="px-3 py-2 bg-white/95 rounded shadow text-sm" onClick={fitAll}>Centralizar</button>
        <button className="px-3 py-2 bg-white/95 rounded shadow text-sm" onClick={() => setShowTumulos(v => !v)}>
          {showTumulos ? "Ocultar túmulos" : "Mostrar túmulos"}
        </button>
      </div>

      <GoogleMap
        onLoad={setMap}
        onZoomChanged={() => onZoomChanged()}
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
            options={{ strokeColor: "#16a34a", strokeOpacity: 1, strokeWeight: 3, fillOpacity: 0.10, clickable: false, zIndex: 1 }}
          />
        )}

        {/* Quadras */}
        {quadras.map((q) => {
          const pos = centroidLatLng(q.paths);
          return (
            <React.Fragment key={q.id}>
              <Polygon
                paths={q.paths}
                options={{ strokeColor: "#1d4ed8", strokeOpacity: 1, strokeWeight: 3, fillColor: "#60a5fa", fillOpacity: 0.18, clickable: false, zIndex: 2 }}
              />
              <QuadraLabel position={pos} text={q.codigo} zoom={zoom} />
            </React.Fragment>
          );
        })}

        {/* Túmulos */}
        {showTumulos && tumulos.map(t => (
          <Polygon
            key={t.id}
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
              setAtivo(t); // abre popup único
            }}
          />
        ))}

        {/* POPUP ÚNICO — fecha fantasmas no onLoad/onUnmount */}
        {ativo && ativo.center && (
          <InfoWindow
            key="iw"
            position={ativo.center}
            onLoad={(iw) => {
              // fecha qualquer instância anterior que tenha ficado no mapa
              if (infoRef.current && infoRef.current !== iw) {
                try { infoRef.current.close(); } catch {}
              }
              infoRef.current = iw;
            }}
            onUnmount={() => {
              try { infoRef.current?.close(); } catch {}
              infoRef.current = null;
            }}
            onCloseClick={() => { try { infoRef.current?.close(); } catch {} setAtivo(null); setSepultados([]); }}
            options={infoPixelOffset ? { pixelOffset: infoPixelOffset } : undefined}
          >
            <div style={{ minWidth: 210 }}>
              {/* título: só o identificador */}
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{ativo.codigo}</div>

              {/* lista de sepultados */}
              <div style={{ fontSize: 12, marginBottom: 10 }}>
                {sepLoading && <div>Carregando sepultados…</div>}
                {!sepLoading && sepultados.length === 0 && <div>Nenhum sepultado.</div>}
                {!sepLoading && sepultados.length > 0 && (
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {sepultados.map(s => (
                      <li key={s.id} style={{ marginBottom: 2 }}>
                        {s.nome}{s.data ? ` — ${fmtDataBR(s.data)}` : ""}
                        {s.status_display ? ` — ${s.status_display}` :
                          ((s.trasladado && " — Transladado") || (s.exumado && " — Exumado") || "")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* atalhos */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <a href={`https://www.google.com/maps?q=${ativo.center.lat},${ativo.center.lng}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  ➤ Ver no Google Maps
                </a>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${ativo.center.lat},${ativo.center.lng}&travelmode=driving`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  🧭 Traçar rota
                </a>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
