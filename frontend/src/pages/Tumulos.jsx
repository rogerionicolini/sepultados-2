// src/pages/Tumulos.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";
const ENDPOINT = "tumulos/";
const QUADRAS_EP = "quadras/";
const SEPULTADOS_EP = "sepultados/"; // ajuste se necessário

// ------ helpers comuns ------
function getCemiterioAtivo() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.id) return { id: Number(o.id), nome: o.nome || "Cemitério" };
    }
  } catch {}
  const id = localStorage.getItem("cemiterioAtivoId");
  const nome = localStorage.getItem("cemiterioAtivoNome");
  if (id) return { id: Number(id), nome: nome || "Cemitério" };
  return null;
}

const TIPOS = [
  { value: "tumulo", label: "Túmulo" },
  { value: "perpetua", label: "Perpétua" },
  { value: "sepultura", label: "Sepultura" },
  { value: "jazigo", label: "Jazigo" },
  { value: "outro", label: "Outro" },
];

function getStatusFromRow(t) {
  if (t?.reservado) return "reservado";
  const s = (t?.status || "").toString().toLowerCase();
  if (s) return s;
  if (Number(t?.sepultados_total || 0) > 0) return "ocupado";
  return "disponivel";
}

// ➜ prioriza campos anotados pelo backend
function getContratoNumero(t) {
  return (
    t?.contrato_numero ??
    t?.concessao?.numero ??
    t?.contrato_concessao?.numero ??
    t?.concessao_numero ??
    null
  );
}

/* ================= Exumação/Translado helpers ================== */
function _first(...cands) {
  for (const c of cands) if (c !== undefined && c !== null && c !== "") return c;
  return undefined;
}
function _toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return ["1", "true", "sim", "s", "y", "yes"].includes(s);
  }
  return false;
}

// -------- Exumação --------
function exumacaoStatusFromRow(s) {
  const b = _first(s.exumado, s.exumado_flag, s.exumada, s.is_exumado);
  const statusTxt = _first(s.exumacao_status, s.exumacao, s.status_exumacao) || "";
  if (b !== undefined) return _toBool(b) ? (statusTxt || "Exumado") : (statusTxt || "—");
  return statusTxt || "—";
}
function exumacaoDataFromRow(s) {
  return (
    _first(
      s.exumacao_data,
      s.data_exumacao,
      s.data_da_exumacao,
      s.data_exum,
      s.exumado_em
    ) || ""
  );
}
function exumacaoDisplay(s) {
  const st = (exumacaoStatusFromRow(s) || "").toString();
  const dt = exumacaoDataFromRow(s);
  if (!st || st === "—") return "—";
  return dt ? `${st} em ${dt}` : st;
}

// -------- Translado (aceita “traslado/translado” + variações) --------
function transladoStatusFromRow(s) {
  const b = _first(
    s.trasladado,            // ✔ “trasladado” (S)
    s.transladado,           // “transladado” (N)
    s.transferido,
    s.is_trasladado,
    s.is_transladado,
    s.tem_traslado,          // ✔ “traslado” (S)
    s.tem_translado,         // “translado” (N)
    s.possui_traslado,
    s.possui_translado
  );
  const statusTxt =
    _first(
      s.traslado_status,
      s.translado_status,
      s.status_traslado,
      s.status_translado,
      s.ultimo_traslado_status,
      s.ultimo_translado_status
    ) || "";

  if (b !== undefined) return _toBool(b) ? (statusTxt || "Transferido") : (statusTxt || "—");

  // fallback: alguns backends mandam só um texto em s.status
  const st = (s.status || "").toString().toLowerCase();
  if (st.includes("traslad") || st.includes("transfer")) return statusTxt || "Transferido";

  return statusTxt || "—";
}
function transladoDataFromRow(s) {
  return (
    _first(
      s.traslado_data,        // ✔ “traslado” (S)
      s.translado_data,       // “translado” (N)
      s.data_traslado,
      s.data_translado,
      s.data_do_traslado,
      s.data_do_translado,
      s.transferido_em,
      s.ultimo_traslado_data,
      s.ultimo_translado_data
    ) || ""
  );
}
function transladoDisplay(s) {
  const st = (transladoStatusFromRow(s) || "").toString();
  const dt = transladoDataFromRow(s);
  if (!st || st === "—") return "—";
  return dt ? `${st} em ${dt}` : st;
}

/* Status consolidado do SEPULTADO */
function statusSepultadoFromRow(s) {
  const ex = _toBool(_first(s.exumado, s.exumado_flag, s.exumada, s.is_exumado));
  const tr = _toBool(
    _first(
      s.trasladado, s.transladado, s.transferido,
      s.is_trasladado, s.is_transladado,
      s.tem_traslado, s.tem_translado
    )
  );
  if (tr) return "Trasladado";
  if (ex) return "Exumado";
  return "Sepultado";
}
/* ================================================================ */

function StatusPill({ status }) {
  const s = (status || "").toString().toLowerCase();
  const map = {
    disponivel:
      "bg-green-100 text-green-800 border border-green-300 font-semibold",
    ocupado:
      "bg-red-100 text-red-800 border border-red-300 font-semibold",
    reservado:
      "bg-amber-100 text-amber-800 border border-amber-300 font-semibold",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded ${
        map[s] || "bg-gray-100 text-gray-700 border border-gray-300"
      }`}
    >
      {s || "-"}
    </span>
  );
}

// ------ Dropdown de Quadras (busca + lista) ------
function QuadraDropdown({ options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, q]);

  useEffect(() => {
    function outside(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const currentLabel =
    options.find((o) => String(o.id) === String(value))?.label || "Selecione…";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w/full px-3 py-2 rounded-lg border border-[#bcd2a7] bg-white text-left ${
          disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-[#f7fbf2]"
        }`}
      >
        <span className="truncate">{currentLabel}</span>
        <span className="float-right">▾</span>
      </button>

      {open && !disabled && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-[#e0efcf] z-50">
          <div className="p-2 border-b border-[#e6f2d9]">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar quadra…"
              className="w-full px-3 py-2 rounded-lg border border-[#bcd2a7] outline-none"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {filtered.map((o) => (
              <div
                key={o.id}
                className="px-3 py-2 hover:bg-[#f8fcf2] cursor-pointer flex items-center justify-between"
                onClick={() => {
                  onChange?.(o.id);
                  setOpen(false);
                }}
              >
                <span className="truncate">{o.label}</span>
                {String(value) === String(o.id) && (
                  <span className="text-xs bg-[#224c15] text-white px-2 py-0.5 rounded">
                    Selecionado
                  </span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-600">
                Nenhuma quadra encontrada.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ====== Página ======
export default function Tumulos() {
  const [prefeituraId, setPrefeituraId] = useState(null);
  const [cemAtivo, setCemAtivo] = useState(getCemiterioAtivo());

  const [itens, setItens] = useState([]);
  const [quadras, setQuadras] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // expand/collapse + sepultados
  const [expanded, setExpanded] = useState({});
  const [sepLoading, setSepLoading] = useState({});
  const [sepPorTumulo, setSepPorTumulo] = useState({});

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    tipo_estrutura: "tumulo",
    identificador: "",
    usar_linha: false,
    linha: "",
    reservado: false,
    motivo_reserva: "",
    capacidade: "",
    quadra: "",
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

  const qsWith = (ep, params = {}) => {
    const qs = new URLSearchParams();
    if (prefeituraId) qs.set("prefeitura", prefeituraId);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, v);
    });
    const s = qs.toString();
    return s ? `${ep}?${s}` : ep;
  };

  // -------- helpers ----------
  const listar = async () => {
    const url = qsWith(ENDPOINT, { cemiterio: cemAtivo?.id });
    const res = await api.get(url);
    const data = res.data;
    return Array.isArray(data) ? data : data?.results ?? [];
  };

  const listarQuadras = async () => {
    const url = qsWith(QUADRAS_EP, { cemiterio: cemAtivo?.id });
    const res = await api.get(url);
    const arr = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    return arr.map((q) => ({
      id: q.id ?? q.pk,
      label: q.codigo || q.nome || `Quadra ${q.id ?? q.pk}`,
    }));
  };

  const listarSepultados = async (tumuloId) => {
    const url = qsWith(SEPULTADOS_EP, { tumulo: tumuloId });
    const res = await api.get(url);
    const data = res.data;
    return Array.isArray(data) ? data : data?.results ?? [];
  };

  const criar = (payload) =>
    api.post(qsWith(ENDPOINT), payload, {
      headers: { "Content-Type": "application/json" },
    });

  const atualizar = (id, payload) =>
    api.put(qsWith(`${ENDPOINT}${id}/`), payload, {
      headers: { "Content-Type": "application/json" },
    });

  const deletar = (id) => api.delete(qsWith(`${ENDPOINT}${id}/`));

  // ------- PDF (Relatório) -------
  async function gerarPdfSepultados(t) {
    try {
      const id = t.id ?? t.pk;
      if (!cemAtivo?.id) {
        alert("Selecione um cemitério para gerar o relatório.");
        return;
      }
      const res = await api.get(`${ENDPOINT}${id}/pdf_sepultados/`, {
        params: { cemiterio: cemAtivo.id },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `sepultados_tumulo_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e) {
      console.error("PDF erro:", e?.response?.status, e?.response?.data || e);
      alert("Não foi possível gerar o PDF deste túmulo.");
    }
  }

  async function carregar() {
    try {
      setLoading(true);
      setErro("");
      const [data, qds] = await Promise.all([listar(), listarQuadras()]);
      setItens(data);
      setQuadras(qds);
    } catch (e) {
      console.error("listar ERRO:", e?.response?.status, e?.response?.data || e);
      setErro("Não foi possível carregar os túmulos.");
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

  // ouvir troca do cemitério
  useEffect(() => {
    const onChanged = (e) => setCemAtivo(e?.detail || getCemiterioAtivo());
    const onStorage = () => setCemAtivo(getCemiterioAtivo());
    window.addEventListener("cemiterio:changed", onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cemiterio:changed", onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    carregarPrefeitura();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (cemAtivo?.id) {
      setExpanded({});
      setSepPorTumulo({});
      carregar();
    }
  }, [prefeituraId, cemAtivo?.id]); // eslint-disable-line

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((x) =>
      (x.identificador || x.codigo || x.nome || "")
        .toString()
        .toLowerCase()
        .includes(q)
    );
  }, [itens, busca]);

  // Mapa id->label de quadras
  const quadraMap = useMemo(() => {
    const m = new Map();
    quadras.forEach((q) => m.set(String(q.id), q.label));
    return m;
  }, [quadras]);

  function quadraLabelFromRow(t) {
    if (t?.quadra && typeof t.quadra === "object") {
      return t.quadra.codigo || t.quadra.nome || t.quadra.id || "-";
    }
    if (t?.quadra) {
      const lab = quadraMap.get(String(t.quadra));
      return lab || t.quadra;
    }
    return "-";
  }

  // --------- ações ---------
  function abrirCriar() {
    setEditando(null);
    setForm({
      tipo_estrutura: "tumulo",
      identificador: "",
      usar_linha: false,
      linha: "",
      reservado: false,
      motivo_reserva: "",
      capacidade: "",
      quadra: "",
    });
    setErro("");
    setModalOpen(true);
  }

  function abrirEditar(t) {
    setEditando(t);
    setForm({
      tipo_estrutura: t.tipo_estrutura || "tumulo",
      identificador: t.identificador || t.codigo || t.nome || "",
      usar_linha: !!t.usar_linha,
      linha: t.linha ?? "",
      reservado: !!t.reservado,
      motivo_reserva: t.motivo_reserva || "",
      capacidade: t.capacidade ?? "",
      quadra: t.quadra?.id ?? t.quadra ?? "",
    });
    setErro("");
    setModalOpen(true);
  }

  function validarForm() {
    if (!form.identificador?.trim()) return "Informe o identificador do túmulo.";
    if (!form.quadra) return "Selecione a quadra.";
    if (form.usar_linha && (form.linha === "" || Number(form.linha) < 0))
      return "Informe a linha (número) quando 'Usar linha' estiver marcado.";
    if (form.reservado && !form.motivo_reserva?.trim())
      return "Informe o motivo da reserva quando 'Reservar este túmulo' estiver marcado.";
    return null;
  }

  async function salvar() {
    try {
      setSalvando(true);
      setErro("");

      if (!cemAtivo?.id) {
        setErro("Selecione um cemitério antes de salvar.");
        return;
      }
      const msg = validarForm();
      if (msg) {
        setErro(msg);
        return;
      }

      const payload = {
        tipo_estrutura: form.tipo_estrutura || "tumulo",
        identificador: form.identificador.trim(),
        usar_linha: !!form.usar_linha,
        linha:
          form.usar_linha && form.linha !== "" ? Number(form.linha) : null,
        reservado: !!form.reservado,
        motivo_reserva: form.reservado ? form.motivo_reserva : "",
        capacidade:
          form.capacidade === "" || form.capacidade === null
            ? null
            : Number(form.capacidade),
        cemiterio: Number(cemAtivo.id),
        quadra: Number(form.quadra),
      };

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
    if (!window.confirm("Excluir este túmulo?")) return;
    try {
      await deletar(id);
      await carregar();
    } catch (e) {
      console.error("excluir ERRO:", e?.response?.status, e?.response?.data || e);
      alert("Erro ao excluir.");
    }
  }

  async function toggleExpand(t) {
    const id = t.id ?? t.pk;
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
    if (!sepPorTumulo[id]) {
      try {
        setSepLoading((m) => ({ ...m, [id]: true }));
        const data = await listarSepultados(id);
        setSepPorTumulo((m) => ({ ...m, [id]: data }));
      } catch (e) {
        console.warn("sepultados erro:", e?.response?.status, e?.response?.data || e);
        setSepPorTumulo((m) => ({ ...m, [id]: [] }));
      } finally {
        setSepLoading((m) => ({ ...m, [id]: false }));
      }
    }
  }

  // Sem cemitério
  if (!cemAtivo?.id) {
    return (
      <div className="text-sm text-red-600">
        Selecione um cemitério para gerenciar os túmulos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">Túmulos</h2>

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
            placeholder="Buscar por identificador..."
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
                  <th className="py-2 px-3 rounded-l-lg w-6"></th>
                  <th className="py-2 px-3">Identificador</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Quadra</th>
                  <th className="py-2 px-3">Linha</th>
                  <th className="py-2 px-3">Capacidade</th>
                  <th className="py-2 px-3">Contrato</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 w-56 rounded-r-lg">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((t, idx) => {
                  const id = t.id ?? t.pk;
                  const quadraNome = quadraLabelFromRow(t);
                  const tipoLabel =
                    TIPOS.find(
                      (x) =>
                        x.value === (t.tipo_estrutura || "").toString().toLowerCase()
                    )?.label || t.tipo_estrutura || "-";
                  const linhaTxt =
                    t.usar_linha && (t.linha || t.linha === 0) ? String(t.linha) : "-";
                  const capacidadeTxt =
                    t.capacidade || t.capacidade === 0 ? String(t.capacidade) : "-";
                  const contratoNum = getContratoNumero(t);

                  return (
                    <React.Fragment key={id ?? `${t.identificador}-${idx}`}>
                      <tr className="border-top border-[#d8e9c0] hover:bg-white">
                        <td className="py-2 px-3">
                          <button
                            onClick={() => toggleExpand(t)}
                            className="rounded border border-[#bcd2a7] px-1.5 text-xs bg-white hover:bg-[#f7fbf2]"
                            title={expanded[id] ? "Fechar" : "Abrir"}
                          >
                            {expanded[id] ? "▲" : "▼"}
                          </button>
                        </td>
                        <td
                          className="py-2 px-3 cursor-pointer"
                          onClick={() => toggleExpand(t)}
                          title="Ver sepultados"
                        >
                          {t.identificador || t.nome}
                        </td>
                        <td className="py-2 px-3">{tipoLabel}</td>
                        <td className="py-2 px-3">{quadraNome}</td>
                        <td className="py-2 px-3">{linhaTxt}</td>
                        <td className="py-2 px-3">{capacidadeTxt}</td>
                        <td className="py-2 px-3">
                          {contratoNum ? (
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                              Nº {contratoNum}
                            </span>
                          ) : t.tem_contrato_ativo ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Com contrato
                            </span>
                          ) : (
                            <span className="text-gray-600">Sem contrato ativo</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <StatusPill status={getStatusFromRow(t)} />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => gerarPdfSepultados(t)}
                              className="px-3 py-1 rounded border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
                              title="Abrir relatório (PDF)"
                            >
                              Relatório
                            </button>
                            <button
                              onClick={() => abrirEditar(t)}
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

                      {expanded[id] && (
                        <tr className="bg-white">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="rounded-lg border border-[#e0efcf] p-3">
                              <div className="text-green-900 font-semibold mb-2">
                                Sepultados neste túmulo
                              </div>
                              {sepLoading[id] ? (
                                <div className="text-gray-600">Carregando…</div>
                              ) : (sepPorTumulo[id] || []).length === 0 ? (
                                <div className="text-gray-600">
                                  Nenhum sepultado registrado.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="text-left bg-[#eef7e6] text-green-900">
                                        <th className="py-1 px-2 rounded-l">Nome</th>
                                        <th className="py-1 px-2">Data do sepultamento</th>
                                        <th className="py-1 px-2">Status</th>
                                        <th className="py-1 px-2">Exumação</th>
                                        <th className="py-1 px-2 rounded-r">Translado</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sepPorTumulo[id].map((s, i2) => (
                                        <tr key={s.id ?? i2} className="border-t">
                                          <td className="py-1 px-2">
                                            {s.nome || s.nome_completo || "-"}
                                          </td>
                                          <td className="py-1 px-2">
                                            {s.data_sepultamento || s.data || "-"}
                                          </td>
                                          <td className="py-1 px-2">
                                            {statusSepultadoFromRow(s)}
                                          </td>
                                          <td className="py-1 px-2">
                                            {exumacaoDisplay(s)}
                                          </td>
                                          <td className="py-1 px-2">
                                            {transladoDisplay(s)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td className="py-6 px-3 text-gray-600" colSpan={9}>
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
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-900">
                {editando ? "Editar Túmulo" : "Novo Túmulo"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-green-900 mb-1">Identificador*</label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.identificador}
                  onChange={(e) => setForm({ ...form, identificador: e.target.value })}
                  placeholder="Ex.: T-001"
                />
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">Tipo de estrutura</label>
                <select
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
                  value={form.tipo_estrutura}
                  onChange={(e) => setForm({ ...form, tipo_estrutura: e.target.value })}
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="usar_linha"
                  type="checkbox"
                  checked={form.usar_linha}
                  onChange={(e) => setForm({ ...form, usar_linha: e.target.checked })}
                />
                <label htmlFor="usar_linha" className="text-sm text-green-900">
                  Usar linha
                </label>
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">Linha</label>
                <input
                  type="number"
                  min="0"
                  disabled={!form.usar_linha}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none disabled:bg-gray-100"
                  value={form.linha}
                  onChange={(e) => setForm({ ...form, linha: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="reservado"
                  type="checkbox"
                  checked={form.reservado}
                  onChange={(e) => setForm({ ...form, reservado: e.target.checked })}
                />
                <label htmlFor="reservado" className="text-sm text-green-900">
                  Reservar este túmulo
                </label>
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">Motivo da reserva</label>
                <input
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.motivo_reserva}
                  onChange={(e) => setForm({ ...form, motivo_reserva: e.target.value })}
                  placeholder="Opcional (obrigatório se reservar)"
                  disabled={!form.reservado}
                />
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">Capacidade de sepultamentos</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                  value={form.capacidade}
                  onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
                  placeholder="Opcional"
                />
              </div>

              {/* Dropdown de quadras com busca */}
              <div>
                <label className="block text-sm text-green-900 mb-1">Quadra*</label>
                <QuadraDropdown
                  options={quadras}
                  value={form.quadra}
                  onChange={(id) => setForm({ ...form, quadra: id })}
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
