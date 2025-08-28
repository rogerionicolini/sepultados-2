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

// util: normaliza string para comparação (lowercase/sem acento)
function normalize(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// Capitaliza a primeira letra (para Status)
function capFirst(s) {
  if (!s) return "-";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// opções fixas de tipo para filtro
const TIPO_OPCOES = ["Túmulo", "Perpétua", "Sepultura", "Jazigo", "Outro"];
const TIPO_TOKENS = TIPO_OPCOES.map(normalize); // ["tumulo","perpetua","sepultura","jazigo","outro"]

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
  const [ocupacaoMap, setOcupacaoMap] = useState(new Map()); // tumuloId -> qtd sepultados ATIVOS
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros
  const [quadraSel, setQuadraSel] = useState("todas");
  const [ocupacaoSel, setOcupacaoSel] = useState("todas"); // todas | livre | ocupado | reservado
  const [tipoSel, setTipoSel] = useState("todos");          // todos | (opções fixas)
  const [busca, setBusca] = useState("");

  // map de quadras por id
  const quadrasMap = useMemo(() => {
    const m = new Map();
    quadras.forEach((q) => {
      const id = String(q.id ?? q.pk);
      if (!id) return;
      m.set(id, q);
    });
    return m;
  }, [quadras]);

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

      // contagem de ocupação por túmulo (apenas ATIVOS)
      const map = new Map();
      sArr.forEach((s) => {
        const exumado = s.exumado === true;
        const trasladado = s.trasladado === true;
        if (exumado || trasladado) return; // ignora inativos
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
  const quadraLabel = (t) => {
    const qid = String(t?.quadra?.id ?? t?.quadra ?? "");
    if (qid) {
      const found = quadrasMap.get(qid);
      if (found) return found.codigo || found.nome || found.id;
    }
    if (t.quadra && typeof t.quadra === "object") {
      return t.quadra.codigo || t.quadra.nome || t.quadra.id || "";
    }
    return "";
  };

  const tipoValue = (t) =>
    t.tipo_estrutura_display ||
    t.tipo_estrutura ||
    t.tipoEstruturaDisplay ||
    t.tipoEstrutura ||
    t.tipo_display ||
    t.tipo_label ||
    t.tipo_nome ||
    t.tipo ||
    t.tipo_tumulo ||
    t.classificacao ||
    t.categoria ||
    null;

  function tipoToken(t) {
    const raw = tipoValue(t);
    const n = normalize(raw);
    if (["t", "tum", "sepul"].includes(n)) return "tumulo";
    if (["perp", "perpetuo", "perpetua"].includes(n)) return "perpetua";
    if (["jaz", "jz"].includes(n)) return "jazigo";
    if (!n) return "";
    if (TIPO_TOKENS.includes(n)) return n;
    if (n.startsWith("tum")) return "tumulo";
    if (n.startsWith("perp")) return "perpetua";
    if (n.startsWith("sepul")) return "sepultura";
    if (n.startsWith("jaz")) return "jazigo";
    if (n.startsWith("out")) return "outro";
    return n;
  }

  const capValue = (t) =>
    t.capacidade || t.vagas || t.lugares || t.limite || null;

  // Identificação **sem a quadra**; mantém a linha quando existir
  const tumuloLabel = (t) => {
    const base = t.identificador || t.codigo || t.nome || t.id || "-";
    const linha =
      t.usar_linha && (t.linha || t.linha === 0) ? ` - L${t.linha}` : "";
    return `${base}${linha}`;
  };

  // rótulo bonitinho para exibir o tipo
  function prettifyTipo(t) {
    const raw = tipoValue(t);
    const tok = tipoToken(t);
    const i = TIPO_TOKENS.indexOf(tok);
    if (i >= 0) return TIPO_OPCOES[i];
    if (!raw) return "-";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // status token (livre/ocupado/reservado) para filtro
  function statusToken(t, ocupados) {
    const st = normalize(t.status || t.situacao || "");
    if (st === "reservado") return "reservado";
    if (st === "ocupado") return "ocupado";
    if (st === "disponivel" || st === "disponível" || st === "livre") return "livre";
    // se não veio status consistente, deduz a partir de ocupação
    return ocupados > 0 ? "ocupado" : "livre";
  }

  // quadras options
  const quadrasOpts = useMemo(() => {
    const set = new Map();
    quadras.forEach((q) => {
      const id = String(q.id ?? q.pk);
      if (!id) return;
      const label = q.codigo || q.nome || q.id || id;
      set.set(id, label);
    });
    rows.forEach((t) => {
      const qid = String(t.quadra?.id ?? t.quadra ?? "");
      if (!qid) return;
      const label =
        t.quadra?.codigo ||
        t.quadra?.nome ||
        quadrasMap.get(qid)?.codigo ||
        quadrasMap.get(qid)?.nome ||
        qid;
      set.set(qid, label);
    });
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [quadras, rows, quadrasMap]);

  // aplicação dos filtros no cliente
  const filtrados = useMemo(() => {
    const q = normalize(busca);
    return rows.filter((t) => {
      // quadra
      if (quadraSel !== "todas") {
        const qid = String(t.quadra?.id ?? t.quadra ?? "");
        if (qid !== quadraSel) return false;
      }

      const tid = String(t.id ?? t.pk);
      const ocupados = ocupacaoMap.get(tid) || 0;
      const stTok = statusToken(t, ocupados);

      // ocupação
      if (ocupacaoSel === "livre" && stTok !== "livre") return false;
      if (ocupacaoSel === "ocupado" && stTok !== "ocupado") return false;
      if (ocupacaoSel === "reservado" && stTok !== "reservado") return false;

      // tipo fixo
      if (tipoSel !== "todos") {
        const tok = tipoToken(t);
        if (normalize(tipoSel) !== tok) return false;
      }

      // busca
      if (!q) return true;
      const label = normalize(tumuloLabel(t));
      const obs = normalize(t.observacoes || t.descricao || "");
      const status = normalize(t.status || t.situacao || "");
      const cap = String(capValue(t) ?? "");
      const tipoTxt = normalize(tipoValue(t) || "");
      const qlbl = normalize(quadraLabel(t));
      return (
        label.includes(q) ||
        obs.includes(q) ||
        status.includes(q) ||
        cap.includes(q) ||
        tipoTxt.includes(q) ||
        qlbl.includes(q)
      );
    });
  }, [rows, busca, quadraSel, ocupacaoSel, tipoSel, ocupacaoMap]);

  // resumo
  const resumo = useMemo(() => {
    const total = filtrados.length;
    let ocupados = 0;
    filtrados.forEach((t) => {
      const tid = String(t.id ?? t.pk);
      if ((ocupacaoMap.get(tid) || 0) > 0) ocupados += 1;
    });
    const livres = total - ocupados; // "reservado" conta como livre (sem ocupantes)
    const taxa = total ? Math.round((ocupados / total) * 100) : 0;
    return { total, ocupados, livres, taxa };
  }, [filtrados, ocupacaoMap]);

  // abrir PDF no backend (url absoluta)
  async function gerarPDF() {
    const params = {};
    if (cemiterioId) params.cemiterio = cemiterioId;
    if (quadraSel && quadraSel !== "todas") params.quadra = quadraSel;
    if (ocupacaoSel && ocupacaoSel !== "todas") params.ocupacao = ocupacaoSel;
    if (tipoSel && tipoSel !== "todos") params.tipo = tipoSel;
    if (busca) params.q = busca;

    try {
      const { data } = await api.get("relatorios/tumulos/pdf-url/", { params });
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
        return;
      }
      throw new Error("sem pdf_url");
    } catch {
      // fallback absoluto
      const backendRoot = API_BASE.replace(/\/api\/?$/, "");
      const qs = new URLSearchParams(params).toString();
      const tries = [
        `${backendRoot}/relatorios/tumulos/pdf/?${qs}`,
        `${backendRoot}/relatorios/relatorio_tumulos_pdf/?${qs}`,
      ];
      for (const url of tries) {
        const w = window.open(url, "_blank");
        if (w) return;
      }
      alert("Não foi possível gerar o PDF. Verifique as rotas no backend.");
    }
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
        <div className="grid grid-cols-1 md:grid-cols-9 gap-3">
          <div className="md:col-span-2">
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

          <div className="md:col-span-2">
            <label className="block text-sm text-green-900 mb-1">Ocupação</label>
            <select
              value={ocupacaoSel}
              onChange={(e) => setOcupacaoSel(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todas">Todas</option>
              <option value="livre">Livres</option>
              <option value="ocupado">Ocupados</option>
              <option value="reservado">Reservados</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-green-900 mb-1">Tipo</label>
            <select
              value={tipoSel}
              onChange={(e) => setTipoSel(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todos">Todos</option>
              {TIPO_OPCOES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
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

                  // status para exibição
                  const token = statusToken(t, ocupados);
                  const displayStatus =
                    token === "livre"
                      ? "Disponível"
                      : token === "ocupado"
                      ? "Ocupado"
                      : token === "reservado"
                      ? "Reservado"
                      : capFirst(t.status || t.situacao || token);

                  const qLabel = quadraLabel(t);
                  const cap = capValue(t);

                  return (
                    <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                      <td className="py-2 px-3">{qLabel || "-"}</td>
                      <td className="py-2 px-3">{tumuloLabel(t)}</td>
                      <td className="py-2 px-3">
                        {t.usar_linha && (t.linha || t.linha === 0) ? t.linha : "-"}
                      </td>
                      <td className="py-2 px-3">{prettifyTipo(t)}</td>
                      <td className="py-2 px-3">{cap ?? "-"}</td>
                      <td className="py-2 px-3">{ocupados}</td>
                      <td className="py-2 px-3">{displayStatus}</td>
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
