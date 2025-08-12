// src/pages/RelatorioAuditorias.jsx
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

// ===== Normalizadores =====
const toDateObj = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const toISODate = (v) => {
  const d = toDateObj(v);
  return d ? d.toISOString().slice(0, 10) : "";
};
const fmtDateTime = (v) => {
  const d = toDateObj(v);
  if (!d) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// deriva timestamp
const tsOf = (r) =>
  r.timestamp || r.data_hora || r.created_at || r.updated_at || r.data || r.dt || null;

// deriva usuário (nome)
const userNameOf = (r) =>
  r.usuario_nome ||
  r.usuario?.nome ||
  r.usuario?.full_name ||
  r.usuario?.username ||
  r.user?.name ||
  r.user?.username ||
  r.actor?.name ||
  r.actor ||
  r.usuario ||
  r.user ||
  "-";

// deriva entidade/model
const entityOf = (r) =>
  r.objeto_tipo ||
  r.content_type ||
  r.model ||
  r.object_model ||
  r.entidade ||
  r.tipo ||
  "-";

// deriva rótulo do objeto afetado
function objLabelOf(r) {
  return (
    r.objeto_repr ||
    r.object_repr ||
    r.objeto_label ||
    r.label ||
    r.objeto ||
    r.object ||
    `${entityOf(r)}#${r.objeto_id || r.object_id || r.id || "-"}`
  );
}

// normaliza ação
function normalizeAction(a) {
  const s = String(a || "").toLowerCase();
  if (/create|cria|inser|inclu/.test(s)) return "create";
  if (/update|alter|edit|modif|atualiz/.test(s)) return "update";
  if (/delete|exclu|remov/.test(s)) return "delete";
  return s || "other";
}

// status/resultado (sucesso/erro) se existir
function resultOf(r) {
  const ok =
    r.sucesso ?? r.success ?? r.result === "ok" ?? r.status === "ok" ?? r.ok;
  const err =
    r.erro || r.error || r.result === "error" || r.status === "error";
  if (ok === true) return "ok";
  if (err) return "erro";
  return null;
}

export default function RelatorioAuditorias() {
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

  // ===== Estado =====
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [acaoSel, setAcaoSel] = useState("todas");      // todas | create | update | delete | other
  const [usuarioSel, setUsuarioSel] = useState("todos"); // todos | <nome>
  const [entidadeSel, setEntidadeSel] = useState("todas");
  const [busca, setBusca] = useState("");

  // ===== Carregar =====
  const ENDPOINTS_TENTATIVA = [
    "auditorias/",
    "auditoria/",
    "historicos_acoes/",
    "historicos/",
    "logs/",
    "acoes/",
  ];

  async function carregar() {
    setLoading(true);
    setErro("");
    const params = {};
    if (cemiterioId) params.cemiterio = cemiterioId;

    let achou = false;
    for (const ep of ENDPOINTS_TENTATIVA) {
      try {
        const { data } = await api.get(ep, { params });
        const arr = Array.isArray(data) ? data : data?.results ?? [];
        if (Array.isArray(arr)) {
          setRows(arr);
          achou = true;
          break;
        }
      } catch {
        /* tenta próximo endpoint */
      }
    }
    if (!achou) {
      setErro("Não foi possível carregar as auditorias. Confira o endpoint no backend.");
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cemiterioId]);

  // ===== Opções dinâmicas =====
  const usuariosOpts = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(userNameOf(r)));
    return ["todos", ...Array.from(set).filter(Boolean)];
  }, [rows]);

  const entidadesOpts = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(String(entityOf(r))));
    return ["todas", ...Array.from(set).filter(Boolean)];
  }, [rows]);

  // ===== Filtragem cliente =====
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ini = dataInicio ? new Date(dataInicio) : null;
    const fim = dataFim ? new Date(dataFim) : null;

    return rows.filter((r) => {
      const ts = tsOf(r);
      if (ini || fim) {
        const d = toDateObj(ts);
        if (ini && (!d || d < ini)) return false;
        if (fim && (!d || d > fim)) return false;
      }
      if (acaoSel !== "todas" && normalizeAction(r.acao || r.action || r.evento) !== acaoSel)
        return false;
      if (usuarioSel !== "todos" && userNameOf(r) !== usuarioSel) return false;
      if (entidadeSel !== "todas" && String(entityOf(r)) !== entidadeSel) return false;

      if (!q) return true;
      const alvo = [
        objLabelOf(r),
        String(r.objeto_id || r.object_id || ""),
        String(r.ip || r.ip_address || ""),
        String(r.detalhes || r.descricao || r.detail || r.changes || ""),
        userNameOf(r),
        entityOf(r),
      ]
        .join(" ")
        .toLowerCase();

      return alvo.includes(q);
    });
  }, [rows, dataInicio, dataFim, acaoSel, usuarioSel, entidadeSel, busca]);

  // ===== Resumo =====
  const resumo = useMemo(() => {
    const base = { total: filtrados.length, create: 0, update: 0, delete: 0, other: 0, erros: 0 };
    filtrados.forEach((r) => {
      base[normalizeAction(r.acao || r.action || r.evento)] += 1;
      if (resultOf(r) === "erro") base.erros += 1;
    });
    return base;
  }, [filtrados]);

  // ===== PDF =====
  async function gerarPDF() {
    const qs = new URLSearchParams();
    if (dataInicio) qs.set("data_inicio", dataInicio);
    if (dataFim) qs.set("data_fim", dataFim);
    if (acaoSel && acaoSel !== "todas") qs.set("acao", acaoSel);
    if (usuarioSel && usuarioSel !== "todos") qs.set("usuario", usuarioSel);
    if (entidadeSel && entidadeSel !== "todas") qs.set("entidade", entidadeSel);
    if (busca) qs.set("q", busca);

    const tries = [
      "/relatorios/auditorias/pdf/",
      "/relatorios/relatorio_auditorias_pdf/",
      "/relatorio/auditorias/pdf/",
      "/relatorio/relatorio_auditorias_pdf/",
      "/relatorios/historicos/pdf/",
      "/relatorio/historicos/pdf/",
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
        // tenta próxima rota
      }
    }
    alert("Não foi possível gerar o PDF. Verifique a URL do relatório no backend.");
  }

  // ===== UI =====
  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-green-900">Relatórios • Auditorias</h1>
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
            <label className="block text-sm text-green-900 mb-1">Ação</label>
            <select
              value={acaoSel}
              onChange={(e) => setAcaoSel(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              <option value="todas">Todas</option>
              <option value="create">Criação</option>
              <option value="update">Atualização</option>
              <option value="delete">Exclusão</option>
              <option value="other">Outras</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Usuário</label>
            <select
              value={usuarioSel}
              onChange={(e) => setUsuarioSel(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              {usuariosOpts.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Entidade</label>
            <select
              value={entidadeSel}
              onChange={(e) => setEntidadeSel(e.target.value)}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
            >
              {entidadesOpts.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-green-900 mb-1">Buscar</label>
            <input
              placeholder="Objeto, ID, usuário, IP, detalhes…"
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
            <div className="text-xs text-green-900">Criações</div>
            <div className="text-xl font-semibold">{resumo.create}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Atualizações</div>
            <div className="text-xl font-semibold">{resumo.update}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Exclusões</div>
            <div className="text-xl font-semibold">{resumo.delete}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e0efcf]">
            <div className="text-xs text-green-900">Falhas</div>
            <div className="text-xl font-semibold">{resumo.erros}</div>
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
                  <th className="py-2 px-3">IP</th>
                  <th className="py-2 px-3 rounded-r-lg">Detalhes</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((r, i) => {
                  const key = r.id ?? r.pk ?? i;
                  const ac = normalizeAction(r.acao || r.action || r.evento);
                  const cls =
                    ac === "delete"
                      ? "text-red-800"
                      : ac === "create"
                      ? "text-green-800"
                      : ac === "update"
                      ? "text-yellow-800"
                      : "text-gray-800";
                  return (
                    <tr key={key} className="border-t border-[#d8e9c0] hover:bg-white">
                      <td className="py-2 px-3">{fmtDateTime(tsOf(r))}</td>
                      <td className="py-2 px-3">{userNameOf(r)}</td>
                      <td className={`py-2 px-3 capitalize ${cls}`}>{ac}</td>
                      <td className="py-2 px-3">{entityOf(r)}</td>
                      <td className="py-2 px-3">
                        {objLabelOf(r)}
                        {(r.objeto_id || r.object_id) && (
                          <span className="text-gray-500"> (ID {r.objeto_id || r.object_id})</span>
                        )}
                      </td>
                      <td className="py-2 px-3">{r.ip || r.ip_address || "-"}</td>
                      <td className="py-2 px-3">
                        {r.detalhes || r.descricao || r.detail || r.changes || "-"}
                      </td>
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
