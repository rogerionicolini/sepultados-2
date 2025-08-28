// src/pages/RelatorioAuditorias.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";
const getToken = () => localStorage.getItem("accessToken") || "";

// helpers
const fmtDateTime = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}, ${hh}:${mi}`;
};

// normaliza ação para PT-BR
const acaoPT = (raw, label) => {
  if (label) return label;
  const r = String(raw || "").toLowerCase();
  if (["add", "adição", "adicao", "create", "criação", "criacao"].includes(r)) return "Adição";
  if (["change", "edição", "edicao", "update"].includes(r)) return "Edição";
  if (["delete", "exclusão", "exclusao"].includes(r)) return "Exclusão";
  if (["fail", "falha", "erro", "error"].includes(r)) return "Falha";
  return raw || "-";
};

export default function RelatorioAuditorias() {
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${getToken()}` },
      }),
    []
  );

  // dados
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [acao, setAcao] = useState("todas");
  const [usuario, setUsuario] = useState("todos");
  const [entidade, setEntidade] = useState("todas");
  const [busca, setBusca] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const params = {};
      if (dataInicio) params.data_inicio = dataInicio;
      if (dataFim) params.data_fim = dataFim;
      if (acao && acao !== "todas") params.acao = acao;
      if (usuario && usuario !== "todos") params.usuario = usuario;
      if (entidade && entidade !== "todas") params.entidade = entidade;
      if (busca) params.q = busca;

      const { data } = await api.get("auditorias/", { params });
      const arr = Array.isArray(data) ? data : data?.results || [];
      setRows(arr);
    } catch {
      setErro("Não foi possível carregar as auditorias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // opções dinâmicas (usuarios e entidades) a partir dos resultados
  const usuariosOpts = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const id = r.usuario_id || r.usuario;
      if (id != null) {
        const label = r.usuario_email || r.usuario_username || r.usuario_nome || String(id);
        map.set(String(id), label);
      }
    });
    return [["todos", "Todos"], ...Array.from(map.entries())];
  }, [rows]);

  const entidadesOpts = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.modelo && set.add(String(r.modelo)));
    return ["todas", ...Array.from(set)];
  }, [rows]);

  // métricas
  const metrics = useMemo(() => {
    const base = { total: rows.length, add: 0, change: 0, delete: 0, fail: 0 };
    rows.forEach((r) => {
      const a = String(r.acao || "").toLowerCase();
      if (["add", "adição", "adicao", "create", "criação", "criacao"].includes(a)) base.add += 1;
      else if (["change", "edição", "edicao", "update"].includes(a)) base.change += 1;
      else if (["delete", "exclusão", "exclusao"].includes(a)) base.delete += 1;
      else if (["fail", "falha", "erro", "error"].includes(a)) base.fail += 1;
    });
    return base;
  }, [rows]);

  // PDF
  async function gerarPDF() {
    const params = {};
    if (dataInicio) params.data_inicio = dataInicio;
    if (dataFim) params.data_fim = dataFim;
    if (acao && acao !== "todas") params.acao = acao;
    if (usuario && usuario !== "todos") params.usuario = usuario;
    if (entidade && entidade !== "todas") params.entidade = entidade;
    if (busca) params.q = busca;

    try {
      // pede ao backend a URL ABSOLUTA do PDF com os filtros preservados
      const { data } = await api.get("auditorias/pdf-url/", { params });
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
        return;
      }
      throw new Error("sem pdf_url");
    } catch {
      // fallback: tenta abrir direto as rotas de PDF/HTML
      const backendRoot = API_BASE.replace(/\/api\/?$/, "");
      const qs = new URLSearchParams(params).toString();
      const tries = [
        `${backendRoot}/relatorios/auditorias/pdf/?${qs}`,
        `${backendRoot}/relatorio/auditorias/pdf/?${qs}`,
        `${backendRoot}/relatorios/historicos/pdf/?${qs}`,
      ];
      for (const url of tries) {
        const w = window.open(url, "_blank");
        if (w) return;
      }
      alert("Não foi possível gerar o PDF. Verifique as rotas no backend.");
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Título + ações */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-900">Relatórios • Auditorias</h1>
        <div className="flex gap-2">
          <button onClick={carregar} className="bg-[#688f53] text-white px-4 py-2 rounded-xl shadow hover:opacity-90">
            Atualizar
          </button>
          <button
            onClick={gerarPDF}
            className="bg-green-800 text-white px-4 py-2 rounded-xl shadow hover:bg-green-700"
          >
            Gerar PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-[#f0f8ea] rounded-xl p-4 shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm text-green-900 mb-1">Data início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Data fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Ação</label>
            <select
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todas">Todas</option>
              <option value="adição">Adição</option>
              <option value="edição">Edição</option>
              <option value="exclusão">Exclusão</option>
              <option value="falha">Falha</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Usuário</label>
            <select
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              {usuariosOpts.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Entidade</label>
            <select
              value={entidade}
              onChange={(e) => setEntidade(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              {entidadesOpts.map((m) => (
                <option key={m} value={m}>
                  {m === "todas" ? "Todas" : m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Objeto, ID, usuário, detalhe…"
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* métricas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Total</div>
            <div className="text-xl font-semibold">{metrics.total}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Criações</div>
            <div className="text-xl font-semibold">{metrics.add}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Atualizações</div>
            <div className="text-xl font-semibold">{metrics.change}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Exclusões</div>
            <div className="text-xl font-semibold">{metrics.delete}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Falhas</div>
            <div className="text-xl font-semibold">{metrics.fail}</div>
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
                  <th className="py-2 px-3 rounded-l-lg">Data/Hora</th>
                  <th className="py-2 px-3">Usuário</th>
                  <th className="py-2 px-3">Ação</th>
                  <th className="py-2 px-3">Entidade</th>
                  <th className="py-2 px-3">Objeto</th>
                  {/* coluna IP removida */}
                  <th className="py-2 px-3 rounded-r-lg">Detalhes</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {rows.map((r, i) => (
                  <tr key={r.id ?? i} className="border-t border-[#d8e9c0] hover:bg-white">
                    <td className="py-2 px-3">{fmtDateTime(r.data_hora)}</td>
                    <td className="py-2 px-3">
                      {r.usuario_email || r.usuario_username || r.usuario_nome || "-"}
                    </td>
                    <td className="py-2 px-3">{acaoPT(r.acao, r.acao_label)}</td>
                    <td className="py-2 px-3">{r.modelo || "-"}</td>
                    <td className="py-2 px-3">{r.objeto_id ?? "-"}</td>
                    <td className="py-2 px-3">{r.detalhes || "-"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 px-3 text-gray-600">
                      Nenhum resultado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
