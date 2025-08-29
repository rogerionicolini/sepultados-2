// src/pages/RelatorioReceitas.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";

// ===== Helpers token / prefeitura =====
const getToken = () => localStorage.getItem("accessToken") || "";

function getPrefeituraAtivaIdLocal() {
  try {
    const raw = localStorage.getItem("prefeituraAtiva");
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.id) return Number(o.id);
    }
  } catch {}
  const id = localStorage.getItem("prefeituraAtivaId");
  return id ? Number(id) : null;
}

async function fetchPrefeituraLogada(api) {
  try {
    const { data } = await api.get("prefeitura-logada/");
    // aceita {id, ...} ou {prefeitura: {id, ...}}
    const pid = data?.id ?? data?.prefeitura?.id ?? null;
    if (pid) {
      localStorage.setItem("prefeituraAtivaId", String(pid));
      localStorage.setItem(
        "prefeituraAtiva",
        JSON.stringify({ id: pid, nome: data?.nome || data?.prefeitura?.nome || "" })
      );
      return Number(pid);
    }
  } catch {}
  return null;
}

// ===== formatadores =====
const toISO = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

// ⬇️ Agora exibe dd/mm/aaaa na tabela
const fmtDate = (d) => {
  if (!d) return "-";
  const s = String(d);

  // Se já vier como 'YYYY-MM-DD' (ou 'YYYY-MM-DDTHH:MM...')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  // Fallback: tentar Date()
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "-";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ===== normalizadores =====
// status: apenas 'aberto' | 'pago' (e 'todos' no filtro)
const statusOf = (r) => {
  const s = String(r.status || r.situacao || "").toLowerCase();
  if (s === "pago" || s === "aberto") return s;
  // fallback: alguns payloads trazem booleano
  if (r.pago === true) return "pago";
  return "aberto";
};

const formaOf = (r) =>
  r.forma_pagamento || r.metodo_pagamento || r.forma || r.metodo || "-";

function origemLabel(r) {
  if (r.origem_label) return r.origem_label;
  if (r.tipo) return r.tipo;
  if (r.content_type || r.entidade) {
    const et = r.content_type || r.entidade;
    const oid = r.object_id || r.objeto_id || "";
    return `${et}${oid ? ` #${oid}` : ""}`;
  }
  if (r.referencia || r.referente) return r.referencia || r.referente;
  return r.descricao || r.historico || "-";
}

const valorNum = (r) => Number(r.valor || r.total || r.valor_total || 0);

export default function RelatorioReceitas() {
  const token = getToken();

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
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [status, setStatus] = useState("todos"); // todos | aberto | pago
  const [forma, setForma] = useState("todas");   // dinâmica a partir do dataset
  const [busca, setBusca] = useState("");

  // prefeitura
  const [prefId, setPrefId] = useState(getPrefeituraAtivaIdLocal());

  async function ensurePrefeituraId() {
    if (prefId) return prefId;
    const fetched = await fetchPrefeituraLogada(api);
    if (fetched) {
      setPrefId(fetched);
      return fetched;
    }
    return null;
  }

  async function carregar() {
    setLoading(true);
    setErro("");

    const pid = await ensurePrefeituraId();
    if (!pid) {
      setRows([]);
      setErro("Nenhuma prefeitura ativa encontrada. Faça login ou selecione uma prefeitura.");
      setLoading(false);
      return;
    }

    const params = { prefeitura: pid };
    const paths = ["receitas/", "relatorios/receitas/"];
    let arr = [];

    for (const path of paths) {
      try {
        const res = await api.get(path, { params });
        const data = res.data;
        arr = Array.isArray(data) ? data : data?.results ?? [];
        if (arr.length) break;
      } catch {
        // tenta a próxima rota
      }
    }

    if (!arr.length) {
      setErro("Nenhuma receita encontrada para a prefeitura atual.");
    }

    setRows(arr);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefId]);

  // formas dinâmicas
  const formasOpts = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const f = formaOf(r);
      if (f && f !== "-") set.add(String(f));
    });
    return ["todas", ...Array.from(set)];
  }, [rows]);

  // aplicar filtros
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ini = dataInicio ? new Date(dataInicio) : null;
    const fim = dataFim ? new Date(dataFim) : null;

    return rows.filter((r) => {
      const d = toISO(r.data_pagamento || r.data || r.data_receita || r.created_at);
      if (ini || fim) {
        const dt = d ? new Date(d) : null;
        if (ini && (!dt || dt < ini)) return false;
        if (fim && (!dt || dt > fim)) return false;
      }
      if (status !== "todos" && statusOf(r) !== status) return false;
      if (forma !== "todas" && String(formaOf(r)) !== forma) return false;

      if (!q) return true;
      const alvo = [
        (r.numero_documento || r.documento || "").toString(),
        origemLabel(r),
        r.descricao || "",
        r.pagador || r.responsavel || "",
      ]
        .join(" ")
        .toLowerCase();

      return alvo.includes(q);
    });
  }, [rows, dataInicio, dataFim, status, forma, busca]);

  // resumo (apenas aberto/pago)
  const resumo = useMemo(() => {
    const base = { total: filtrados.length, aberto: 0, pago: 0, somaTudo: 0, somaPagos: 0 };
    filtrados.forEach((r) => {
      const st = statusOf(r); // 'aberto' | 'pago'
      base[st] += 1;
      const v = valorNum(r);
      base.somaTudo += isNaN(v) ? 0 : v;
      if (st === "pago") base.somaPagos += isNaN(v) ? 0 : v;
    });
    return base;
  }, [filtrados]);

  async function gerarPDF() {
    const pid = await ensurePrefeituraId();
    if (!pid) {
      alert("Selecione uma prefeitura para gerar o PDF.");
      return;
    }

    const params = { prefeitura: pid };
    if (dataInicio) params.data_inicio = dataInicio;
    if (dataFim) params.data_fim = dataFim;
    if (status && status !== "todos") params.status = status; // 'aberto' | 'pago'
    if (forma && forma !== "todas") params.forma = forma;
    if (busca) params.q = busca;

    try {
      const { data } = await api.get("relatorios/receitas/pdf-url/", { params });
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
        return;
      }
      throw new Error("Sem pdf_url");
    } catch {
      // fallback ABSOLUTO
      const backendRoot = API_BASE.replace(/\/api\/?$/, ""); // http://127.0.0.1:8000
      const qs = new URLSearchParams(params).toString();
      const candidates = [
        `${backendRoot}/relatorios/receitas/pdf/?${qs}`,
        `${backendRoot}/relatorios/relatorio_receitas_pdf/?${qs}`,
      ];
      for (const url of candidates) {
        const w = window.open(url, "_blank");
        if (w) return;
      }
      alert("Não foi possível gerar o PDF. Verifique as rotas no backend.");
    }
  }

  const dataCol = (r) => fmtDate(r.data_pagamento || r.data || r.data_receita || r.created_at);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-green-900">Relatórios • Receitas</h1>
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
            Imprimir
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-[#f0f8ea] rounded-xl p-4 shadow space-y-4">
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
            <label className="block text-sm text-green-900 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todos">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Forma</label>
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              {formasOpts.map((f) => (
                <option key={f} value={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-green-900 mb-1">Buscar</label>
            <input
              placeholder="Nº doc., origem, descrição, pagador…"
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
            <div className="text-xl font-semibold">{resumo.total}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Pagas</div>
            <div className="text-xl font-semibold">{resumo.pago}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Abertas</div>
            <div className="text-xl font-semibold">{resumo.aberto}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Somatório (pagas)</div>
            <div className="text-xl font-semibold">{fmtMoney(resumo.somaPagos)}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-1">
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Somatório (todas no filtro)</div>
            <div className="text-xl font-semibold">{fmtMoney(resumo.somaTudo)}</div>
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
                  <th className="py-2 px-3 rounded-l-lg">Nº Documento</th>
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Origem</th>
                  <th className="py-2 px-3">Descrição</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Forma</th>
                  <th className="py-2 px-3 rounded-r-lg">Valor</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((r, i) => {
                  const key = r.id ?? r.pk ?? i;
                  return (
                    <tr key={key} className="border-t border-[#d8e9c0] hover:bg-white">
                      <td className="py-2 px-3">
                        {r.numero_documento || r.documento || "-"}
                      </td>
                      <td className="py-2 px-3">{dataCol(r)}</td>
                      <td className="py-2 px-3">{origemLabel(r)}</td>
                      <td className="py-2 px-3">{r.descricao || r.historico || "-"}</td>
                      <td className="py-2 px-3 capitalize">{statusOf(r)}</td>
                      <td className="py-2 px-3">{formaOf(r)}</td>
                      <td className="py-2 px-3">{fmtMoney(valorNum(r))}</td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 px-3 text-gray-600">
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
