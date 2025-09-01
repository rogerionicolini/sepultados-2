// src/pages/Cemiterios.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";
const ENDPOINT = "cemiterios/";

/** -------- helpers de normalização do polígono ---------- */
function stringifyPolygon(pol) {
  try {
    if (!pol) return "";
    return JSON.stringify(pol, null, 2);
  } catch {
    return "";
  }
}
function parsePolygonInput(txt) {
  if (!txt || !txt.trim()) return null;

  // tenta JSON puro
  try {
    const j = JSON.parse(txt);
    if (Array.isArray(j)) return j;
  } catch {
    // segue para tentativa de "lat,lng" por linha
  }

  // alternativa: uma por linha: -23.4,-51.9
  const lines = txt
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length) {
    const pts = [];
    for (const line of lines) {
      const m = line.match(
        /^\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*$/
      );
      if (!m) return null; // formato inválido => deixa para erro no salvar
      pts.push([Number(m[1]), Number(m[2])]);
    }
    return pts;
  }

  return null;
}

export default function Cemiterios() {
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [prefeituraId, setPrefeituraId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    endereco: "",
    telefone: "",
    cidade: "",
    estado: "",
    tempo_minimo_exumacao: "",
    limites_mapa_txt: "", // <<< novo: texto do polígono
  });

  const token = localStorage.getItem("accessToken");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  // -------- helpers (com prefeitura no query) ----------
  const listar = async () => {
    const url = prefeituraId ? `${ENDPOINT}?prefeitura=${prefeituraId}` : ENDPOINT;
    const res = await api.get(url);
    const data = res.data;
    return Array.isArray(data) ? data : data?.results ?? [];
  };

  const criar = (payload) =>
    api.post(
      prefeituraId ? `${ENDPOINT}?prefeitura=${prefeituraId}` : ENDPOINT,
      payload
    );

  const atualizar = (id, payload) =>
    api.put(
      prefeituraId ? `${ENDPOINT}${id}/?prefeitura=${prefeituraId}` : `${ENDPOINT}${id}/`,
      payload
    );

  const deletar = (id) =>
    api.delete(
      prefeituraId ? `${ENDPOINT}${id}/?prefeitura=${prefeituraId}` : `${ENDPOINT}${id}/`
    );

  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const data = await listar();
      setItens(data);
    } catch (e) {
      console.error("listar ERRO:", e?.response?.status, e?.response?.data || e);
      setErro("Não foi possível carregar os cemitérios.");
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

  useEffect(() => {
    carregar();
    carregarPrefeitura();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prefeituraId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefeituraId]);

  const filtrados = itens.filter((x) =>
    (x.nome || "").toLowerCase().includes(busca.toLowerCase())
  );

  function abrirCriar() {
    setEditando(null);
    setForm({
      nome: "",
      endereco: "",
      telefone: "",
      cidade: "",
      estado: "",
      tempo_minimo_exumacao: "",
      limites_mapa_txt: "",
    });
    setErro("");
    setModalOpen(true);
  }

  function abrirEditar(item) {
    setEditando(item);
    setForm({
      nome: item.nome ?? "",
      endereco: item.endereco ?? "",
      telefone: item.telefone ?? "",
      cidade: item.cidade ?? "",
      estado: item.estado ?? "",
      tempo_minimo_exumacao: item.tempo_minimo_exumacao ?? "",
      limites_mapa_txt: stringifyPolygon(item.limites_mapa), // <<< preenche bonito
    });
    setErro("");
    setModalOpen(true);
  }

  async function salvar() {
    try {
      setSalvando(true);
      setErro("");

      const payload = {
        nome: form.nome?.trim(),
        endereco: form.endereco?.trim(),
        telefone: form.telefone?.trim(),
        cidade: form.cidade?.trim(),
        estado: form.estado || "",
        tempo_minimo_exumacao: form.tempo_minimo_exumacao
          ? Number(form.tempo_minimo_exumacao)
          : null,
      };

      // importante pro filtro do ViewSet
      if (prefeituraId) payload.prefeitura = prefeituraId;

      // validações mínimas
      if (!payload.nome) return setErro("Informe o nome.");
      if (!payload.cidade) return setErro("Informe a cidade.");
      if (!payload.estado) return setErro("Informe o estado (UF).");

      // trata limites do mapa (opcional)
      if (form.limites_mapa_txt && form.limites_mapa_txt.trim()) {
        const pol = parsePolygonInput(form.limites_mapa_txt.trim());
        if (!pol) {
          return setErro(
            "Limites do mapa inválidos. Use JSON ([{lat,lng},...]/[[-23.4,-51.9],...]) ou 'lat,lng' uma coordenada por linha."
          );
        }
        payload.limites_mapa = pol;
      } else {
        payload.limites_mapa = null;
      }

      const id = editando?.id ?? editando?.pk;
      if (id) {
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
    if (!window.confirm("Excluir este cemitério?")) return;
    try {
      await deletar(id);
      await carregar();
    } catch (e) {
      console.error("excluir ERRO:", e?.response?.status, e?.response?.data || e);
      alert("Erro ao excluir.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com busca à esquerda e ações à direita */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">Cemitérios</h2>

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
            placeholder="Buscar por nome..."
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
                  <th className="py-2 px-3 rounded-l-lg">Nome</th>
                  <th className="py-2 px-3">Cidade</th>
                  <th className="py-2 px-3">Estado</th>
                  <th className="py-2 px-3">Telefone</th>
                  <th className="py-2 px-3 w-52 rounded-r-lg">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((c, idx) => {
                  const id = c.id ?? c.pk;
                  return (
                    <tr
                      key={id ?? `${c.nome}-${c.cidade}-${idx}`}
                      className="border-t border-[#d8e9c0] hover:bg-white"
                    >
                      <td className="py-2 px-3">{c.nome}</td>
                      <td className="py-2 px-3">{c.cidade || "-"}</td>
                      <td className="py-2 px-3">{c.estado || "-"}</td>
                      <td className="py-2 px-3">{c.telefone || "-"}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => abrirEditar(c)}
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
                    <td className="py-6 px-3 text-gray-600" colSpan={5}>
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

      {/* Modal criar/editar */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-900">
                {editando ? "Editar Cemitério" : "Novo Cemitério"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-green-900 mb-1">Nome*</label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-green-900 mb-1">Endereço</label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">Telefone</label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">Cidade*</label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">Estado (UF)*</label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  placeholder="Ex.: PR"
                />
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">
                  Tempo mínimo p/ exumação (meses)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.tempo_minimo_exumacao}
                  onChange={(e) =>
                    setForm({ ...form, tempo_minimo_exumacao: e.target.value })
                  }
                />
              </div>

              {/* --------- NOVO: limites do mapa --------- */}
              <div className="md:col-span-2">
                <label className="block text-sm text-green-900 mb-1">
                  Limites do mapa (opcional)
                </label>
                <textarea
                  rows={6}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 font-mono text-xs outline-none"
                  placeholder={`Exemplos válidos:
[{"lat": -23.43, "lng": -51.93}, {"lat": -23.44, "lng": -51.94}]
ou
[[-23.43, -51.93], [-23.44, -51.94]]
ou ainda uma coordenada por linha:
-23.43,-51.93
-23.44,-51.94`}
                  value={form.limites_mapa_txt}
                  onChange={(e) =>
                    setForm({ ...form, limites_mapa_txt: e.target.value })
                  }
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
