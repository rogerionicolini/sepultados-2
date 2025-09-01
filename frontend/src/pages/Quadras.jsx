// src/pages/Quadras.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getCemiterioAtivo } from "../utils/cemiterioStorage";

const API_BASE = "http://127.0.0.1:8000/api/";
const QUADRAS_EP = "quadras/";
const TUMULOS_EP = "tumulos/";

/* --- helpers de status (mesmo critério em todas as telas) --- */
function normalizeStatus(raw) {
  if (raw == null) return null;
  const s = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (s.includes("ocup")) return "ocupado";
  if (s.includes("reserv")) return "reservado";
  if (s.includes("disp")) return "disponivel";
  return s || null;
}

function StatusPill({ status }) {
  const s = normalizeStatus(status);
  const cls =
    s === "ocupado"
      ? "bg-red-100 text-red-800 border-red-300"
      : s === "reservado"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-green-100 text-green-800 border-green-300";
  return (
    <span className={`px-2 py-0.5 rounded border font-semibold ${cls}`}>
      {s ?? "-"}
    </span>
  );
}

/* ------------- PARSER DE COORDENADAS (opcional) -------------
   Aceita:
   - JSON: [{"lat":-23.4,"lng":-51.9}, ...]  ou  [[-23.4,-51.9], ...]
   - Texto: "lat,lng; lat,lng; ..." (separador ;, |, / ou quebra-linha)
*/
const floatRe = /[-+]?\d+(?:\.\d+)?/g;

function parseCoords(txt) {
  if (!txt || !txt.trim()) return null; // null => não enviar no PATCH
  const s = txt.trim();

  // JSON?
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j) && j.length) {
        if (typeof j[0] === "object" && "lat" in j[0] && "lng" in j[0]) {
          return j.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
        }
        if (Array.isArray(j[0]) && j[0].length >= 2) {
          return j.map((p) => ({ lat: Number(p[0]), lng: Number(p[1]) }));
        }
      }
    } catch {
      /* cai no parser texto */
    }
  }

  // Texto "lat,lng; lat,lng ..."
  const norm = s.replace(/\|/g, ";").replace(/\//g, ";").replace(/\n/g, ";");
  const parts = norm.split(";").map((p) => p.trim()).filter(Boolean);
  const pts = [];
  for (const p of parts) {
    const m = p.match(floatRe);
    if (m && m.length >= 2) {
      const lat = Number(m[0]);
      const lng = Number(m[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        pts.push({ lat, lng });
      }
    }
  }
  if (!pts.length) return null; // nada válido -> não enviar
  return pts;
}

function stringifyCoords(arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  try {
    if (typeof arr[0] === "object" && "lat" in arr[0] && "lng" in arr[0]) {
      return arr.map((p) => `${p.lat}, ${p.lng}`).join("; ");
    }
    if (Array.isArray(arr[0])) {
      return arr.map((p) => `${p[0]}, ${p[1]}`).join("; ");
    }
  } catch {}
  return "";
}

export default function Quadras() {
  const [prefeituraId, setPrefeituraId] = useState(null);
  const [cemAtivo, setCemAtivo] = useState(getCemiterioAtivo());

  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // expansão + túmulos por quadra
  const [expanded, setExpanded] = useState({});
  const [loadingTumulos, setLoadingTumulos] = useState({});
  const [tumulosByQuadra, setTumulosByQuadra] = useState({});

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    codigo: "",
    coordsText: "", // novo (opcional)
    angulo: "",     // novo (opcional)
  });

  const token = localStorage.getItem("accessToken");
  const api = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });

  const qsWith = (base, params = {}) => {
    const qs = new URLSearchParams();
    if (prefeituraId) qs.set("prefeitura", prefeituraId);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, v);
    });
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };

  // ------- API helpers -------
  const listarQuadras = async () => {
    const url = qsWith(QUADRAS_EP, { cemiterio: cemAtivo?.id });
    const res = await api.get(url);
    const data = res.data;
    return Array.isArray(data) ? data : data?.results ?? [];
  };

  const listarTumulosDaQuadra = async (quadraId) => {
    const url = qsWith(TUMULOS_EP, { quadra: quadraId, cemiterio: cemAtivo?.id });
    const res = await api.get(url);
    const data = res.data;
    return Array.isArray(data) ? data : data?.results ?? [];
  };

  const criar = (payload) =>
    api.post(qsWith(QUADRAS_EP, { cemiterio: cemAtivo?.id }), payload, {
      headers: { "Content-Type": "application/json" },
    });

  // ⚠️ trocado para PATCH para não forçar campos opcionais
  const atualizar = (id, payload) =>
    api.patch(qsWith(`${QUADRAS_EP}${id}/`, { cemiterio: cemAtivo?.id }), payload, {
      headers: { "Content-Type": "application/json" },
    });

  const deletar = (id) =>
    api.delete(qsWith(`${QUADRAS_EP}${id}/`, { cemiterio: cemAtivo?.id }));

  // ------- carregadores -------
  async function carregarPrefeitura() {
    try {
      let id = null;
      try {
        const a = await api.get("prefeitura-logada/");
        id = a.data?.id || a.data?.prefeitura?.id || null;
      } catch {}
      if (!id) {
        const b = await api.get("usuario-logado/");
        id = b.data?.prefeitura?.id || null;
      }
      if (id) setPrefeituraId(id);
    } catch (e) {
      console.warn("carregarPrefeitura erro:", e);
    }
  }

  async function carregar() {
    if (!cemAtivo?.id) {
      setItens([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErro("");
      const data = await listarQuadras();
      setItens(data);
      setExpanded({});
      setTumulosByQuadra({});
    } catch (e) {
      console.error("listar ERRO:", e?.response?.status, e?.response?.data || e);
      setErro("Não foi possível carregar as quadras.");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onChanged = (e) => setCemAtivo(e?.detail || getCemiterioAtivo());
    const onStorage = () => setCemAtivo(getCemiterioAtivo());
    window.addEventListener("cemiterio:changed", onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cemiterio:changed", onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    carregarPrefeitura();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefeituraId, cemAtivo?.id]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((x) =>
      (x.codigo || x.nome || "").toString().toLowerCase().includes(q)
    );
  }, [itens, busca]);

  // ------- UI actions -------
  function abrirCriar() {
    setEditando(null);
    setForm({ codigo: "", coordsText: "", angulo: "" });
    setErro("");
    setModalOpen(true);
  }

  function abrirEditar(item) {
    setEditando(item);
    setForm({
      codigo: item.codigo || item.nome || "",
      coordsText: stringifyCoords(item.poligono_mapa) || "",
      angulo:
        item?.grid_params?.angulo === 0 || item?.grid_params?.angulo
          ? String(item.grid_params.angulo)
          : "",
    });
    setErro("");
    setModalOpen(true);
  }

  async function salvar() {
    try {
      setSalvando(true);
      setErro("");

      if (!cemAtivo?.id) {
        setErro("Selecione um cemitério antes de salvar.");
        return;
      }

      // sempre enviar código + cemitério
      const payload = {
        codigo: (form.codigo || "").trim(),
        cemiterio: Number(cemAtivo.id),
      };
      if (!payload.codigo) return setErro("Informe o código da quadra.");

      // --- coordenadas ---
      const rawCoords = String(form.coordsText ?? "");
      const trimmed = rawCoords.trim();
      if (trimmed === "") {
        // usuário quer APAGAR o polígono
        payload.poligono_mapa = [];
      } else {
        // tentar converter texto/JSON em [{lat,lng}, ...]
        const parsed = parseCoords(rawCoords);
        if (parsed) payload.poligono_mapa = parsed;
        // se parsed === null, não envia -> mantém o que já existe
      }

      // --- ângulo ---
      const rawAng = String(form.angulo ?? "").trim();
      if (rawAng === "") {
        // usuário quer APAGAR o ângulo
        payload.grid_params = { angulo: null };
      } else {
        const n = Number(rawAng.replace(",", "."));
        if (Number.isFinite(n)) {
          payload.grid_params = { angulo: n };
        }
        // se não for número válido, não envia -> mantém
      }

      const id = editando?.id ?? editando?.pk;
      if (id) {
        // usar PATCH para atualizar só o que foi enviado
        await atualizar(id, payload);
      } else {
        await criar(payload);
      }

      setModalOpen(false);
      await carregar();
    } catch (e) {
      console.error("salvar ERRO:", e?.response?.status, e?.response?.data || e);
      setErro(
        e.response?.data
          ? "Erro ao salvar: " + JSON.stringify(e.response.data)
          : "Erro ao salvar."
      );
    } finally {
      setSalvando(false);
    }
  }


  async function excluir(id) {
    if (!window.confirm("Excluir esta quadra?")) return;
    try {
      await deletar(id);
      await carregar();
    } catch (e) {
      console.error("excluir ERRO:", e?.response?.status, e?.response?.data || e);
      alert("Erro ao excluir.");
    }
  }

  async function toggleExpand(q) {
    const qid = q.id ?? q.pk;
    setExpanded((s) => ({ ...s, [qid]: !s[qid] }));

    if (!tumulosByQuadra[qid]) {
      try {
        setLoadingTumulos((m) => ({ ...m, [qid]: true }));
        const lista = await listarTumulosDaQuadra(qid);
        setTumulosByQuadra((m) => ({ ...m, [qid]: lista }));
      } catch (e) {
        console.warn("tumulos da quadra erro:", e?.response?.status, e?.response?.data || e);
        setTumulosByQuadra((m) => ({ ...m, [qid]: [] }));
      } finally {
        setLoadingTumulos((m) => ({ ...m, [qid]: false }));
      }
    }
  }

  // ------- render -------
  if (!cemAtivo?.id) {
    return (
      <div className="text-sm text-red-600">
        Selecione um cemitério para gerenciar as quadras.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">Quadras</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirCriar}
            className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90"
          >
            Adicionar
          </button>
          <button
            onClick={carregar}
            className="px-4 py-2 rounded-lg bg-[#688f53] text-white hover:opacity-90"
          >
            Atualizar
          </button>
        </div>
      </div>

      <div className="bg-[#f0f8ea] rounded-xl p-4 shadow">
        <div className="flex items-center justify-between gap-3 mb-4">
          <input
            className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
            placeholder="Buscar por código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-gray-600 px-1">Carregando…</div>
        ) : erro && itens.length === 0 ? (
          <div className="text-red-600 px-1">{erro}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-green-900 bg-[#e6f3d7]">
                  <th className="py-2 px-3 rounded-l-lg w-6"></th>
                  <th className="py-2 px-3">Código</th>
                  <th className="py-2 px-3 w-40 rounded-r-lg">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((q, idx) => {
                  const qid = q.id ?? q.pk;
                  return (
                    <React.Fragment key={qid ?? `${q.codigo || q.nome}-${idx}`}>
                      <tr className="border-top border-[#d8e9c0] hover:bg-white">
                        <td className="py-2 px-3">
                          <button
                            onClick={() => toggleExpand(q)}
                            className="rounded border border-[#bcd2a7] px-1.5 text-xs bg-white hover:bg-[#f7fbf2]"
                            title={expanded[qid] ? "Fechar" : "Abrir"}
                          >
                            {expanded[qid] ? "▲" : "▼"}
                          </button>
                        </td>
                        <td className="py-2 px-3">{q.codigo || q.nome}</td>
                        <td className="py-2 px-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => abrirEditar(q)}
                              className="px-3 py-1 rounded bg-[#f2b705] text-white hover:opacity-90"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => excluir(qid)}
                              className="px-3 py-1 rounded bg-[#e05151] text-white hover:opacity-90"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expanded[qid] && (
                        <tr className="bg-white">
                          <td colSpan={3} className="px-3 py-3">
                            <div className="rounded-lg border border-[#e0efcf] p-3">
                              <div className="text-green-900 font-semibold mb-2">
                                Túmulos da quadra {q.codigo || q.nome}
                              </div>

                              {loadingTumulos[qid] ? (
                                <div className="text-gray-600">Carregando…</div>
                              ) : (tumulosByQuadra[qid] || []).length === 0 ? (
                                <div className="text-gray-600">Nenhum túmulo nesta quadra.</div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="text-left bg-[#eef7e6] text-green-900">
                                        <th className="py-1 px-2 rounded-l">Identificador</th>
                                        <th className="py-1 px-2">Linha</th>
                                        <th className="py-1 px-2">Capacidade</th>
                                        <th className="py-1 px-2 rounded-r">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(tumulosByQuadra[qid] || []).map((t, i2) => {
                                        const backendStatus =
                                          t.status ??
                                          t.status_display ??
                                          t.status_text ??
                                          t.status_label;
                                        const status =
                                          normalizeStatus(backendStatus) ??
                                          (t.reservado
                                            ? "reservado"
                                            : Number(t.sepultados_total || 0) > 0
                                            ? "ocupado"
                                            : "disponivel");

                                        return (
                                          <tr key={t.id ?? i2} className="border-t">
                                            <td className="py-1 px-2">{t.identificador || t.nome || "-"}</td>
                                            <td className="py-1 px-2">
                                              {t.usar_linha && (t.linha || t.linha === 0) ? t.linha : "-"}
                                            </td>
                                            <td className="py-1 px-2">
                                              {t.capacidade || t.capacidade === 0 ? t.capacidade : "-"}
                                            </td>
                                            <td className="py-1 px-2">
                                              <StatusPill status={status} />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {filtrados.length === 0 && (
                  <tr>
                    <td className="py-6 px-3 text-gray-600" colSpan={3}>
                      Nada encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {erro && itens.length > 0 && <div className="text-red-600 mt-3">{erro}</div>}
      </div>

      {/* Modal criar/editar */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-900">
                {editando ? "Editar Quadra" : "Nova Quadra"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-green-900 mb-1">Código*</label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="Ex.: QD-01"
                />
              </div>

              {/* NOVO: Coordenadas (opcional) */}
              <div>
                <label className="block text-sm text-green-900 mb-1">
                  Coordenadas (lat,lng) — polígono (opcional)
                </label>
                <textarea
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none font-mono text-xs"
                  rows={6}
                  value={form.coordsText}
                  onChange={(e) => setForm({ ...form, coordsText: e.target.value })}
                  placeholder='Ex.: -23.43, -51.93; -23.44, -51.92; ...  ou  [{"lat":-23.43,"lng":-51.93}]'
                />
              </div>

              {/* NOVO: Ângulo (opcional) */}
              <div>
                <label className="block text-sm text-green-900 mb-1">
                  Ângulo dos Túmulos (0–360) — opcional
                </label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  step="0.1"
                  className="w-40 border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.angulo}
                  onChange={(e) => setForm({ ...form, angulo: e.target.value })}
                  placeholder="Ex.: 250"
                />
              </div>
            </div>

            {erro && <div className="text-red-600 mt-3">{erro}</div>}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#bcd2a7] text-green-900 hover:bg-[#f0f8ea]"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
