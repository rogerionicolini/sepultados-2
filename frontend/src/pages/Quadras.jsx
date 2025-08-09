// src/pages/Quadras.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";
const ENDPOINT = "quadras/";

// Lê o cemitério ativo do localStorage (aceita os dois formatos usados no app)
function getCemiterioAtivo() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.id) return { id: Number(o.id), nome: o.nome || "Cemitério" };
    }
  } catch {}
  const id = localStorage.getItem("cemiterioAtivoId");
  const nome = localStorage.getItem("cemiterioAtivoNome");
  if (id) return { id: Number(id), nome: nome || "Cemitério" };
  return null;
}

export default function Quadras() {
  const [prefeituraId, setPrefeituraId] = useState(null);
  const [cemAtivo, setCemAtivo] = useState(getCemiterioAtivo());

  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ codigo: "" });

  const token = localStorage.getItem("accessToken");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  // -------- helpers (mesmo padrão do Cemitérios: usa ?prefeitura=) ----------
  const listar = async () => {
    // sempre filtra pelo cemitério ativo se existir
    const qs = new URLSearchParams();
    if (prefeituraId) qs.set("prefeitura", prefeituraId);
    if (cemAtivo?.id) qs.set("cemiterio", cemAtivo.id);

    const url = qs.toString()
      ? `${ENDPOINT}?${qs.toString()}`
      : ENDPOINT;

    const res = await api.get(url);
    const data = res.data;
    return Array.isArray(data) ? data : data?.results ?? [];
  };

  const criar = (payload) => {
    const qs = prefeituraId ? `?prefeitura=${prefeituraId}` : "";
    return api.post(`${ENDPOINT}${qs}`, payload, {
      headers: { "Content-Type": "application/json" },
    });
  };

  const atualizar = (id, payload) => {
    const qs = prefeituraId ? `?prefeitura=${prefeituraId}` : "";
    return api.put(`${ENDPOINT}${id}/${qs}`, payload, {
      headers: { "Content-Type": "application/json" },
    });
  };

  const deletar = (id) => {
    const qs = prefeituraId ? `?prefeitura=${prefeituraId}` : "";
    return api.delete(`${ENDPOINT}${id}/${qs}`);
  };

  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const data = await listar();
      setItens(data);
    } catch (e) {
      console.error("listar ERRO:", e?.response?.status, e?.response?.data || e);
      setErro("Não foi possível carregar as quadras.");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }

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

  // Ouve troca do cemitério (seletor)
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

  // --------- ações ---------
  function abrirCriar() {
    setEditando(null);
    setForm({ codigo: "" });
    setErro("");
    setModalOpen(true);
  }

  function abrirEditar(item) {
    setEditando(item);
    setForm({ codigo: item.codigo || item.nome || "" });
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

      const payload = {
        codigo: (form.codigo || "").trim(),
        cemiterio: Number(cemAtivo.id),
        // não enviamos prefeitura no payload para evitar erro de campo desconhecido
      };

      if (!payload.codigo) return setErro("Informe o código da quadra.");

      const id = editando?.id ?? editando?.pk;
      if (id) {
        await atualizar(id, payload); // PUT (padrão do Cemitérios)
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

  // Sem cemitério = aviso imediato
  if (!cemAtivo?.id) {
    return (
      <div className="text-sm text-red-600">
        Selecione um cemitério para gerenciar as quadras.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header (mesmo padrão do Cemitérios) */}
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
                  <th className="py-2 px-3 rounded-l-lg">Código</th>
                  <th className="py-2 px-3 w-40 rounded-r-lg">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((q, idx) => {
                  const id = q.id ?? q.pk;
                  return (
                    <tr
                      key={id ?? `${q.codigo || q.nome}-${idx}`}
                      className="border-top border-[#d8e9c0] hover:bg-white"
                    >
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
                    <td className="py-6 px-3 text-gray-600" colSpan={2}>
                      Nada encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {erro && itens.length > 0 && (
          <div className="text-red-600 mt-3">{erro}</div>
        )}
      </div>

      {/* Modal criar/editar (mesma paleta do Cemitérios) */}
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
