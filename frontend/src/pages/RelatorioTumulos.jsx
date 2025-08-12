// src/pages/RelatorioTumulos.jsx
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

export default function RelatorioTumulos() {
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
  const [quadras, setQuadras] = useState([]);
  const [ocupacaoMap, setOcupacaoMap] = useState(new Map()); // tumuloId -> qtd sepultados
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros
  const [quadraSel, setQuadraSel] = useState("todas");
  const [ocupacaoSel, setOcupacaoSel] = useState("todas"); // todas | livre | ocupado
  const [tipoSel, setTipoSel] = useState("todos"); // dinâmico: se o campo existir
  const [busca, setBusca] = useState("");

  // carregar dados
  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const params = cemiterioId ? { cemiterio: cemiterioId } : {};

      const [tRes, qRes, sRes] = await Promise.all([
        api.get("tumulos/", { params }),
        api.get("quadras/", { params }),
        api.get("sepultados/", { params }),
      ]);

      const tArr = Array.isArray(tRes.data) ? tRes.data : tRes.data?.results ?? [];
      const qArr = Array.isArray(qRes.data) ? qRes.data : qRes.data?.results ?? [];
      const sArr = Array.isArray(sRes.data) ? sRes.data : sRes.data?.results ?? [];

      // contagem de ocupação por túmulo (cliente)
      const map = new Map();
      sArr.forEach((s) => {
        const tid = String(s.tumulo?.id ?? s.tumulo ?? "");
        if (!tid) return;
        map.set(tid, (map.get(tid) || 0) + 1);
      });

      setRows(tArr);
      setQuadras(qArr);
      setOcupacaoMap(map);
    } catch (e) {
      console.error(e?.response?.data || e);
      setErro("Erro ao carregar túmulos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cemiterioId]);

  // helpers de label/campos
  const quadraLabel = (t) =>
    t.quadra?.codigo || t.quadra?.nome || t.quadra?.id || "-";
  const tumuloLabel = (t) => {
    const base = t.identificador || t.codigo || t.nome || t.id || "-";
    const q = quadraLabel(t);
    const linha =
      t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "";
    return q ? `Q ${q} - ${base}${linha}` : `${base}${linha}`;
  };
  const tipoValue = (t) =>
    t.tipo || t.tipo_tumulo || t.classificacao || t.categoria || null;
  const capValue = (t) =>
    t.capacidade || t.vagas || t.lugares || t.limite || null;

  // montar lista de tipos (dinâmica, se existir)
  const tipos = useMemo(() => {
    const set = new Set();
    rows.forEach((t) => {
      const tv = tipoValue(t);
      if (tv) set.add(String(tv));
    });
    return Array.from(set);
  }, [rows]);

  // quadras options
  const quadrasOpts = useMemo(() => {
    const set = new Map();
    quadras.forEach((q) => {
      const k = String(q.id ?? q.pk ?? q.codigo ?? q.nome);
      const v = q.codigo || q.nome || q.id || k;
      set.set(k, v);
    });
    // também incluir quadras encontradas dentro do próprio tumulo (caso serializer já traga)
    rows.forEach((t) => {
      const k = String(t.quadra?.id ?? t.quadra ?? "");
      if (!k) return;
      const v = t.quadra?.codigo || t.quadra?.nome || t.quadra?.id || k;
      set.set(k, v);
    });
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [quadras, rows]);

  // aplicação dos filtros no cliente
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((t) => {
      // quadra
      if (quadraSel !== "todas") {
        const qid = String(t.quadra?.id ?? t.quadra ?? "");
        if (qid !== quadraSel) return false;
      }
      // ocupação
      const tid = String(t.id ?? t.pk);
      const ocupados = ocupacaoMap.get(tid) || 0;
      if (ocupacaoSel === "livre" && ocupados > 0) return false;
      if (ocupacaoSel === "ocupado" && ocupados === 0) return false;

      // tipo (se existir)
      if (tipoSel !== "todos" && tipos.length > 0) {
        const tv = String(tipoValue(t) || "");
        if (tv !== tipoSel) return false;
      }

      // busca
      if (!q) return true;
      const label = tumuloLabel(t).toLowerCase();
      const obs = (t.observacoes || t.descricao || "").toString().toLowerCase();
      const status = (t.status || t.situacao || "").toString().toLowerCase();
      const cap = String(capValue(t) ?? "");
      return (
        label.includes(q) ||
        obs.includes(q) ||
        status.includes(q) ||
        cap.includes(q)
      );
    });
  }, [rows, busca, quadraSel, ocupacaoSel, tipoSel, tipos.length, ocupacaoMap]);

  // resumo
  const resumo = useMemo(() => {
    const total = filtrados.length;
    let ocupados = 0;
    filtrados.forEach((t) => {
      const tid = String(t.id ?? t.pk);
      if ((ocupacaoMap.get(tid) || 0) > 0) ocupados += 1;
    });
    const livres = total - ocupados;
    const taxa = total ? Math.round((ocupados / total) * 100) : 0;
    return { total, ocupados, livres, taxa };
  }, [filtrados, ocupacaoMap]);

  // abrir PDF no backend com os filtros atuais
  async function gerarPDF() {
    const qs = new URLSearchParams();
    if (cemiterioId) qs.set("cemiterio", cemiterioId);
    if (quadraSel && quadraSel !== "todas") qs.set("quadra", quadraSel);
    if (ocupacaoSel && ocupacaoSel !== "todas") qs.set("ocupacao", ocupacaoSel);
    if (tipoSel && tipoSel !== "todos") qs.set("tipo", tipoSel);
    if (busca) qs.set("q", busca);

    const tries = [
      "/relatorios/tumulos/pdf/",
      "/relatorios/relatorio_tumulos_pdf/",
      "/relatorio/tumulos/pdf/",
      "/relatorio/relatorio_tumulos_pdf/",
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

  const header = (
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold text-green-900">Relatórios • Túmulos</h1>
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
  );

  return (
    <div className="p-6 space-y-4">
      {header}

      {/* Filtros */}
      <div className="bg-[#f0f8ea] rounded-xl p-4 shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm text-green-900 mb-1">Quadra</label>
            <select
              value={quadraSel}
              onChange={(e) => setQuadraSel(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todas">Todas</option>
              {quadrasOpts.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-green-900 mb-1">Ocupação</label>
            <select
              value={ocupacaoSel}
              onChange={(e) => setOcupacaoSel(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todas">Todas</option>
              <option value="livre">Livres</option>
              <option value="ocupado">Ocupados</option>
            </select>
          </div>

          {/* Tipo (aparece só se existir no dataset) */}
          {tipos.length > 0 && (
            <div>
              <label className="block text-sm text-green-900 mb-1">Tipo</label>
              <select
                value={tipoSel}
                onChange={(e) => setTipoSel(e.target.value)}
                className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
              >
                <option value="todos">Todos</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={tipos.length > 0 ? "md:col-span-3" : "md:col-span-4"}>
            <label className="block text-sm text-green-900 mb-1">Buscar</label>
            <input
              placeholder="Quadra, identificação, status, capacidade…"
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
            <div className="text-xs text-green-900">Ocupados</div>
            <div className="text-xl font-semibold">{resumo.ocupados}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Livres</div>
            <div className="text-xl font-semibold">{resumo.livres}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Taxa de Ocupação</div>
            <div className="text-xl font-semibold">{resumo.taxa}%</div>
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
                  <th className="py-2 px-3 rounded-l-lg">Quadra</th>
                  <th className="py-2 px-3">Identificação</th>
                  <th className="py-2 px-3">Linha</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Capacidade</th>
                  <th className="py-2 px-3">Ocupados</th>
                  <th className="py-2 px-3 rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((t, i) => {
                  const id = t.id ?? t.pk ?? i;
                  const tid = String(t.id ?? t.pk);
                  const ocupados = ocupacaoMap.get(tid) || 0;
                  const cap = capValue(t);
                  const statusText =
                    t.status || t.situacao || (ocupados > 0 ? "ocupado" : "livre");
                  return (
                    <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                      <td className="py-2 px-3">{quadraLabel(t)}</td>
                      <td className="py-2 px-3">{tumuloLabel(t)}</td>
                      <td className="py-2 px-3">
                        {t.usar_linha && (t.linha || t.linha === 0) ? t.linha : "-"}
                      </td>
                      <td className="py-2 px-3">{tipoValue(t) || "-"}</td>
                      <td className="py-2 px-3">{cap ?? "-"}</td>
                      <td className="py-2 px-3">{ocupados}</td>
                      <td className="py-2 px-3 capitalize">{statusText}</td>
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
