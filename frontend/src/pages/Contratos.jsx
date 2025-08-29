// src/pages/Contratos.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import FormularioContrato from "../components/FormularioContrato";

const API_BASE = "http://localhost:8000/api/";
const CONTRATOS_EP = "contratos/";
const TUMULOS_EP   = "tumulos/";
const QUADRAS_EP   = "quadras/";

const getToken = () => localStorage.getItem("accessToken") || "";
function getCemiterioAtivoId() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.id) return Number(o.id);
    }
  } catch {}
  const id = localStorage.getItem("cemiterioAtivoId");
  return id ? Number(id) : null;
}

const maskDoc = (v) => {
  const s = (v || "").replace(/\D/g, "");
  if (s.length <= 11) {
    if (s.length <= 3) return s;
    if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3)}`;
    if (s.length <= 9) return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`;
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
  }
  if (s.length <= 2) return s;
  if (s.length <= 5) return `${s.slice(0, 2)}.${s.slice(2)}`;
  if (s.length <= 8) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5)}`;
  if (s.length <= 12)
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8)}`;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12, 14)}`;
};

// >>> ÚNICA MUDANÇA: formatar dd/mm/aaaa sem imports <<<
const fmtDate = (d) => {
  if (!d) return "-";

  // Se vier como 'YYYY-MM-DD' (ou 'YYYY-MM-DDTHH:MM:SS...')
  if (typeof d === "string") {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }

  // Fallback: Date -> dd/mm/aaaa
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt?.getTime?.())) return String(d);
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};
// <<< FIM DA MUDANÇA >>>

// Substitua a função rotuloTumulo atual por esta versão
function rotuloTumulo(t, quadrasMap = new Map()) {
  if (!t) return "";

  const id = t.id ?? t.pk ?? "";
  const base =
    t.identificador || t.codigo || t.nome || `T ${String(id).padStart(2, "0")}`;

  // linha (exibe apenas se usar_linha for true)
  let linhaStr = "";
  const rawLinha =
    typeof t.linha === "object"
      ? t.linha?.id ?? t.linha?.numero ?? t.linha?.codigo
      : t.linha;
  if (t.usar_linha && (rawLinha || rawLinha === 0)) linhaStr = `L ${rawLinha}`;

  // quadra -> sempre como “Quadra 02” ou nome da quadra, sem prefixar “Q ”
  const resolveQuadra = (qInfo) => {
    if (!qInfo) return "";
    if (qInfo.nome) return qInfo.nome; // ex.: "Quadra 02" (já certinho) ou um nome livre
    if (qInfo.codigo != null) {
      const cod = String(qInfo.codigo);
      return /^\d+$/.test(cod) ? `Quadra ${cod.padStart(2, "0")}` : cod;
    }
    if (qInfo.id != null) return `Quadra ${qInfo.id}`;
    return "";
  };

  let quadraStr = "";
  const q = t.quadra;
  if (q) {
    if (typeof q === "object") {
      quadraStr = resolveQuadra(q);
    } else {
      const info = quadrasMap.get(String(q)) || quadrasMap.get(Number(q));
      quadraStr =
        resolveQuadra(info) ||
        (String(q).match(/^\d+$/) ? `Quadra ${String(q).padStart(2, "0")}` : String(q));
    }
  }

  // ORDEM pedida: Túmulo, Linha, Quadra (sem hífen)
  return [base, linhaStr, quadraStr].filter(Boolean).join(" ");
}

export default function Contratos() {
  const [modoFormulario, setModoFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [contratos, setContratos] = useState([]);
  const [tumulosMap, setTumulosMap] = useState(new Map());   // id -> label completo
  const [busca, setBusca] = useState("");

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const cemiterioId = getCemiterioAtivoId();

  const [search] = useSearchParams();
  const navigate = useNavigate();

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  // Interceptor: garante ?cemiterio=<id> em /contratos/*
  useEffect(() => {
    const interceptorId = api.interceptors.request.use((config) => {
      const url = String(config.url || "");
      if (cemiterioId && /(^|\/)contratos(\/|$)/.test(url)) {
        config.params = { ...(config.params || {}), cemiterio: cemiterioId };
      }
      return config;
    });
    return () => api.interceptors.request.eject(interceptorId);
  }, [api, cemiterioId]);

  async function buscarContratos() {
    try {
      setLoading(true);
      setErro("");
      const qs = new URLSearchParams();
      if (cemiterioId) qs.set("cemiterio", cemiterioId);
      const url = qs.toString() ? `${CONTRATOS_EP}?${qs}` : CONTRATOS_EP;

      const { data } = await api.get(url);
      const arr = Array.isArray(data) ? data : data?.results ?? [];
      setContratos(arr);
    } catch (err) {
      console.error("listar contratos ERRO:", err?.response?.data || err);
      setErro("Erro ao carregar contratos.");
    } finally {
      setLoading(false);
    }
  }

  /** Carrega tumulos + quadras e monta um map id -> label completo */
  async function carregarTumulosMap() {
    try {
      const qs = new URLSearchParams();
      if (cemiterioId) qs.set("cemiterio", cemiterioId);
      const urlTum = qs.toString() ? `${TUMULOS_EP}?${qs}` : TUMULOS_EP;
      const urlQua = qs.toString() ? `${QUADRAS_EP}?${qs}` : QUADRAS_EP;

      const [tumulosRes, quadrasRes] = await Promise.all([api.get(urlTum), api.get(urlQua)]);

      const tumArr = Array.isArray(tumulosRes.data) ? tumulosRes.data : tumulosRes.data?.results ?? [];
      const quaArr = Array.isArray(quadrasRes.data) ? quadrasRes.data : quadrasRes.data?.results ?? [];

      // monta mapa de quadras
      const qMap = new Map();
      quaArr.forEach((q) => {
        const qid = String(q.id ?? q.pk);
        qMap.set(qid, { id: q.id ?? q.pk, nome: q.nome, codigo: q.codigo });
      });

      // monta mapa de túmulos com rótulo completo
      const tMap = new Map();
      tumArr.forEach((t) => {
        const id = t.id ?? t.pk;
        tMap.set(String(id), rotuloTumulo(t, qMap));
      });

      setTumulosMap(tMap);
    } catch (e) {
      console.warn("tumulos/quadras map ERRO:", e?.response?.status || e);
      setTumulosMap(new Map());
    }
  }

  useEffect(() => {
    if (!modoFormulario) {
      Promise.all([buscarContratos(), carregarTumulosMap()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoFormulario, cemiterioId]);

  // abrir automaticamente quando vier ?novo=1
  useEffect(() => {
    if (search.get("novo") === "1") {
      setEditandoId(null);
      setModoFormulario(true);
    }
  }, [search]);

  /** Mostra o rótulo do túmulo (prioriza tumulo_label vindo do backend
    e depois o tumulosMap, mesmo quando vier objeto) */
  function tumuloLabel(row) {
    // 1) Se o backend já envia pronto
    if (row?.tumulo_label) return row.tumulo_label;

    // 2) Se veio algo em tumulo (objeto ou id), tenta o map primeiro
    if (row?.tumulo) {
      const tid = typeof row.tumulo === "object" ? (row.tumulo.id ?? row.tumulo.pk) : row.tumulo;
      const fromMap = tid != null ? tumulosMap.get(String(tid)) : undefined;
      if (fromMap) return fromMap;

      // 3) Fallback: montar pelo objeto se ele existir
      if (typeof row.tumulo === "object") return rotuloTumulo(row.tumulo);
    }

    return "-";
  }

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contratos;
    return contratos.filter((c) => {
      const num = (c.numero_contrato || "").toString().toLowerCase();
      const nome = (c.nome || "").toString().toLowerCase();
      const doc = (c.cpf || c.documento || "").toString().toLowerCase();
      const tum = (tumuloLabel(c) || "").toString().toLowerCase();
      return num.includes(q) || nome.includes(q) || doc.includes(q) || tum.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratos, busca, tumulosMap]);

  async function excluir(id) {
    if (!window.confirm("Excluir este contrato?")) return;
    try {
      await api.delete(`${CONTRATOS_EP}${id}/`, { params: { cemiterio: cemiterioId } });
      await buscarContratos();
    } catch (e) {
      const data = e?.response?.data;
      const msg =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data)[0] : null) ||
        "Não foi possível excluir. Verifique se há receitas ou sepultados vinculados.";
      console.error("excluir contrato ERRO:", data || e);
      alert(msg);
    }
  }

  async function abrirPDF(row) {
    const id = row.id ?? row.pk;
    if (!id) {
      alert("ID do contrato não encontrado.");
      return;
    }

    try {
      const res = await api.get(`${CONTRATOS_EP}${id}/pdf/`, {
        responseType: "blob",
        params: { cemiterio: getCemiterioAtivoId() },
      });

      const ct = (res?.headers?.["content-type"] || "").toLowerCase();
      if (!ct.includes("pdf")) throw new Error("Resposta não é PDF");

      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const w = window.open(blobUrl, "_blank");
      if (!w) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `contrato_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e) {
      console.error("PDF contrato ERRO:", e?.response?.data || e);
      alert("Não foi possível gerar o PDF deste contrato.");
    }
  }

  return (
    <div className="p-6">
      {modoFormulario ? (
        <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-md">
          <FormularioContrato
            contratoId={editandoId}
            onCancel={() => {
              setModoFormulario(false);
              setEditandoId(null);
              navigate("/contratos", { replace: true });
            }}
            onSuccess={() => {
              setModoFormulario(false);
              setEditandoId(null);
              buscarContratos();
              navigate("/contratos", { replace: true });
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-green-900">Contratos de Concessão</h1>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/contratos?novo=1")}
                className="bg-green-800 text-white px-4 py-2 rounded-xl shadow hover:bg-green-700"
              >
                Adicionar
              </button>
              <button
                onClick={buscarContratos}
                className="bg-[#688f53] text-white px-4 py-2 rounded-xl shadow hover:opacity-90"
              >
                Atualizar
              </button>
            </div>
          </div>

          {/* Busca + Tabela */}
          <div className="bg-[#f0f8ea] rounded-xl p-4 shadow">
            <div className="flex items-center gap-3 mb-4">
              <input
                className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                placeholder="Buscar por nº, nome, documento ou túmulo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            {erro && <div className="text-red-600 mb-2">{erro}</div>}

            {loading ? (
              <div className="text-gray-600">Carregando…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-green-900 bg-[#e6f3d7]">
                      <th className="py-2 px-3 rounded-l-lg">Nº Contrato</th>
                      <th className="py-2 px-3">Titular</th>
                      <th className="py-2 px-3">Documento</th>
                      <th className="py-2 px-3">Data</th>
                      <th className="py-2 px-3">Túmulo</th>
                      <th className="py-2 px-3 w-56 rounded-r-lg">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50">
                    {filtrados.map((c, idx) => {
                      const id = c.id ?? c.pk ?? idx;
                      const docStr = maskDoc(c.cpf || c.documento || "");
                      return (
                        <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                          <td className="py-2 px-3">{c.numero_contrato || "-"}</td>
                          <td className="py-2 px-3">{c.nome || "-"}</td>
                          <td className="py-2 px-3">{docStr}</td>
                          <td className="py-2 px-3">{fmtDate(c.data_contrato)}</td>
                          <td className="py-2 px-3">{tumuloLabel(c)}</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => abrirPDF(c)}
                                className="px-3 py-1 rounded border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
                                title="Abrir relatório (PDF)"
                              >
                                Imprimir
                              </button>
                              <button
                                onClick={() => {
                                  setEditandoId(id);
                                  setModoFormulario(true);
                                }}
                                className="px-3 py-1 rounded bg-[#f2b705] text-white hover:opacity-90"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => excluir(id)}
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
          </div>
        </div>
      )}
    </div>
  );
}
