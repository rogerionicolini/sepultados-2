// src/pages/RelatorioExumacoes.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";

// Helpers para token / cemitério
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

// formatadores
const toISO = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};
const fmtDate = (d) => (toISO(d) || "-");
const fmtMoney = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
const maskCPF = (v = "") => {
  const s = v.replace(/\D/g, "");
  if (s.length <= 3) return s;
  if (s.length <= 6) return `${s.slice(0,3)}.${s.slice(3)}`;
  if (s.length <= 9) return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6)}`;
  return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9,11)}`;
};

export default function RelatorioExumacoes() {
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
  const [sepMap, setSepMap] = useState(new Map());
  const [tumMap, setTumMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [forma, setForma] = useState("todas"); // todas | gratuito | avista | parcelado
  const [busca, setBusca] = useState("");

  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const params = cemiterioId ? { cemiterio: cemiterioId } : {};
      const [eRes, sRes, tRes] = await Promise.all([
        api.get("exumacoes/", { params }),
        api.get("sepultados/", { params }),
        api.get("tumulos/", { params }),
      ]);

      const eArr = Array.isArray(eRes.data) ? eRes.data : eRes.data?.results ?? [];
      const sArr = Array.isArray(sRes.data) ? sRes.data : sRes.data?.results ?? [];
      const tArr = Array.isArray(tRes.data) ? tRes.data : tRes.data?.results ?? [];

      const sm = new Map();
      sArr.forEach((s) =>
        sm.set(String(s.id ?? s.pk), s.nome || s.identificador || `#${s.id ?? s.pk}`)
      );

      const tm = new Map();
      tArr.forEach((t) => {
        const id = t.id ?? t.pk;
        const base = t.identificador || t.codigo || t.nome || `Túmulo ${id}`;
        const q = t.quadra?.codigo || t.quadra?.nome || t.quadra?.id || null;
        const linha = t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "";
        tm.set(String(id), q ? `Q ${q} - ${base}${linha}` : `${base}${linha}`);
      });

      setRows(eArr);
      setSepMap(sm);
      setTumMap(tm);
    } catch (e) {
      console.error(e?.response?.data || e);
      setErro("Erro ao carregar exumações.");
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

    return rows.filter((r) => {
      // período: usa r.data
      if (ini || fim) {
        const d = new Date(toISO(r.data) || r.data);
        if (ini && d < ini) return false;
        if (fim && d > fim) return false;
      }
      // forma de pagamento
      if (forma !== "todas" && r.forma_pagamento !== forma) return false;

      if (!q) return true;
      const nd = (r.numero_documento || "").toString().toLowerCase();
      const s =
        r.sepultado?.nome ||
        sepMap.get(String(r.sepultado)) ||
        "";
      const tum =
        r.tumulo?.identificador ||
        tumMap.get(String(r.tumulo)) ||
        "";
      const cpf = (r.cpf || "").toString().toLowerCase();
      const mot = (r.motivo || "").toString().toLowerCase();
      return (
        nd.includes(q) ||
        s.toLowerCase().includes(q) ||
        tum.toString().toLowerCase().includes(q) ||
        cpf.includes(q) ||
        mot.includes(q)
      );
    });
  }, [rows, busca, dataInicio, dataFim, forma, sepMap, tumMap]);

  // resumo
  const resumo = useMemo(() => {
    const out = {
      total: filtrados.length,
      gratuito: 0,
      avista: 0,
      parcelado: 0,
      valorTotal: 0,
    };
    filtrados.forEach((r) => {
      if (r.forma_pagamento === "gratuito") out.gratuito += 1;
      else if (r.forma_pagamento === "avista") out.avista += 1;
      else if (r.forma_pagamento === "parcelado") out.parcelado += 1;
      const v = Number(r.valor || 0);
      if (!Number.isNaN(v)) out.valorTotal += v;
    });
    return out;
  }, [filtrados]);

  // dentro de RelatorioExumacoes.jsx
  async function gerarPDF() {
    // monta filtros atuais
    const params = {};
    if (dataInicio) params.data_inicio = dataInicio;
    if (dataFim) params.data_fim = dataFim;
    if (forma && forma !== "todas") params.forma_pagamento = forma;
    if (cemiterioId) params.cemiterio = cemiterioId;

    try {
      // pega a URL ABSOLUTA do PDF no backend (ex.: http://127.0.0.1:8000/relatorios/exumacoes/pdf/?...)
      const { data } = await api.get("relatorios/exumacoes/pdf-url/", { params });
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
        return;
      }
      throw new Error("Sem pdf_url");
    } catch (e) {
      // fallback com caminhos ABSOLUTOS no backend (nunca relativos ao 5173)
      const backendRoot = API_BASE.replace(/\/api\/?$/, ""); // "http://127.0.0.1:8000"
      const qs = new URLSearchParams(params).toString();
      const candidates = [
        `${backendRoot}/relatorios/exumacoes/pdf/?${qs}`,
        `${backendRoot}/relatorios/relatorio_exumacoes_pdf/?${qs}`,
      ];
      for (const url of candidates) {
        const w = window.open(url, "_blank");
        if (w) return;
      }
      alert("Não foi possível gerar o PDF. Verifique as rotas no backend.");
    }
  }


  const sepLabel = (r) =>
    r.sepultado?.nome || sepMap.get(String(r.sepultado)) || "-";
  const tumuloLabel = (r) =>
    r.tumulo?.identificador || tumMap.get(String(r.tumulo)) || "-";

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-green-900">Relatórios • Exumações</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
            <label className="block text-sm text-green-900 mb-1">Forma de Pagamento</label>
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todas">Todas</option>
              <option value="gratuito">Gratuito</option>
              <option value="avista">À Vista</option>
              <option value="parcelado">Parcelado</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-green-900 mb-1">Buscar</label>
            <input
              placeholder="Nº doc., sepultado, túmulo, CPF do responsável, motivo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Total</div>
            <div className="text-xl font-semibold">{resumo.total}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Gratuitas</div>
            <div className="text-xl font-semibold">{resumo.gratuito}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">À Vista</div>
            <div className="text-xl font-semibold">{resumo.avista}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Parceladas</div>
            <div className="text-xl font-semibold">{resumo.parcelado}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Somatório</div>
            <div className="text-xl font-semibold">{fmtMoney(resumo.valorTotal)}</div>
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
                  <th className="py-2 px-3">Sepultado</th>
                  <th className="py-2 px-3">Túmulo Origem</th>
                  <th className="py-2 px-3">CPF Resp.</th>
                  <th className="py-2 px-3">Forma</th>
                  <th className="py-2 px-3 rounded-r-lg">Valor</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((r, i) => {
                  const id = r.id ?? r.pk ?? i;
                  return (
                    <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                      <td className="py-2 px-3">{r.numero_documento || "-"}</td>
                      <td className="py-2 px-3">{fmtDate(r.data)}</td>
                      <td className="py-2 px-3">{sepLabel(r)}</td>
                      <td className="py-2 px-3">{tumuloLabel(r)}</td>
                      <td className="py-2 px-3">{maskCPF(r.cpf || "")}</td>
                      <td className="py-2 px-3 capitalize">{r.forma_pagamento || "-"}</td>
                      <td className="py-2 px-3">{fmtMoney(r.valor)}</td>
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
