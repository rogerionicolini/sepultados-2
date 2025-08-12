// src/pages/RelatorioTranslados.jsx
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
const fmtMoney = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const maskCPF = (v = "") => {
  const s = v.replace(/\D/g, "");
  if (s.length <= 3) return s;
  if (s.length <= 6) return `${s.slice(0,3)}.${s.slice(3)}`;
  if (s.length <= 9) return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6)}`;
  return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9,11)}`;
};

// label do destino
function destinoLabel(row, tumMap) {
  const d = row.destino;
  if (d === "outro_tumulo") {
    const tlabel =
      row.tumulo_destino?.identificador ||
      tumMap.get(String(row.tumulo_destino)) ||
      row.tumulo_destino_label ||
      "-";
    return `Outro Túmulo: ${tlabel}`;
  }
  if (d === "outro_cemiterio") return `Outro Cemitério: ${row.cemiterio_nome || "-"}`;
  return "Ossário";
}

export default function RelatorioTranslados() {
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
  const [destino, setDestino] = useState("todos"); // todos | outro_tumulo | outro_cemiterio | ossario
  const [forma, setForma] = useState("todas");     // todas | gratuito | avista | parcelado
  const [busca, setBusca] = useState("");

  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const params = cemiterioId ? { cemiterio: cemiterioId } : {};
      const [tRes, sRes, tmRes] = await Promise.all([
        api.get("translados/", { params }),
        api.get("sepultados/", { params }),
        api.get("tumulos/", { params }),
      ]);

      const tArr = Array.isArray(tRes.data) ? tRes.data : tRes.data?.results ?? [];
      const sArr = Array.isArray(sRes.data) ? sRes.data : sRes.data?.results ?? [];
      const tmArr = Array.isArray(tmRes.data) ? tmRes.data : tmRes.data?.results ?? [];

      const sm = new Map();
      sArr.forEach((s) =>
        sm.set(String(s.id ?? s.pk), s.nome || s.identificador || `#${s.id ?? s.pk}`)
      );

      const tm = new Map();
      tmArr.forEach((t) => {
        const id = t.id ?? t.pk;
        const base = t.identificador || t.codigo || t.nome || `Túmulo ${id}`;
        const q = t.quadra?.codigo || t.quadra?.nome || t.quadra?.id || null;
        const linha = t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "";
        tm.set(String(id), q ? `Q ${q} - ${base}${linha}` : `${base}${linha}`);
      });

      setRows(tArr);
      setSepMap(sm);
      setTumMap(tm);
    } catch (e) {
      console.error(e?.response?.data || e);
      setErro("Erro ao carregar translados.");
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
      // período
      if (ini || fim) {
        const d = new Date(toISO(r.data) || r.data);
        if (ini && d < ini) return false;
        if (fim && d > fim) return false;
      }
      // destino
      if (destino !== "todos" && r.destino !== destino) return false;
      // forma pagamento
      if (forma !== "todas" && r.forma_pagamento !== forma) return false;

      if (!q) return true;
      const nd = (r.numero_documento || "").toString().toLowerCase();
      const s =
        r.sepultado?.nome ||
        sepMap.get(String(r.sepultado)) ||
        "";
      const dest = destinoLabel(r, tumMap).toLowerCase();
      const cpf = (r.cpf || "").toString().toLowerCase();
      const mot = (r.motivo || "").toString().toLowerCase();
      return (
        nd.includes(q) ||
        s.toLowerCase().includes(q) ||
        dest.includes(q) ||
        cpf.includes(q) ||
        mot.includes(q)
      );
    });
  }, [rows, busca, dataInicio, dataFim, destino, forma, sepMap, tumMap]);

  // resumo
  const resumo = useMemo(() => {
    const out = {
      total: filtrados.length,
      outro_tumulo: 0,
      outro_cemiterio: 0,
      ossario: 0,
      valorTotal: 0,
    };
    filtrados.forEach((r) => {
      if (r.destino === "outro_tumulo") out.outro_tumulo += 1;
      else if (r.destino === "outro_cemiterio") out.outro_cemiterio += 1;
      else out.ossario += 1;
      const v = Number(r.valor || 0);
      if (!Number.isNaN(v)) out.valorTotal += v;
    });
    return out;
  }, [filtrados]);

  // abrir PDF no backend com os filtros atuais
  async function gerarPDF() {
    const qs = new URLSearchParams();
    if (dataInicio) qs.set("data_inicio", dataInicio);
    if (dataFim) qs.set("data_fim", dataFim);
    if (destino && destino !== "todos") qs.set("destino", destino);
    if (forma && forma !== "todas") qs.set("forma_pagamento", forma);

    const tries = [
      "/relatorios/translados/pdf/",
      "/relatorios/relatorio_translados_pdf/",
      "/relatorio/translados/pdf/",
      "/relatorio/relatorio_translados_pdf/",
    ];

    for (const base of tries) {
      const url = `${base}?${qs.toString()}`;
      try {
        const res = await fetch(url, { method: "GET", credentials: "include" });
        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("pdf")) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, "_blank");
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          return;
        }
      } catch {
        /* tenta próxima rota */
      }
    }
    alert("Não foi possível gerar o PDF. Verifique a URL do relatório no backend.");
  }

  const sepLabel = (r) => r.sepultado?.nome || sepMap.get(String(r.sepultado)) || "-";

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-green-900">Relatórios • Translados</h1>
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
            <label className="block text-sm text-green-900 mb-1">Destino</label>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todos">Todos</option>
              <option value="outro_tumulo">Outro Túmulo</option>
              <option value="outro_cemiterio">Outro Cemitério</option>
              <option value="ossario">Ossário</option>
            </select>
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
              placeholder="Nº doc., sepultado, destino, CPF resp., motivo…"
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
            <div className="text-xs text-green-900">Outro Túmulo</div>
            <div className="text-xl font-semibold">{resumo.outro_tumulo}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Outro Cemitério</div>
            <div className="text-xl font-semibold">{resumo.outro_cemiterio}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Ossário</div>
            <div className="text-xl font-semibold">{resumo.ossario}</div>
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
                  <th className="py-2 px-3">Destino</th>
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
                      <td className="py-2 px-3">{destinoLabel(r, tumMap)}</td>
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
