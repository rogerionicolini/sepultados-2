// src/pages/Tumulos.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getCemiterioAtivo } from "../utils/cemiterioStorage";

/* ----------------- CONFIG API ----------------- */
const API_BASE = "http://127.0.0.1:8000/api/";
const TUMULOS_EP = "tumulos/";
const QUADRAS_EP = "quadras/";

/* ----------------- HELPERS ----------------- */
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

function QuadraDropdown({ options, value, onChange }) {
  return (
    <select
      className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value) || null)}
    >
      <option value="">Selecione…</option>
      {(options || []).map((q) => (
        <option key={q.id} value={q.id}>
          {q.codigo || q.nome || `#${q.id}`}
        </option>
      ))}
    </select>
  );
}

/* converte "2,70" -> "2.70" e mantém vazio se não tiver valor */
function normalizeDecimalStr(v) {
  if (v === null || v === undefined || v === "") return "";
  return String(v).replace(",", ".").trim();
}

/* parse "lat, lng" para objeto ou null; vazio => null */
function parseLatLng(text) {
  if (!text || !String(text).trim()) return null;
  const m = String(text).trim().match(
    /^\s*\(?\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*\)?\s*$/
  );
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/* ----------------- COMPONENTE ----------------- */
export default function Tumulos() {
  const [cemAtivo, setCemAtivo] = useState(getCemiterioAtivo());
  const [prefeituraId, setPrefeituraId] = useState(null);

  const [items, setItems] = useState([]);
  const [quadras, setQuadras] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    identificador: "",
    tipo_estrutura: "tumulo",
    usar_linha: false,
    linha: "",
    reservado: false,
    motivo_reserva: "",
    capacidade: "",
    quadra: null,
    // novos:
    angulo_graus: "",
    comprimento_m: "",
    largura_m: "",
    coordenada: "",
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

  /* --------------- API --------------- */
  const listar = async () => {
    const url = qsWith(TUMULOS_EP, { cemiterio: cemAtivo?.id });
    const r = await api.get(url);
    const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
    return data;
  };

  const listarQuadras = async () => {
    const url = qsWith(QUADRAS_EP, { cemiterio: cemAtivo?.id });
    const r = await api.get(url);
    const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
    return data;
  };

  const criar = (payload) =>
    api.post(qsWith(TUMULOS_EP, { cemiterio: cemAtivo?.id }), payload, {
      headers: { "Content-Type": "application/json" },
    });

  const atualizar = (id, payload) =>
    api.put(qsWith(`${TUMULOS_EP}${id}/`, { cemiterio: cemAtivo?.id }), payload, {
      headers: { "Content-Type": "application/json" },
    });

  const deletar = (id) =>
    api.delete(qsWith(`${TUMULOS_EP}${id}/`, { cemiterio: cemAtivo?.id }));

  /* --------------- LOADERS --------------- */
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
      setItems([]);
      setQuadras([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErro("");
      const [ts, qs] = await Promise.all([listar(), listarQuadras()]);
      setItems(ts);
      setQuadras(qs);
    } catch (e) {
      console.error("listar ERRO:", e?.response?.status, e?.response?.data || e);
      setErro("Não foi possível carregar os túmulos.");
      setItems([]);
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
    if (!q) return items;
    return items.filter((x) =>
      (x.identificador || x.nome || "").toString().toLowerCase().includes(q)
    );
  }, [items, busca]);

  /* --------------- UI ACTIONS --------------- */
  function abrirCriar() {
    setEditando(null);
    setForm({
      identificador: "",
      tipo_estrutura: "tumulo",
      usar_linha: false,
      linha: "",
      reservado: false,
      motivo_reserva: "",
      capacidade: "",
      quadra: null,
      angulo_graus: "",
      comprimento_m: "2",
      largura_m: "1",
      coordenada: "",
    });
    setErro("");
    setModalOpen(true);
  }

  function abrirEditar(t) {
    // tenta extrair coordenada para string
    let coordStr = "";
    const loc = t.localizacao || t.posicao || null;
    if (loc && typeof loc === "object" && "lat" in loc && "lng" in loc) {
      coordStr = `${loc.lat}, ${loc.lng}`;
    }

    setEditando(t);
    setForm({
      identificador: t.identificador || t.nome || "",
      tipo_estrutura: t.tipo_estrutura || "tumulo",
      usar_linha: !!t.usar_linha,
      linha: t.linha ?? "",
      reservado: !!t.reservado,
      motivo_reserva: t.motivo_reserva || "",
      capacidade: t.capacidade ?? "",
      quadra: t.quadra?.id ?? t.quadra ?? null,
      angulo_graus:
        t.angulo_graus === 0 || t.angulo_graus ? String(t.angulo_graus) : "",
      comprimento_m:
        t.comprimento_m === 0 || t.comprimento_m ? String(t.comprimento_m) : "",
      largura_m:
        t.largura_m === 0 || t.largura_m ? String(t.largura_m) : "",
      coordenada: coordStr,
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
      if (!form.identificador?.trim()) {
        setErro("Informe o identificador.");
        return;
      }
      if (!form.quadra) {
        setErro("Selecione a quadra.");
        return;
      }
      if (form.reservado && !form.motivo_reserva?.trim()) {
        setErro("Informe o motivo da reserva.");
        return;
      }

      // monta payload
      const payload = {
        identificador: form.identificador.trim(),
        tipo_estrutura: form.tipo_estrutura || "tumulo",
        usar_linha: !!form.usar_linha,
        linha:
          form.usar_linha && form.linha !== "" && form.linha !== null
            ? Number(form.linha)
            : null,
        reservado: !!form.reservado,
        motivo_reserva: form.motivo_reserva || "",
        capacidade:
          form.capacidade !== "" && form.capacidade !== null
            ? Number(form.capacidade)
            : 1,
        quadra: Number(form.quadra),
        cemiterio: Number(cemAtivo.id),

        // novos:
        comprimento_m: normalizeDecimalStr(form.comprimento_m) || undefined,
        largura_m: normalizeDecimalStr(form.largura_m) || undefined,
      };

      // ângulo do túmulo (opcional). Só envia se houver.
      if (form.angulo_graus !== "" && form.angulo_graus !== null) {
        const n = Number(form.angulo_graus);
        if (Number.isFinite(n)) {
          payload["angulo_graus"] = n; // se o backend tiver esse campo, salva; se não tiver, basta remover esta linha
        }
      }

      // localizacao a partir da coordenada (lat,lng). Se vazio => null
      const loc = parseLatLng(form.coordenada);
      payload["localizacao"] = loc ? { lat: loc.lat, lng: loc.lng } : null;

      const id = editando?.id ?? editando?.pk;
      if (id) await atualizar(id, payload);
      else await criar(payload);

      setModalOpen(false);
      await carregar();
    } catch (e) {
      console.error("salvar ERRO:", e?.response?.status, e?.response?.data || e);
      setErro(
        e?.response?.data
          ? "Erro ao salvar: " + JSON.stringify(e.response.data)
          : "Erro ao salvar."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    if (!window.confirm("Excluir este túmulo?")) return;
    try {
      await deletar(id);
      await carregar();
    } catch (e) {
      console.error("excluir ERRO:", e?.response?.status, e?.response?.data || e);
      alert("Erro ao excluir.");
    }
  }

  /* --------------- RENDER --------------- */
  if (!cemAtivo?.id) {
    return (
      <div className="text-sm text-red-600">
        Selecione um cemitério para gerenciar os túmulos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">Túmulos</h2>
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
            placeholder="Buscar por identificador..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-gray-600 px-1">Carregando…</div>
        ) : erro && items.length === 0 ? (
          <div className="text-red-600 px-1">{erro}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-green-900 bg-[#e6f3d7]">
                  <th className="py-2 px-3">Identificador</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Quadra</th>
                  <th className="py-2 px-3">Contrato</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 w-40">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((t, i) => {
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
                    <tr key={t.id ?? i} className="border-t border-[#d8e9c0]">
                      <td className="py-2 px-3">{t.identificador || "-"}</td>
                      <td className="py-2 px-3">{t.tipo_estrutura || "-"}</td>
                      <td className="py-2 px-3">
                        {t.quadra?.codigo || t.quadra_nome || "-"}
                      </td>
                      <td className="py-2 px-3">{t.contrato_numero || "-"}</td>
                      <td className="py-2 px-3">
                        <StatusPill status={status} />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => abrirEditar(t)}
                            className="px-3 py-1 rounded bg-[#f2b705] text-white hover:opacity-90"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluir(t.id)}
                            className="px-3 py-1 rounded bg-[#e05151] text-white hover:opacity-90"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtrados.length === 0 && (
                  <tr>
                    <td className="py-6 px-3 text-gray-600" colSpan={6}>
                      Nada encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {erro && items.length > 0 && (
          <div className="text-red-600 mt-3">{erro}</div>
        )}
      </div>

      {/* -------- MODAL CRIAR/EDITAR -------- */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          {/* modal "quadrado" + rolagem interna */}
          <div className="w-[92vw] max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
            {/* header */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-green-900">
                {editando ? "Editar Túmulo" : "Novo Túmulo"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* body (rolável) */}
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm text-green-900 mb-1">
                  Identificador*
                </label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.identificador}
                  onChange={(e) =>
                    setForm({ ...form, identificador: e.target.value })
                  }
                  placeholder="Ex.: T-001"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-green-900 mb-1">
                    Tipo de estrutura
                  </label>
                  <select
                    className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
                    value={form.tipo_estrutura}
                    onChange={(e) =>
                      setForm({ ...form, tipo_estrutura: e.target.value })
                    }
                  >
                    {[
                      { value: "tumulo", label: "Túmulo" },
                      { value: "perpetua", label: "Perpétua" },
                      { value: "sepultura", label: "Sepultura" },
                      { value: "jazigo", label: "Jazigo" },
                      { value: "gaveta", label: "Gaveta" },
                      { value: "outro", label: "Outro" },
                    ].map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-green-900 mb-1">
                    Quadra*
                  </label>
                  <QuadraDropdown
                    options={quadras}
                    value={form.quadra}
                    onChange={(id) => setForm({ ...form, quadra: id })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="usar_linha"
                  type="checkbox"
                  checked={form.usar_linha}
                  onChange={(e) =>
                    setForm({ ...form, usar_linha: e.target.checked })
                  }
                />
                <label htmlFor="usar_linha" className="text-sm text-green-900">
                  Usar linha
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-green-900 mb-1">
                    Linha
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!form.usar_linha}
                    className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none disabled:bg-gray-100"
                    value={form.linha}
                    onChange={(e) =>
                      setForm({ ...form, linha: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-green-900 mb-1">
                    Capacidade de sepultamentos
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                    value={form.capacidade}
                    onChange={(e) =>
                      setForm({ ...form, capacidade: e.target.value })
                    }
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="reservado"
                  type="checkbox"
                  checked={form.reservado}
                  onChange={(e) =>
                    setForm({ ...form, reservado: e.target.checked })
                  }
                />
                <label htmlFor="reservado" className="text-sm text-green-900">
                  Reservar este túmulo
                </label>
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">
                  Motivo da reserva
                </label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.motivo_reserva}
                  onChange={(e) =>
                    setForm({ ...form, motivo_reserva: e.target.value })
                  }
                  placeholder="Opcional (obrigatório se reservar)"
                  disabled={!form.reservado}
                />
              </div>

              {/* NOVOS CAMPOS */}
              <div>
                <label className="block text-sm text-green-900 mb-1">
                  Ângulo do túmulo (°)
                </label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.angulo_graus}
                  onChange={(e) =>
                    setForm({ ...form, angulo_graus: e.target.value })
                  }
                  placeholder="Deixe vazio para herdar da quadra"
                />
                <div className="text-xs text-gray-600 mt-1">
                  Deixe em branco para herdar o ângulo da quadra.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-green-900 mb-1">
                    Comprimento (m)
                  </label>
                  <input
                    className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                    value={form.comprimento_m}
                    onChange={(e) =>
                      setForm({ ...form, comprimento_m: e.target.value })
                    }
                    placeholder="Ex.: 2,00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-green-900 mb-1">
                    Largura (m)
                  </label>
                  <input
                    className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                    value={form.largura_m}
                    onChange={(e) =>
                      setForm({ ...form, largura_m: e.target.value })
                    }
                    placeholder="Ex.: 1,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">
                  Coordenada (lat, lng)
                </label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.coordenada}
                  onChange={(e) =>
                    setForm({ ...form, coordenada: e.target.value })
                  }
                  placeholder="Ex.: -23.43956, -51.92830"
                />
                <div className="text-xs text-gray-600 mt-1">
                  Deixe em branco para <b>limpar</b> a coordenada deste túmulo.
                </div>
              </div>

              {erro && <div className="text-red-600">{erro}</div>}
            </div>

            {/* footer */}
            <div className="px-6 py-4 border-t flex justify-end gap-2">
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
