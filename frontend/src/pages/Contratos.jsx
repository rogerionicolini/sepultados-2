// src/pages/Contratos.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FormularioContrato from "../components/FormularioContrato";

const API_BASE = "http://localhost:8000/api/";
const CONTRATOS_EP = "contratos/";
const TUMULOS_EP = "tumulos/";

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
  // CNPJ
  if (s.length <= 2) return s;
  if (s.length <= 5) return `${s.slice(0, 2)}.${s.slice(2)}`;
  if (s.length <= 8) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5)}`;
  if (s.length <= 12)
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8)}`;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(
    8,
    12
  )}-${s.slice(12, 14)}`;
};

const fmtDate = (d) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? d : dt.toISOString().slice(0, 10);
};

export default function Contratos() {
  const [modoFormulario, setModoFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [contratos, setContratos] = useState([]);
  const [tumulosMap, setTumulosMap] = useState(new Map());
  const [busca, setBusca] = useState("");

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const cemiterioId = getCemiterioAtivoId();

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

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

  async function carregarTumulosMap() {
    try {
      const qs = new URLSearchParams();
      if (cemiterioId) qs.set("cemiterio", cemiterioId);
      const url = qs.toString() ? `${TUMULOS_EP}?${qs}` : TUMULOS_EP;

      const { data } = await api.get(url);
      const arr = Array.isArray(data) ? data : data?.results ?? [];
      const m = new Map();
      arr.forEach((t) => {
        const id = t.id ?? t.pk;
        const base = t.identificador || t.codigo || t.nome || `Túmulo ${id}`;
        const linha = t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "";
        const q = t.quadra?.codigo || t.quadra?.nome || t.quadra?.id || null;
        const label = q ? `Q ${q} - ${base}${linha}` : `${base}${linha}`;
        m.set(String(id), label);
      });
      setTumulosMap(m);
    } catch (e) {
      console.warn("tumulos map ERRO:", e?.response?.status || e);
    }
  }

  useEffect(() => {
    if (!modoFormulario) {
      Promise.all([buscarContratos(), carregarTumulosMap()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoFormulario, cemiterioId]);

  function tumuloLabel(s) {
    if (s?.tumulo && typeof s.tumulo === "object") {
      const t = s.tumulo;
      const base = t.identificador || t.codigo || t.nome || t.id || "-";
      const linha = t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "";
      const q = t.quadra?.codigo || t.quadra?.nome || t.quadra?.id || null;
      return q ? `Q ${q} - ${base}${linha}` : `${base}${linha}`;
    }
    if (s?.tumulo) return tumulosMap.get(String(s.tumulo)) || "Não encontrado";
    return s?.tumulo_label || "Não encontrado";
  }

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contratos;
    return contratos.filter((c) => {
      const num = (c.numero_contrato || "").toString().toLowerCase();
      const nome = (c.nome || "").toString().toLowerCase();
      const doc = (c.documento || "").toString().toLowerCase();
      const tum = tumuloLabel(c).toString().toLowerCase();
      return num.includes(q) || nome.includes(q) || doc.includes(q) || tum.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratos, busca, tumulosMap]);

  async function excluir(id) {
    if (!window.confirm("Excluir este contrato?")) return;
    try {
      await api.delete(`${CONTRATOS_EP}${id}/`);
      await buscarContratos();
    } catch (e) {
      console.error("excluir contrato ERRO:", e?.response?.data || e);
      alert("Não foi possível excluir. Verifique se há receitas ou sepultados vinculados.");
    }
  }

  async function abrirPDF(row) {
    const id = row.id ?? row.pk;
    const tentativas = [
      `${CONTRATOS_EP}${id}/pdf/`,
      `${CONTRATOS_EP}${id}/relatorio_pdf/`,
      `${CONTRATOS_EP}${id}/report/`,
    ];
    for (const url of tentativas) {
      try {
        const res = await api.get(url, { responseType: "blob" });
        const ct = res?.headers?.["content-type"] || "";
        if (ct.includes("pdf")) {
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
          return;
        }
      } catch {}
    }
    alert("Não foi possível gerar o PDF deste contrato.");
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
            }}
            onSuccess={() => {
              setModoFormulario(false);
              setEditandoId(null);
              buscarContratos();
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
                onClick={() => {
                  setEditandoId(null);
                  setModoFormulario(true);
                }}
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
                      return (
                        <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                          <td className="py-2 px-3">{c.numero_contrato || "-"}</td>
                          <td className="py-2 px-3">{c.nome || "-"}</td>
                          <td className="py-2 px-3">{maskDoc(c.documento || "")}</td>
                          <td className="py-2 px-3">{fmtDate(c.data_contrato)}</td>
                          <td className="py-2 px-3">{tumuloLabel(c)}</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => abrirPDF(c)}
                                className="px-3 py-1 rounded border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
                                title="Abrir relatório (PDF)"
                              >
                                Relatório
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
