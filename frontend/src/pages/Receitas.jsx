// src/pages/Receitas.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FormularioReceita from "../components/FormularioReceita";

const API_BASE = "http://127.0.0.1:8000/api/";

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

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Receitas() {
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

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [filtroStatus, setFiltroStatus] = useState("todos"); // todos | aberto | parcial | pago
  const [busca, setBusca] = useState("");

  const [modoForm, setModoForm] = useState(false);
  const [editId, setEditId] = useState(null);

  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const params = cemiterioId ? { cemiterio: cemiterioId } : {};
      const { data } = await api.get("receitas/", { params });
      const arr = Array.isArray(data) ? data : data?.results ?? [];
      setRows(arr);
    } catch (e) {
      console.error(e?.response?.data || e);
      setErro("Erro ao carregar receitas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!modoForm) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cemiterioId, modoForm]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroStatus !== "todos" && r.status !== filtroStatus) return false;
      if (!q) return true;
      const alvo = [
        (r.numero_documento || "").toString(),
        (r.descricao || "").toString(),
        (r.nome || "").toString(),
        (r.cpf || "").toString(),
      ]
        .join(" ")
        .toLowerCase();
      return alvo.includes(q);
    });
  }, [rows, busca, filtroStatus]);

  async function excluir(id) {
    if (!window.confirm("Excluir esta receita?")) return;
    try {
      await api.delete(`receitas/${id}/`);
      carregar();
    } catch (e) {
      alert(e?.response?.data?.detail || "Não foi possível excluir.");
    }
  }

  async function abrirPDF(row) {
    const id = row.id ?? row.pk;
    const tries = [
      `receitas/${id}/pdf/`,
      `receitas/${id}/recibo_pdf/`,
      `receitas/${id}/recibo/`,
      `receitas/${id}/report/`,
    ];
    for (const url of tries) {
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
      {modoForm ? (
        <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-md">
          <FormularioReceita
            receitaId={editId}
            onCancel={() => {
              setModoForm(false);
              setEditId(null);
            }}
            onSuccess={() => {
              setModoForm(false);
              setEditId(null);
              carregar();
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-green-900">Receitas</h1>
            <div className="flex gap-2">
              {/* criação via API não foi prevista no seu model (campos readonly).
                  Se quiser habilitar "Nova Receita Diversa", me diga que eu preparo um fluxo dedicado. */}
              <button
                onClick={carregar}
                className="bg-[#688f53] text-white px-4 py-2 rounded-xl shadow hover:opacity-90"
              >
                Atualizar
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-[#f0f8ea] rounded-xl p-4 shadow">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  placeholder="Buscar por nº, descrição, nome, CPF/CNPJ…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
                >
                  <option value="todos">Todos</option>
                  <option value="aberto">Aberto</option>
                  <option value="parcial">Parcial</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
            </div>

            {/* Resumo simples */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
                <div className="text-xs text-green-900">Total</div>
                <div className="text-xl font-semibold">{filtrados.length}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
                <div className="text-xs text-green-900">Abertas</div>
                <div className="text-xl font-semibold">
                  {filtrados.filter((r) => r.status === "aberto").length}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
                <div className="text-xs text-green-900">Parciais</div>
                <div className="text-xl font-semibold">
                  {filtrados.filter((r) => r.status === "parcial").length}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
                <div className="text-xs text-green-900">Pagas</div>
                <div className="text-xl font-semibold">
                  {filtrados.filter((r) => r.status === "pago").length}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
                <div className="text-xs text-green-900">Somatório</div>
                <div className="text-xl font-semibold">
                  {fmtMoney(
                    filtrados.reduce(
                      (acc, it) => acc + Number(it.valor_total || 0),
                      0
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-[#f0f8ea] rounded-xl p-4 shadow">
            {erro && <div className="text-red-600 mb-2">{erro}</div>}

            {loading ? (
              <div className="text-gray-600">Carregando…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-green-900 bg-[#e6f3d7]">
                      <th className="py-2 px-3 rounded-l-lg">Nº</th>
                      <th className="py-2 px-3">Vencimento</th>
                      <th className="py-2 px-3">Descrição</th>
                      <th className="py-2 px-3">Nome</th>
                      <th className="py-2 px-3">CPF/CNPJ</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Total</th>
                      <th className="py-2 px-3">Pago</th>
                      <th className="py-2 px-3">Em aberto</th>
                      <th className="py-2 px-3 rounded-r-lg w-64">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50">
                    {filtrados.map((r, i) => {
                      const id = r.id ?? r.pk ?? i;
                      return (
                        <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                          <td className="py-2 px-3">{r.numero_documento || "-"}</td>
                          <td className="py-2 px-3">{r.data_vencimento || "-"}</td>
                          <td className="py-2 px-3">{r.descricao || "-"}</td>
                          <td className="py-2 px-3">{r.nome || "-"}</td>
                          <td className="py-2 px-3">{r.cpf || "-"}</td>
                          <td className="py-2 px-3 capitalize">{r.status || "-"}</td>
                          <td className="py-2 px-3">{fmtMoney(r.valor_total)}</td>
                          <td className="py-2 px-3">{fmtMoney(r.valor_pago)}</td>
                          <td className="py-2 px-3">{fmtMoney(r.valor_em_aberto)}</td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => abrirPDF(r)}
                                className="px-3 py-1 rounded border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
                              >
                                Recibo
                              </button>
                              <button
                                onClick={() => {
                                  setEditId(id);
                                  setModoForm(true);
                                }}
                                className="px-3 py-1 rounded bg-[#f2b705] text-white hover:opacity-90"
                              >
                                Receber
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
                        <td colSpan={10} className="py-6 px-3 text-gray-600">
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
