// src/pages/Exumacoes.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import FormularioExumacao from "../components/FormularioExumacao";

const API_BASE = "http://127.0.0.1:8000/api/";
const EXUMACOES_EP = "exumacoes/";
const SEPULTADOS_EP = "sepultados/";
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

const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toISOString().slice(0, 10);
};

export default function Exumacoes() {
  const [modoFormulario, setModoFormulario] = useState(false);
  const [editId, setEditId] = useState(null);

  const [rows, setRows] = useState([]);
  const [busca, setBusca] = useState("");
  const [sepMap, setSepMap] = useState(new Map());
  const [tumMap, setTumMap] = useState(new Map());
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const cemiterioId = getCemiterioAtivoId();

  const [search] = useSearchParams();
  const navigate = useNavigate();

  const api = useMemo(() => {
    const a = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${token}` },
    });
    a.interceptors.request.use((cfg) => {
      if ((cfg.method || "get").toLowerCase() === "get") {
        const hasQuery = cfg.url && cfg.url.includes("?");
        const sep = hasQuery ? "&" : "?";
        cfg.url = `${cfg.url}${sep}_ts=${Date.now()}`;
      }
      return cfg;
    });
    return a;
  }, [token]);


  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const params = cemiterioId ? { cemiterio: cemiterioId } : {};
      const { data } = await api.get(EXUMACOES_EP, { params });
      const arr = Array.isArray(data) ? data : data?.results ?? [];
      setRows(arr);
    } catch (e) {
      setErro("Erro ao carregar exumações.");
    } finally {
      setLoading(false);
    }
  }
  async function carregarMaps() {
    try {
      const params = cemiterioId ? { cemiterio: cemiterioId } : {};
      const [sRes, tRes] = await Promise.all([
        api.get(SEPULTADOS_EP, { params }),
        api.get(TUMULOS_EP, { params }),
      ]);
      const sArr = Array.isArray(sRes.data) ? sRes.data : sRes.data?.results ?? [];
      const tArr = Array.isArray(tRes.data) ? tRes.data : tRes.data?.results ?? [];
      const sm = new Map();
      sArr.forEach((s) =>
        sm.set(String(s.id ?? s.pk), s.nome || s.identificador || `#${s.id}`)
      );
      const tm = new Map();
      tArr.forEach((t) =>
        tm.set(
          String(t.id ?? t.pk),
          (t.quadra?.codigo ? `Q ${t.quadra.codigo} - ` : "") +
            (t.identificador || t.codigo || t.nome || t.id)
        )
      );
      setSepMap(sm);
      setTumMap(tm);
    } catch {}
  }

  useEffect(() => {
    if (!modoFormulario) {
      Promise.all([carregar(), carregarMaps()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoFormulario, cemiterioId]);

  // abrir automaticamente quando vier ?novo=1
  useEffect(() => {
    if (search.get("novo") === "1") {
      setEditId(null);
      setModoFormulario(true);
    }
  }, [search]);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const nd = (r.numero_documento || "").toString().toLowerCase();
      const dt = fmtDate(r.data).toLowerCase();
      const sep = r.sepultado?.nome || sepMap.get(String(r.sepultado)) || "";
      const tum = r.tumulo?.identificador || tumMap.get(String(r.tumulo)) || "";
      return (
        nd.includes(q) ||
        dt.includes(q) ||
        sep.toLowerCase().includes(q) ||
        tum.toLowerCase().includes(q)
      );
    });
  }, [rows, busca, sepMap, tumMap]);

  async function excluir(id) {
    if (!window.confirm("Excluir esta exumação?")) return;
    try {
      await api.delete(`${EXUMACOES_EP}${id}/`);
      carregar();
    } catch (e) {
      alert(
        e?.response?.data?.detail ||
          "Não foi possível excluir. Verifique se há receita vinculada."
      );
    }
  }

  async function abrirPDF(row) {
    const id = row.id ?? row.pk;
    const tentativas = [
      `${EXUMACOES_EP}${id}/pdf/`,
      `${EXUMACOES_EP}${id}/relatorio_pdf/`,
      `${EXUMACOES_EP}${id}/report/`,
    ];
    for (const url of tentativas) {
      try {
        const res = await api.get(url, { responseType: "blob" });
        const ct = res?.headers?.["content-type"] || "";
        if (ct.includes("pdf")) {
          const blob = new Blob([res.data], { type: "application/pdf" });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, "_blank");
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          return;
        }
      } catch {}
    }
    alert("Não foi possível gerar o PDF.");
  }

  return (
    <div className="p-6">
      {modoFormulario ? (
        <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-md">
          <FormularioExumacao
            exumacaoId={editId}
            onCancel={() => {
              setModoFormulario(false);
              setEditId(null);
              navigate("/exumacoes", { replace: true }); // limpa ?novo=1
            }}
            onSuccess={() => {
              setModoFormulario(false);
              setEditId(null);
              carregar();
              navigate("/exumacoes", { replace: true }); // limpa ?novo=1
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-green-900">Exumações</h1>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/exumacoes?novo=1")}
                className="bg-green-800 text-white px-4 py-2 rounded-xl shadow hover:bg-green-700"
              >
                Adicionar
              </button>
              <button
                onClick={carregar}
                className="bg-[#688f53] text-white px-4 py-2 rounded-xl shadow hover:opacity-90"
              >
                Atualizar
              </button>
            </div>
          </div>

          <div className="bg-[#f0f8ea] rounded-xl p-4 shadow">
            <div className="mb-4">
              <input
                className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                placeholder="Buscar por nº doc., data, sepultado ou túmulo…"
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
                      <th className="py-2 px-3 rounded-l-lg">Nº Doc.</th>
                      <th className="py-2 px-3">Data</th>
                      <th className="py-2 px-3">Sepultado</th>
                      <th className="py-2 px-3">Túmulo Origem</th>
                      <th className="py-2 px-3 rounded-r-lg w-56">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50">
                    {filtrados.map((r, i) => {
                      const id = r.id ?? r.pk ?? i;
                      const sep =
                        r.sepultado?.nome || sepMap.get(String(r.sepultado)) || "-";
                      const tum =
                        r.tumulo?.identificador || tumMap.get(String(r.tumulo)) || "-";
                      return (
                        <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                          <td className="py-2 px-3">{r.numero_documento || "-"}</td>
                          <td className="py-2 px-3">{fmtDate(r.data)}</td>
                          <td className="py-2 px-3">{sep}</td>
                          <td className="py-2 px-3">{tum}</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => abrirPDF(r)}
                                className="px-3 py-1 rounded border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
                              >
                                Imprimir
                              </button>
                              <button
                                onClick={() => {
                                  setEditId(id);
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
                        <td colSpan={5} className="py-6 px-3 text-gray-600">
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
