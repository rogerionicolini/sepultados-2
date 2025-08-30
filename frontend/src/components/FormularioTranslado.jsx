// src/components/FormularioTranslado.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import InputMask from "react-input-mask";

const API_BASE = "http://127.0.0.1:8000/api/";
const CT_TRANSLADO = "sepultados_gestao.translado"; // ajuste se o app_label mudar

/* ===== helpers ===== */
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
  return id ? { id: Number(id), nome: nome || "Cemitério" } : null;
}

function normalizeApiErrors(data) {
  const out = { summary: "", fields: {} };
  if (!data) return out;
  if (typeof data === "string") {
    out.summary = data.includes("<html") ? "Erro interno (500)." : data;
    return out;
  }
  if (Array.isArray(data)) {
    out.summary = data.join(" ");
    return out;
  }
  const flat = (v) =>
    Array.isArray(v)
      ? v.map((x) => (x?.message ? x.message : String(x))).join(" ")
      : typeof v === "object" && v
      ? flat(v[Object.keys(v)[0]])
      : String(v);
  Object.entries(data).forEach(([k, v]) => {
    if (k === "detail" || k === "non_field_errors") out.summary = flat(v);
    else out.fields[k] = flat(v);
  });
  if (!out.summary) out.summary = "Revise os campos destacados em vermelho.";
  return out;
}
function focusFirstError(errorsObj, refs) {
  const k = Object.keys(errorsObj)[0];
  const el = k && refs?.current?.[k];
  if (el?.focus) {
    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* ===== rótulo de túmulo (mesmo padrão da Exumação) ===== */
function rotuloTumulo(t, quadrasMap = new Map()) {
  if (!t) return "";
  const id = t.id ?? t.pk ?? "";
  const base =
    t.identificador || t.codigo || t.nome || `T ${String(id).padStart(2, "0")}`;

  let linhaTxt = "";
  const lraw =
    typeof t.linha === "object" ? (t.linha?.id ?? t.linha?.numero ?? t.linha?.codigo) : t.linha;
  if (t.usar_linha && (lraw || lraw === 0)) linhaTxt = `L ${lraw}`;

  let quadraTxt = "";
  const q = t.quadra;
  const resolveQuadra = (qInfo) => {
    if (!qInfo) return "";
    if (qInfo.nome) return qInfo.nome;
    if (qInfo.codigo != null) {
      const cod = String(qInfo.codigo);
      return /^\d+$/.test(cod) ? `Quadra ${cod.padStart(2, "0")}` : cod;
    }
    if (qInfo.id != null) return `Quadra ${qInfo.id}`;
    return "";
  };
  if (q) {
    if (typeof q === "object") quadraTxt = resolveQuadra(q);
    else {
      const info = quadrasMap.get(String(q)) || quadrasMap.get(Number(q));
      quadraTxt = info ? resolveQuadra(info) : String(q);
    }
  }
  return [base, linhaTxt, quadraTxt].filter(Boolean).join(" ");
}

/* ===== dropdowns com busca (mostram valor selecionado em edição) ===== */
function TumuloDropdown({ value, onChange, api, cemiterioId, error, inputRef }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [itens, setItens] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [quadrasMap, setQuadrasMap] = useState(new Map());
  const wrapRef = useRef(null);

  async function carregarLista() {
    if (!cemiterioId) return;
    const [tumulosRes, quadrasRes] = await Promise.all([
      api.get("tumulos/", { params: { cemiterio: cemiterioId } }),
      api.get("quadras/", { params: { cemiterio: cemiterioId } }),
    ]);
    const quadArr = Array.isArray(quadrasRes.data) ? quadrasRes.data : quadrasRes.data?.results ?? [];
    const qMap = new Map();
    quadArr.forEach((q) => {
      const qid = String(q.id ?? q.pk);
      qMap.set(qid, { id: q.id ?? q.pk, nome: q.nome, codigo: q.codigo });
    });
    setQuadrasMap(qMap);

    const tArr = Array.isArray(tumulosRes.data) ? tumulosRes.data : tumulosRes.data?.results ?? [];
    setItens(tArr.map((t) => ({ id: t.id ?? t.pk, label: rotuloTumulo(t, qMap) })));
  }

  async function carregarSelecionado() {
    if (!cemiterioId || !value) return;
    try {
      let qMap = quadrasMap;
      if (qMap.size === 0) {
        const { data } = await api.get("quadras/", { params: { cemiterio: cemiterioId } });
        const arr = Array.isArray(data) ? data : data?.results ?? [];
        qMap = new Map();
        arr.forEach((q) =>
          qMap.set(String(q.id ?? q.pk), { id: q.id ?? q.pk, nome: q.nome, codigo: q.codigo })
        );
        setQuadrasMap(qMap);
      }
      const { data: t } = await api.get(`tumulos/${value}/`, { params: { cemiterio: cemiterioId } });
      setSelecionado({ id: t.id ?? t.pk, label: rotuloTumulo(t, qMap) });
    } catch {
      setSelecionado(null);
    }
  }

  useEffect(() => { if (open) carregarLista(); }, [open, cemiterioId]); // abrir -> carrega lista
  useEffect(() => { if (value && !open) carregarSelecionado(); /* eslint-disable-line */ }, [value, cemiterioId]);

  useEffect(() => {
    function out(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);

  const filtered = q
    ? itens.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()))
    : itens;

  const current =
    itens.find((o) => String(o.id) === String(value))?.label ||
    (selecionado && String(selecionado.id) === String(value) ? selecionado.label : "Selecione…");

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        ref={inputRef}
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2 rounded-lg border ${
          error ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
        } bg-white text-left hover:bg-[#f7fbf2]`}
        title={current}
      >
        <span className="truncate">{current}</span>
        <span className="float-right">▾</span>
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-[#e0efcf]">
          <div className="p-2 border-b border-[#e6f2d9]">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar túmulo…"
              className="w-full px-3 py-2 rounded-lg border border-[#bcd2a7] outline-none"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-600">Nenhum túmulo encontrado.</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.id}
                  className="px-3 py-2 hover:bg-[#f8fcf2] cursor-pointer"
                  onClick={() => {
                    onChange?.(o.id);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SepultadoDropdown({ value, onChange, api, cemiterioId, error, inputRef }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [itens, setItens] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const wrapRef = useRef(null);

  async function carregarLista() {
    if (!cemiterioId) return;
    const { data } = await api.get("sepultados/", { params: { cemiterio: cemiterioId } });
    const arr = Array.isArray(data) ? data : data?.results ?? [];
    setItens(
      arr.map((s) => ({
        id: s.id ?? s.pk,
        label: (s.numero_sepultamento ? `${s.numero_sepultamento} - ` : "") + (s.nome || "Sem nome"),
      }))
    );
  }

  async function carregarSelecionado() {
    if (!cemiterioId || !value) return;
    try {
      const { data: s } = await api.get(`sepultados/${value}/`, { params: { cemiterio: cemiterioId } });
      setSelecionado({
        id: s.id ?? s.pk,
        label: (s.numero_sepultamento ? `${s.numero_sepultamento} - ` : "") + (s.nome || "Sem nome"),
      });
    } catch {
      setSelecionado(null);
    }
  }

  useEffect(() => { if (open) carregarLista(); }, [open, cemiterioId]);
  useEffect(() => { if (value && !open) carregarSelecionado(); /* eslint-disable-line */ }, [value, cemiterioId]);

  useEffect(() => {
    function out(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);

  const filtered = q
    ? itens.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()))
    : itens;

  const current =
    itens.find((o) => String(o.id) === String(value))?.label ||
    (selecionado && String(selecionado.id) === String(value) ? selecionado.label : "Selecione…");

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        ref={inputRef}
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2 rounded-lg border ${
          error ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
        } bg-white text-left hover:bg-[#f7fbf2]`}
        title={current}
      >
        <span className="truncate">{current}</span>
        <span className="float-right">▾</span>
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-[#e0efcf]">
          <div className="p-2 border-b border-[#e6f2d9]">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar sepultado…"
              className="w-full px-3 py-2 rounded-lg border border-[#bcd2a7] outline-none"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-600">Nenhum sepultado encontrado.</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.id}
                  className="px-3 py-2 hover:bg-[#f8fcf2] cursor-pointer"
                  onClick={() => {
                    onChange?.(o.id);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== anexos ===== */
function AnexosWidget({ objectId, api, disabled }) {
  const [itens, setItens] = useState([]);
  const [arquivo, setArquivo] = useState(null);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  async function listar() {
    if (!objectId) return;
    try {
      const { data } = await api.get("anexos/", {
        params: { ct: CT_TRANSLADO, object_id: objectId },
      });
      const arr = Array.isArray(data) ? data : data?.results ?? [];
      setItens(arr);
    } catch {
      setItens([]);
    }
  }
  useEffect(() => {
    listar();
  }, [objectId]); // eslint-disable-line

  async function enviar(e) {
    e.preventDefault();
    if (!arquivo || !objectId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      if (nome) fd.append("nome", nome);
      fd.append("content_type", CT_TRANSLADO);
      fd.append("object_id", String(objectId));
      await api.post("anexos/", fd);
      setArquivo(null);
      setNome("");
      listar();
    } catch {
      alert("Erro ao enviar anexo.");
    } finally {
      setBusy(false);
    }
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este anexo?")) return;
    try {
      await api.delete(`anexos/${id}/`);
      listar();
    } catch {
      alert("Erro ao excluir.");
    }
  }

  return (
    <div className="bg-[#f0f8ea] rounded-xl p-4 shadow space-y-4">
      <div className="text-green-900 font-semibold">Anexos</div>
      <form onSubmit={enviar} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="file"
          disabled={disabled}
          onChange={(e) => setArquivo(e.target.files?.[0] || null)}
          className={`w-full border rounded-lg px-3 py-2 bg-white ${
            disabled ? "border-gray-300 opacity-60" : "border-[#bcd2a7]"
          }`}
        />
        <input
          placeholder="Descrição (opcional)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          disabled={disabled}
          className={`w-full border rounded-lg px-3 py-2 bg-white ${
            disabled ? "border-gray-300 opacity-60" : "border-[#bcd2a7]"
          }`}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled || !arquivo || busy}
            className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Enviando…" : "Enviar anexo"}
          </button>
        </div>
      </form>

      {itens.length === 0 ? (
        <div className="text-gray-600">Nenhum anexo.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-green-900 bg-[#e6f3d7]">
                <th className="py-2 px-3 rounded-l-lg">Arquivo</th>
                <th className="py-2 px-3">Nome</th>
                <th className="py-2 px-3 rounded-r-lg w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white/50">
              {itens.map((a) => (
                <tr key={a.id} className="border-t border-[#d8e9c0]">
                  <td className="py-2 px-3">
                    <a
                      href={a.arquivo_url || a.arquivo}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-blue-700"
                    >
                      baixar
                    </a>
                  </td>
                  <td className="py-2 px-3">{a.nome || "-"}</td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => excluir(a.id)}
                      className="px-3 py-1 rounded bg-[#e05151] text-white hover:opacity-90"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ===== formulário ===== */
export default function FormularioTranslado({ transladoId, onCancel, onSuccess }) {
  const isEdit = !!transladoId;
  const token = localStorage.getItem("accessToken");
  const cem = getCemiterioAtivo();

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  const [carregando, setCarregando] = useState(isEdit);
  const [salvando, setSalvando] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorSummary, setErrorSummary] = useState("");
  const refs = useRef({});

  const [form, setForm] = useState({
    numero_documento: "",
    data: "",

    sepultado: "",
    destino: "outro_tumulo",
    tumulo_destino: "",
    cemiterio_nome: "",
    cemiterio_endereco: "",

    motivo: "",
    observacoes: "",

    nome_responsavel: "",
    cpf: "",
    endereco: "",
    telefone: "",

    forma_pagamento: "gratuito",
    quantidade_parcelas: "",
    valor: "",
  });

  // carregar edição + deixar dropdowns com rótulo do valor atual
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setCarregando(true);
        const { data } = await api.get(`traslados/${transladoId}/`, {
          params: { cemiterio: cem?.id },
        });
        const v = (x) => (x === null || x === undefined ? "" : x);
        setForm((s) => ({
          ...s,
          numero_documento: v(data.numero_documento),
          data: v(data.data),

          sepultado: data.sepultado ?? "",
          destino: v(data.destino) || "outro_tumulo",
          tumulo_destino: data.tumulo_destino ?? "",
          cemiterio_nome: v(data.cemiterio_nome),
          cemiterio_endereco: v(data.cemiterio_endereco),

          motivo: v(data.motivo),
          observacoes: v(data.observacoes),

          nome_responsavel: v(data.nome_responsavel),
          cpf: v(data.cpf),
          endereco: v(data.endereco),
          telefone: v(data.telefone),

          forma_pagamento: v(data.forma_pagamento) || "gratuito",
          quantidade_parcelas: v(data.quantidade_parcelas),
          valor: data.valor ? String(data.valor).replace(".", ",") : "",
        }));
        // dropdowns buscarão o rótulo do selecionado sozinhos (fetch individual)
      } catch {
        alert("Não foi possível carregar este translado.");
        onCancel?.();
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transladoId]);

  // limpar campos conforme destino
  useEffect(() => {
    setErrors((e) => ({ ...e, tumulo_destino: undefined, cemiterio_nome: undefined }));
    setForm((s) => {
      if (s.destino === "outro_tumulo") {
        return { ...s, cemiterio_nome: "", cemiterio_endereco: "" };
      } else if (s.destino === "outro_cemiterio") {
        return { ...s, tumulo_destino: "" };
      } else {
        // ossário
        return { ...s, tumulo_destino: "", cemiterio_nome: "", cemiterio_endereco: "" };
      }
    });
  }, [form.destino]); // eslint-disable-line

  const setField = (name, value) => {
    setForm((s) => ({ ...s, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const err = (name) =>
    Array.isArray(errors?.[name]) ? errors[name].join(" ") : errors?.[name];

  const onChange = (e) => setField(e.target.name, e.target.value);
  const onChangeValor = (e) => {
    let v = (e.target.value || "").replace(/[^\d]/g, "");
    if (!v) return setField("valor", "");
    const int = v.slice(0, -2) || "0";
    const dec = v.slice(-2);
    const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setField("valor", `${intFmt},${dec}`);
  };

  function clientValidate(f) {
    const errs = {};
    if (!f.sepultado) errs.sepultado = "Selecione o sepultado.";
    if (!f.destino) errs.destino = "Selecione o destino.";
    if (f.destino === "outro_tumulo" && !f.tumulo_destino)
      errs.tumulo_destino = "Informe o túmulo de destino.";
    if (f.destino === "outro_cemiterio" && !f.cemiterio_nome?.trim())
      errs.cemiterio_nome = "Informe o nome do cemitério de destino.";

    if (f.forma_pagamento === "parcelado") {
      const n = Number(f.quantidade_parcelas);
      if (!n || n < 1) errs.quantidade_parcelas = "Informe a quantidade de parcelas.";
    }
    if (f.forma_pagamento !== "gratuito") {
      const v = Number((f.valor || "0").replace(/\./g, "").replace(",", "."));
      if (!v || v <= 0) errs.valor = "Informe o valor.";
    }
    return errs;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErrors({});
    setErrorSummary("");

    const errs = clientValidate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setErrorSummary("Revise os campos destacados em vermelho.");
      focusFirstError(errs, refs);
      return;
    }

    const payload = {
      ...form,
      valor:
        form.forma_pagamento === "gratuito"
          ? "0"
          : (form.valor || "0").replace(/\./g, "").replace(",", "."),
      ...(form.forma_pagamento !== "parcelado" ? { quantidade_parcelas: "" } : {}),
      ...(form.destino !== "outro_tumulo" ? { tumulo_destino: "" } : {}),
      ...(form.destino !== "outro_cemiterio" ? { cemiterio_nome: "", cemiterio_endereco: "" } : {}),
    };

    const fd = new FormData();
    const ignorar = new Set(["numero_documento"]);
    Object.entries(payload).forEach(([k, v]) => {
      if (ignorar.has(k)) return;
      if (v !== undefined && v !== null && v !== "") fd.append(k, v);
    });

    try {
      setSalvando(true);
      if (isEdit) {
        await api.put(`traslados/${transladoId}/`, fd, { params: { cemiterio: cem?.id } });
      } else {
        await api.post("traslados/", fd);
      }
      onSuccess?.();
    } catch (err0) {
      const ct = err0?.response?.headers?.["content-type"] || "";
      if (!ct.includes("application/json")) {
        setErrorSummary("Erro interno do servidor (500).");
        return;
      }
      const norm = normalizeApiErrors(err0?.response?.data);
      setErrors(norm.fields);
      setErrorSummary(norm.summary);
      focusFirstError(norm.fields, refs);
    } finally {
      setSalvando(false);
    }
  }

  if (!cem?.id) return <div className="text-sm text-red-600">Selecione um cemitério.</div>;
  if (carregando) return <div className="px-4 py-8 text-gray-700">Carregando…</div>;

  const input = (label, name, props = {}) => (
    <div key={name}>
      <label className="block text-sm text-green-900 mb-1">{label}</label>
      <input
        ref={(el) => (refs.current[name] = el)}
        name={name}
        value={form[name] || ""}
        onChange={onChange}
        className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
          err(name) ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
        }`}
        {...props}
      />
      {err(name) && <p className="mt-1 text-xs text-red-600">{err(name)}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">
          {isEdit ? "Editar Translado" : "Cadastro de Translado"}
        </h2>
      </div>

      {errorSummary && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-2">
          {errorSummary}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="bg-[#f0f8ea] rounded-xl p-6 shadow space-y-8">
          {/* Identificação */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Identificação</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-green-900 mb-1">Nº Documento</label>
                <input
                  value={form.numero_documento || "-"}
                  readOnly
                  disabled
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-gray-100 text-gray-700"
                />
              </div>
              {input("Data", "data", { type: "date" })}
            </div>
          </div>

          {/* Vínculos/Destino */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Vínculos e Destino</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-green-900 mb-1">Sepultado *</label>
                <SepultadoDropdown
                  value={form.sepultado}
                  onChange={(v) => setField("sepultado", v)}
                  api={api}
                  cemiterioId={cem.id}
                  error={err("sepultado")}
                  inputRef={(el) => (refs.current["sepultado"] = el)}
                />
              </div>

              <div>
                <label className="block text-sm text-green-900 mb-1">Destino *</label>
                <select
                  ref={(el) => (refs.current["destino"] = el)}
                  name="destino"
                  value={form.destino}
                  onChange={onChange}
                  className={`w-full border rounded-lg px-3 py-2 bg-white ${
                    err("destino") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                >
                  <option value="outro_tumulo">Outro Túmulo</option>
                  <option value="outro_cemiterio">Outro Cemitério</option>
                </select>
                {err("destino") && <p className="mt-1 text-xs text-red-600">{err("destino")}</p>}
              </div>

              {form.destino === "outro_tumulo" && (
                <div>
                  <label className="block text-sm text-green-900 mb-1">Túmulo de Destino *</label>
                  <TumuloDropdown
                    value={form.tumulo_destino}
                    onChange={(v) => setField("tumulo_destino", v)}
                    api={api}
                    cemiterioId={cem.id}
                    error={err("tumulo_destino")}
                    inputRef={(el) => (refs.current["tumulo_destino"] = el)}
                  />
                </div>
              )}

              {form.destino === "outro_cemiterio" && (
                <>
                  {input("Cemitério (nome) *", "cemiterio_nome")}
                  {input("Endereço do Cemitério", "cemiterio_endereco")}
                </>
              )}
            </div>
          </div>

          {/* Motivo/Observações */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Informações</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm text-green-900 mb-1">Motivo</label>
                <textarea
                  ref={(el) => (refs.current["motivo"] = el)}
                  name="motivo"
                  value={form.motivo}
                  onChange={onChange}
                  rows={3}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    err("motivo") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm text-green-900 mb-1">Observações</label>
                <textarea
                  ref={(el) => (refs.current["observacoes"] = el)}
                  name="observacoes"
                  value={form.observacoes}
                  onChange={onChange}
                  rows={3}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    err("observacoes") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Responsável */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Responsável</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {input("Nome", "nome_responsavel")}
              <div>
                <label className="block text-sm text-green-900 mb-1">CPF</label>
                <InputMask
                  mask="999.999.999-99"
                  name="cpf"
                  value={form.cpf || ""}
                  onChange={onChange}
                  inputRef={(el) => (refs.current["cpf"] = el)}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    err("cpf") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
                {err("cpf") && <p className="mt-1 text-xs text-red-600">{err("cpf")}</p>}
              </div>
              <div>
                <label className="block text-sm text-green-900 mb-1">Telefone</label>
                <InputMask
                  mask="(99) 99999-9999"
                  name="telefone"
                  value={form.telefone || ""}
                  onChange={onChange}
                  inputRef={(el) => (refs.current["telefone"] = el)}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    err("telefone") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
                {err("telefone") && <p className="mt-1 text-xs text-red-600">{err("telefone")}</p>}
              </div>
              {input("Endereço", "endereco")}
            </div>
          </div>

          {/* Pagamento */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Pagamento</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-green-900 mb-1">Forma de Pagamento</label>
                <select
                  ref={(el) => (refs.current["forma_pagamento"] = el)}
                  name="forma_pagamento"
                  value={form.forma_pagamento}
                  onChange={onChange}
                  className={`w-full border rounded-lg px-3 py-2 bg-white ${
                    err("forma_pagamento") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                >
                  <option value="gratuito">Gratuito</option>
                  <option value="avista">À Vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
                {err("forma_pagamento") && (
                  <p className="mt1 text-xs text-red-600">{err("forma_pagamento")}</p>
                )}
              </div>

              {form.forma_pagamento === "parcelado" &&
                input("Quantidade de Parcelas", "quantidade_parcelas", { type: "number", min: 1 })}

              {form.forma_pagamento !== "gratuito" && (
                <div>
                  <label className="block text-sm text-green-900 mb-1">Valor (R$)</label>
                  <input
                    ref={(el) => (refs.current["valor"] = el)}
                    name="valor"
                    value={form.valor}
                    onChange={onChangeValor}
                    inputMode="numeric"
                    placeholder="0,00"
                    className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                      err("valor") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                    }`}
                  />
                  {err("valor") && <p className="mt-1 text-xs text-red-600">{err("valor")}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="px-4 py-2 rounded-lg border border-[#bcd2a7] text-green-900 hover:bg-[#f0f8ea]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>

      {/* anexos */}
      <AnexosWidget objectId={isEdit ? transladoId : null} api={api} disabled={!isEdit} />
    </div>
  );
}
