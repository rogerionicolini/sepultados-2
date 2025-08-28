// src/pages/RelatorioContratos.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";

// Helpers token / cemitério
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
const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const maskDoc = (v = "") => {
  const s = v.replace(/\D/g, "");
  if (!s) return "";
  if (s.length <= 11) {
    if (s.length <= 3) return s;
    if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3)}`;
    if (s.length <= 9) return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`;
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
  }
  if (s.length <= 2) return s;
  if (s.length <= 5) return `${s.slice(0, 2)}.${s.slice(2)}`;
  if (s.length <= 8) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5)}`;
  if (s.length <= 12) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8)}`;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12, 14)}`;
};

export default function RelatorioContratos() {
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
  const [forma, setForma] = useState("todas"); // todas | gratuito | avista | parcelado
  const [busca, setBusca] = useState("");

  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const params = cemiterioId ? { cemiterio: cemiterioId } : {};
      const [cRes, tRes] = await Promise.all([
        api.get("contratos/", { params }),
        api.get("tumulos/", { params }),
      ]);

      const cArr = Array.isArray(cRes.data) ? cRes.data : cRes.data?.results ?? [];
      const tArr = Array.isArray(tRes.data) ? tRes.data : tRes.data?.results ?? [];

      const tm = new Map();
      tArr.forEach((t) => {
        const id = t.id ?? t.pk;
        const base = t.identificador || t.codigo || t.nome || `Túmulo ${id}`;
        const q = t.quadra?.codigo || t.quadra?.nome || t.quadra?.id || null;
        const linha = t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "";
        tm.set(String(id), q ? `Q ${q} - ${base}${linha}` : `${base}${linha}`);
      });

      setRows(cArr);
      setTumMap(tm);
    } catch (e) {
      console.error(e?.response?.data || e);
      setErro("Erro ao carregar contratos.");
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
      if (ini || fim) {
        const d = new Date(toISO(r.data_contrato) || r.data_contrato);
        if (ini && d < ini) return false;
        if (fim && d > fim) return false;
      }
      if (forma !== "todas" && r.forma_pagamento !== forma) return false;

      if (!q) return true;
      const num = (r.numero_contrato || "").toString().toLowerCase();
      const nome = (r.nome || "").toString().toLowerCase();
      const doc = (r.cpf || "").toString().toLowerCase();
      const tum =
        r.tumulo?.identificador ||
        tumMap.get(String(r.tumulo)) ||
        r.tumulo_label ||
        "";
      return (
        num.includes(q) ||
        nome.includes(q) ||
        doc.includes(q) ||
        tum.toString().toLowerCase().includes(q)
      );
    });
  }, [rows, busca, dataInicio, dataFim, forma, tumMap]);

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

      const v = Number(r.valor_total || 0);
      if (!Number.isNaN(v)) out.valorTotal += v;
    });
    return out;
  }, [filtrados]);

  async function gerarPDF() {
    // filtros atuais
    const params = {};
    if (dataInicio) params.data_inicio = dataInicio;
    if (dataFim) params.data_fim = dataFim;
    if (forma && forma !== "todas") params.forma_pagamento = forma;

    // MUITO IMPORTANTE: passar o cemitério
    if (cemiterioId) params.cemiterio = cemiterioId;

    try {
      // pega a URL ABSOLUTA do backend
      const { data } = await api.get("relatorios/contratos/pdf-url/", { params });
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
        return;
      }
      throw new Error("Sem pdf_url");
    } catch (e) {
      // fallback ABSOLUTO (nunca relativo à porta 5173)
      const backendRoot = API_BASE.replace(/\/api\/?$/, ""); // http://127.0.0.1:8000
      const qs = new URLSearchParams(params).toString();
      const candidates = [
        `${backendRoot}/relatorios/contratos/pdf/?${qs}`,
        `${backendRoot}/relatorios/relatorio_contratos_pdf/?${qs}`,
      ];
      for (const url of candidates) {
        const w = window.open(url, "_blank");
        if (w) return;
      }
      alert("Não foi possível gerar o PDF. Verifique as rotas no backend.");
    }
  }

  const tumuloLabel = (r) =>
    r.tumulo?.identificador ||
    tumMap.get(String(r.tumulo)) ||
    r.tumulo_label ||
    "-";

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-green-900">Relatórios • Contratos de Concessão</h1>
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
              placeholder="Nº contrato, titular, CPF/CNPJ, túmulo…"
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
            <div className="text-xs text-green-900">Gratuitos</div>
            <div className="text-xl font-semibold">{resumo.gratuito}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">À Vista</div>
            <div className="text-xl font-semibold">{resumo.avista}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Parcelados</div>
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
                  <th className="py-2 px-3 rounded-l-lg">Nº Contrato</th>
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Titular</th>
                  <th className="py-2 px-3">CPF/CNPJ</th>
                  <th className="py-2 px-3">Túmulo</th>
                  <th className="py-2 px-3">Forma</th>
                  <th className="py-2 px-3">Parcelas</th>
                  <th className="py-2 px-3 rounded-r-lg">Valor total</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((r, i) => {
                  const id = r.id ?? r.pk ?? i;
                  return (
                    <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                      <td className="py-2 px-3">{r.numero_contrato || "-"}</td>
                      <td className="py-2 px-3">{fmtDate(r.data_contrato)}</td>
                      <td className="py-2 px-3">{r.nome || "-"}</td>
                      <td className="py-2 px-3">{maskDoc(r.cpf || "")}</td>
                      <td className="py-2 px-3">{tumuloLabel(r)}</td>
                      <td className="py-2 px-3 capitalize">{r.forma_pagamento || "-"}</td>
                      <td className="py-2 px-3">
                        {r.forma_pagamento === "parcelado" ? (r.quantidade_parcelas || "-") : "-"}
                      </td>
                      <td className="py-2 px-3">{fmtMoney(r.valor_total)}</td>
                    </tr>
                  );
                })}

                {filtrados.length === 0 && (
                  <tr>
                    <td className="py-6 px-3 text-gray-600" colSpan={8}>
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
