// src/pages/RelatorioSepultados.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";

// Helpers p/ pegar cemitério ativo e token
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

// formatações simples
const toISO = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
};
const fmtDate = (d) => (toISO(d) || "-");
const maskCPF = (v = "") => {
  const s = v.replace(/\D/g, "");
  if (s.length <= 3) return s;
  if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3)}`;
  if (s.length <= 9) return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`;
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
};

// status calculado (lida com ambos jeitos que costumam vir da API)
function statusFromRow(s) {
  const ex = s.exumado || !!s.data_exumacao || !!s.exumacao_data || s.status === "exumado";
  const tr =
    s.trasladado || s.transladado || !!s.data_translado || !!s.translado_data || s.status === "transladado";
  if (tr) return "transladado";
  if (ex) return "exumado";
  return "sepultado";
}

export default function RelatorioSepultados() {
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

  // dados
  const [rows, setRows] = useState([]);
  const [tumMap, setTumMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState("todos"); // todos | sepultado | exumado | transladado
  const [busca, setBusca] = useState("");

  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const params = {};
      if (cemiterioId) params.cemiterio = cemiterioId;

      const [sRes, tRes] = await Promise.all([
        api.get("sepultados/", { params }),
        api.get("tumulos/", { params }),
      ]);

      const sArr = Array.isArray(sRes.data) ? sRes.data : sRes.data?.results ?? [];
      const tArr = Array.isArray(tRes.data) ? tRes.data : tRes.data?.results ?? [];

      const tmap = new Map();
      tArr.forEach((t) => {
        const id = t.id ?? t.pk;
        const base = t.identificador || t.codigo || t.nome || `Túmulo ${id}`;
        const q = t.quadra?.codigo || t.quadra?.nome || t.quadra?.id || null;
        const linha = t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "";
        tmap.set(String(id), q ? `Q ${q} - ${base}${linha}` : `${base}${linha}`);
      });

      setRows(sArr);
      setTumMap(tmap);
    } catch (e) {
      console.error(e?.response?.data || e);
      setErro("Erro ao carregar sepultados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cemiterioId]);

  // aplicação dos filtros no cliente
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ini = dataInicio ? new Date(dataInicio) : null;
    const fim = dataFim ? new Date(dataFim) : null;

    return rows.filter((s) => {
      // data no período
      if (ini || fim) {
        const ds = new Date(toISO(s.data_sepultamento) || s.data_sepultamento || s.data);
        if (ini && ds < ini) return false;
        if (fim && ds > fim) return false;
      }
      // status
      if (status !== "todos" && statusFromRow(s) !== status) return false;

      // busca
      if (!q) return true;
      const num = (s.numero_sepultamento || "").toString().toLowerCase();
      const nome = (s.nome || "").toString().toLowerCase();
      const cpf = (s.cpf || s.documento || "").toString().toLowerCase();
      const tum =
        s.tumulo?.identificador ||
        tumMap.get(String(s.tumulo)) ||
        s.tumulo_label ||
        "";
      return (
        num.includes(q) ||
        nome.includes(q) ||
        cpf.includes(q) ||
        tum.toString().toLowerCase().includes(q)
      );
    });
  }, [rows, busca, dataInicio, dataFim, status, tumMap]);

  // contadores
  const contadores = useMemo(() => {
    const c = { total: filtrados.length, sepultado: 0, exumado: 0, transladado: 0 };
    filtrados.forEach((r) => (c[statusFromRow(r)] += 1));
    return c;
  }, [filtrados]);

  // abrir PDF no backend com os filtros atuais
  async function gerarPDF() {
    // monta os filtros atuais
    const params = {};
    if (dataInicio) params.data_inicio = dataInicio;
    if (dataFim) params.data_fim = dataFim;
    if (status && status !== "todos") params.status = status;
    if (cemiterioId) params.cemiterio = cemiterioId;

    try {
      // 1) pega a URL absoluta do backend (ex.: http://127.0.0.1:8000/relatorios/sepultados/pdf/?...)
      const { data } = await api.get("relatorios/sepultados/pdf-url/", { params });
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
        return;
      }
      throw new Error("Sem pdf_url");
    } catch (e) {
      // 2) Fallback: tenta rotas ABSOLUTAS no backend (nunca relativas)
      const backendRoot = API_BASE.replace(/\/api\/?$/, ""); // "http://127.0.0.1:8000"
      const qs = new URLSearchParams(params).toString();
      const candidates = [
        `${backendRoot}/relatorios/sepultados/pdf/?${qs}`,
        `${backendRoot}/relatorios/relatorio_sepultados_pdf/?${qs}`,
      ];

      for (const url of candidates) {
        const w = window.open(url, "_blank");
        if (w) return;
      }
      alert("Não foi possível gerar o PDF. Verifique as rotas no backend.");
    }
  }


  const tumuloLabel = (s) =>
    s.tumulo?.identificador ||
    tumMap.get(String(s.tumulo)) ||
    s.tumulo_label ||
    "-";

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-green-900">Relatórios • Sepultados</h1>
        <div className="flex gap-2">
          <button
            onClick={carregar}
            className="bg-[#688f53] text-white px-4 py-2 rounded-xl shadow hover:opacity-90"
          >
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
      <div className="bg-[#f0f8ea] rounded-xl p-4 shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
            <label className="block text-sm text-green-900 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todos">Todos</option>
              <option value="sepultado">Sepultado</option>
              <option value="exumado">Exumado</option>
              <option value="transladado">Transladado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Buscar</label>
            <input
              placeholder="Nome, nº sep., CPF ou túmulo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Total</div>
            <div className="text-xl font-semibold">{contadores.total}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Sepultados</div>
            <div className="text-xl font-semibold">{contadores.sepultado}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Exumados</div>
            <div className="text-xl font-semibold">{contadores.exumado}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Transladados</div>
            <div className="text-xl font-semibold">{contadores.transladado}</div>
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
                  <th className="py-2 px-3 rounded-l-lg">Nº Sepultamento</th>
                  <th className="py-2 px-3">Nome</th>
                  <th className="py-2 px-3">CPF</th>
                  <th className="py-2 px-3">Falecimento</th>
                  <th className="py-2 px-3">Sepultamento</th>
                  <th className="py-2 px-3">Túmulo</th>
                  <th className="py-2 px-3 rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((s, i) => {
                  const id = s.id ?? s.pk ?? i;
                  return (
                    <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                      <td className="py-2 px-3">{s.numero_sepultamento || "-"}</td>
                      <td className="py-2 px-3">{s.nome || "-"}</td>
                      <td className="py-2 px-3">{maskCPF(s.cpf || s.documento || "")}</td>
                      <td className="py-2 px-3">{fmtDate(s.data_falecimento)}</td>
                      <td className="py-2 px-3">{fmtDate(s.data_sepultamento || s.data)}</td>
                      <td className="py-2 px-3">{tumuloLabel(s)}</td>
                      <td className="py-2 px-3 capitalize">{statusFromRow(s)}</td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td className="py-6 px-3 text-gray-600" colSpan={7}>
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
