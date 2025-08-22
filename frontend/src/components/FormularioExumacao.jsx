// src/components/FormularioExumacao.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import InputMask from "react-input-mask";

/** Ajuste conforme o seu ambiente */
const API_BASE = "http://127.0.0.1:8000/api/";
const CT_EXUMACAO = "sepultados_gestao.exumacao";

/** Configuração de regra de negócio (client-side) */
const MIN_DIAS_EXUMACAO = 1095; // 3 anos. Ajuste se a regra for diferente.

/* ===== Helpers comuns ===== */
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

/** Normaliza erros JSON do backend em { summary: string[]; fields: {campo: string[]} } */
function normalizeApiErrors(data) {
  const out = { summary: [], fields: {} };
  if (!data) return out;

  const push = (arrOrStr) => {
    if (!arrOrStr) return;
    if (Array.isArray(arrOrStr)) arrOrStr.forEach((s) => push(s));
    else if (typeof arrOrStr === "object") {
      Object.entries(arrOrStr).forEach(([k, v]) => {
        push(v);
      });
    } else out.summary.push(String(arrOrStr));
  };

  if (typeof data === "string") {
    out.summary.push(data.includes("<html") ? "Erro interno do servidor (500)." : data);
    return out;
  }

  if (Array.isArray(data)) {
    data.forEach((x) => out.summary.push(String(x)));
    return out;
  }

  // Campos
  Object.entries(data).forEach(([k, v]) => {
    const arr =
      Array.isArray(v)
        ? v.map((x) => (typeof x === "object" && x?.message ? String(x.message) : String(x)))
        : typeof v === "object" && v !== null
        ? [JSON.stringify(v)]
        : [String(v)];

    if (["detail", "non_field_errors"].includes(k)) {
      arr.forEach((s) => out.summary.push(s));
    } else {
      out.fields[k] = (out.fields[k] || []).concat(arr);
    }
  });

  // fallback
  if (out.summary.length === 0 && Object.keys(out.fields).length === 0) {
    push(data);
  }

  return out;
}

function focusFirstError(errorsObj, refs) {
  const firstKey =
    Object.keys(errorsObj.fields || {})[0] ||
    (errorsObj.summary?.length ? null : Object.keys(errorsObj)[0]);
  const el = firstKey && refs?.current?.[firstKey];
  if (el?.focus) {
    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* ======================= Dropdowns com busca ======================= */
function TumuloDropdown({ value, onChange, api, cemiterioId, error, inputRef, initialLabel }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [itens, setItens] = useState([]);
  const wrapRef = useRef(null);

  const currentLabel =
    itens.find((o) => String(o.id) === String(value))?.label ||
    (value && initialLabel) ||
    "Selecione…";

  useEffect(() => {
    if (!open || !cemiterioId) return;
    (async () => {
      try {
        const { data } = await api.get("tumulos/", { params: { cemiterio: cemiterioId } });
        const arr = Array.isArray(data) ? data : data?.results ?? [];
        setItens(
          arr.map((t) => ({
            id: t.id ?? t.pk,
            label:
              (t.quadra?.codigo ? `Q ${t.quadra.codigo} - ` : "") +
              (t.identificador || t.codigo || t.nome || `Túmulo ${t.id ?? t.pk}`) +
              (t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : ""),
          }))
        );
      } catch {
        setItens([]);
      }
    })();
  }, [open, cemiterioId, api]);

  useEffect(() => {
    function outside(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const filtered = itens.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        ref={inputRef}
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2 rounded-lg border ${
          error ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
        } bg-white text-left hover:bg-[#f7fbf2]`}
        title={currentLabel}
      >
        <span className="truncate">{currentLabel}</span>
        <span className="float-right">▾</span>
      </button>
      {error && (
        <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
          {Array.isArray(error) ? error.map((e, i) => <li key={i}>{e}</li>) : <li>{error}</li>}
        </ul>
      )}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-[#e0efcf] z-50">
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

function SepultadoDropdown({
  value,
  onChange,
  api,
  cemiterioId,
  error,
  inputRef,
  initialLabel,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [itens, setItens] = useState([]);
  const wrapRef = useRef(null);

  const currentLabel =
    itens.find((o) => String(o.id) === String(value))?.label ||
    (value && initialLabel) ||
    "Selecione…";

  useEffect(() => {
    if (!open || !cemiterioId) return;
    (async () => {
      try {
        const { data } = await api.get("sepultados/", { params: { cemiterio: cemiterioId } });
        const arr = Array.isArray(data) ? data : data?.results ?? [];
        setItens(
          arr.map((s) => ({
            id: s.id ?? s.pk,
            label:
              (s.numero_sepultamento ? `${s.numero_sepultamento} - ` : "") +
              (s.nome || s.nome_completo || "Sem nome"),
          }))
        );
      } catch {
        setItens([]);
      }
    })();
  }, [open, cemiterioId, api]);

  useEffect(() => {
    function outside(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const filtered = itens.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        ref={inputRef}
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2 rounded-lg border ${
          error ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
        } bg-white text-left hover:bg-[#f7fbf2]`}
        title={currentLabel}
      >
        <span className="truncate">{currentLabel}</span>
        <span className="float-right">▾</span>
      </button>
      {error && (
        <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
          {Array.isArray(error) ? error.map((e, i) => <li key={i}>{e}</li>) : <li>{error}</li>}
        </ul>
      )}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-[#e0efcf] z-50">
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

/* =================== Widget de Anexos =================== */
function AnexosWidget({ objectId, api, disabled }) {
  const [itens, setItens] = useState([]);
  const [arquivo, setArquivo] = useState(null);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  async function listar() {
    if (!objectId) return;
    try {
      const { data } = await api.get("anexos/", {
        params: { ct: CT_EXUMACAO, object_id: objectId },
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
      fd.append("content_type", CT_EXUMACAO);
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

/* ============================== Formulário =============================== */
export default function FormularioExumacao({ exumacaoId, onCancel, onSuccess }) {
  const isEdit = !!exumacaoId;
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

  // Errors: { summary: string[], fields: { campo: string[] } }
  const [errors, setErrors] = useState({ summary: [], fields: {} });
  const refs = useRef({});

  // labels para edição
  const [sepLabel, setSepLabel] = useState("");
  const [tumLabel, setTumLabel] = useState("");

  // infos para validações
  const [sepInfo, setSepInfo] = useState(null); // { id, tumulo_id, data_sepultamento, ... }

  const [form, setForm] = useState({
    numero_documento: "",
    data: "",

    sepultado: "",
    tumulo: "",

    motivo: "",
    observacoes: "",

    nome_responsavel: "",
    cpf: "",
    endereco: "",
    telefone: "",

    forma_pagamento: "gratuito", // gratuito | avista | parcelado
    quantidade_parcelas: "",
    valor: "",
  });

  /* ===== Carregar registro p/ edição ===== */
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setCarregando(true);
        const { data } = await api.get(`exumacoes/${exumacaoId}/`, {
          params: { cemiterio: cem?.id },
        });
        const v = (x) => (x === null || x === undefined ? "" : x);
        setForm((s) => ({
          ...s,
          numero_documento: v(data.numero_documento),
          data: v(data.data),

          sepultado: data.sepultado ?? "",
          tumulo: data.tumulo ?? "",

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

        // labels e infos para validação
        if (data.sepultado) {
          try {
            const r = await api.get(`sepultados/${data.sepultado}/`, {
              params: { cemiterio: cem?.id },
            });
            const s = r.data;
            setSepLabel(
              (s.numero_sepultamento ? `${s.numero_sepultamento} - ` : "") +
                (s.nome || s.nome_completo || "Sem nome")
            );
            setSepInfo({
              id: s.id ?? s.pk,
              tumulo_id: s.tumulo?.id ?? s.tumulo ?? null,
              data_sepultamento: s.data_sepultamento || s.data || null,
            });
          } catch {}
        }
        if (data.tumulo) {
          try {
            const r = await api.get(`tumulos/${data.tumulo}/`, { params: { cemiterio: cem?.id } });
            const t = r.data;
            setTumLabel(
              (t.quadra?.codigo ? `Q ${t.quadra.codigo} - ` : "") +
                (t.identificador || t.codigo || t.nome || `Túmulo ${t.id ?? t.pk}`) +
                (t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "")
            );
          } catch {}
        }
      } catch {
        alert("Não foi possível carregar esta exumação.");
        onCancel?.();
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exumacaoId]);

  /* ===== Reage à troca de forma de pagamento ===== */
  useEffect(() => {
    if (form.forma_pagamento !== "parcelado" && form.quantidade_parcelas) {
      setForm((s) => ({ ...s, quantidade_parcelas: "" }));
    }
  }, [form.forma_pagamento]);

  /* ===== Helpers de estado/inputs ===== */
  const setField = (name, value) => {
    setForm((s) => ({ ...s, [name]: value }));
    setErrors((e) => {
      const n = { ...e, fields: { ...e.fields } };
      delete n.fields[name];
      return n;
    });
  };
  const err = (name) => errors.fields?.[name];

  const onChange = (e) => setField(e.target.name, e.target.value);
  const onChangeValor = (e) => {
    let v = (e.target.value || "").replace(/[^\d]/g, "");
    if (!v) return setField("valor", "");
    const int = v.slice(0, -2) || "0";
    const dec = v.slice(-2);
    const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setField("valor", `${intFmt},${dec}`);
  };

  /* ===== Carregar info do sepultado ao selecionar (para validação) ===== */
  async function onSelectSepultado(id) {
    setField("sepultado", id);
    if (!id) {
      setSepInfo(null);
      setSepLabel("");
      return;
    }
    try {
      const r = await api.get(`sepultados/${id}/`, { params: { cemiterio: cem?.id } });
      const s = r.data;
      setSepLabel(
        (s.numero_sepultamento ? `${s.numero_sepultamento} - ` : "") +
          (s.nome || s.nome_completo || "Sem nome")
      );
      setSepInfo({
        id: s.id ?? s.pk,
        tumulo_id: s.tumulo?.id ?? s.tumulo ?? null,
        data_sepultamento: s.data_sepultamento || s.data || null,
      });
    } catch (e) {
      console.warn("sepultado info erro:", e?.response?.status);
      setSepInfo(null);
    }
  }

  async function onSelectTumulo(id) {
    setField("tumulo", id);
    if (!id) {
      setTumLabel("");
      return;
    }
    try {
      const r = await api.get(`tumulos/${id}/`, { params: { cemiterio: cem?.id } });
      const t = r.data;
      setTumLabel(
        (t.quadra?.codigo ? `Q ${t.quadra.codigo} - ` : "") +
          (t.identificador || t.codigo || t.nome || `Túmulo ${t.id ?? t.pk}`) +
          (t.usar_linha && (t.linha || t.linha === 0) ? ` L${t.linha}` : "")
      );
    } catch {
      setTumLabel("");
    }
  }

  /* ===== Validações “de verdade” no cliente ===== */
  function diasEntre(iniISO, fimISO) {
    if (!iniISO || !fimISO) return null;
    try {
      const d1 = new Date(iniISO);
      const d2 = new Date(fimISO);
      const diff = Math.floor((d2.setHours(0, 0, 0, 0) - d1.setHours(0, 0, 0, 0)) / 86400000);
      return diff;
    } catch {
      return null;
    }
  }

  function clientValidate(f) {
    const fieldErrs = {};
    const summary = [];

    // Obrigatórios
    if (!f.sepultado) fieldErrs.sepultado = ["Selecione o sepultado."];
    if (!f.data) fieldErrs.data = ["Informe a data da exumação."];

    // Regra: sepultado x túmulo
    if (f.sepultado && sepInfo?.tumulo_id && f.tumulo) {
      if (String(sepInfo.tumulo_id) !== String(f.tumulo)) {
        const msg =
          "O sepultado selecionado não está no túmulo informado. Ajuste o campo “Túmulo de Origem”.";
        fieldErrs.tumulo = (fieldErrs.tumulo || []).concat([msg]);
        summary.push(msg);
      }
    }

    // Regra: tempo mínimo desde o sepultamento
    if (f.data && sepInfo?.data_sepultamento) {
      const dias = diasEntre(sepInfo.data_sepultamento, f.data);
      if (dias !== null && dias < MIN_DIAS_EXUMACAO) {
        const faltam = MIN_DIAS_EXUMACAO - dias;
        const msg = `Exumação só é permitida após ${MIN_DIAS_EXUMACAO} dias do sepultamento. Faltam ${faltam} dia(s).`;
        fieldErrs.data = (fieldErrs.data || []).concat([msg]);
        summary.push(msg);
      }
    }

    // Pagamento
    if (f.forma_pagamento === "parcelado") {
      const n = Number(f.quantidade_parcelas);
      if (!n || n < 1) {
        fieldErrs.quantidade_parcelas = ["Informe a quantidade de parcelas (>= 1)."];
      }
    }
    if (f.forma_pagamento !== "gratuito") {
      const v = Number((f.valor || "0").replace(/\./g, "").replace(",", "."));
      if (!v || v <= 0) fieldErrs.valor = ["Informe o valor (> 0)."];
    }

    // Campos de texto podem ser obrigatórios no seu backend; descomente se quiser exigir no cliente:
    // if (!f.motivo?.trim()) fieldErrs.motivo = ["Informe o motivo da exumação."];

    return { summary, fields: fieldErrs };
  }

  /* ===== Submit ===== */
  async function onSubmit(e) {
    e.preventDefault();
    setErrors({ summary: [], fields: {} });

    // Validação cliente
    const clientErrs = clientValidate(form);
    if (clientErrs.summary.length || Object.keys(clientErrs.fields).length) {
      setErrors(clientErrs);
      focusFirstError(clientErrs, refs);
      return;
    }

    // Monta payload
    const payload = {
      ...form,
      valor:
        form.forma_pagamento === "gratuito"
          ? "0"
          : (form.valor || "0").replace(/\./g, "").replace(",", "."),
      ...(form.forma_pagamento !== "parcelado" ? { quantidade_parcelas: "" } : {}),
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
        await api.put(`exumacoes/${exumacaoId}/`, fd, { params: { cemiterio: cem?.id } });
      } else {
        await api.post("exumacoes/", fd);
      }
      onSuccess?.();
    } catch (err0) {
      console.error("POST /exumacoes erro:", err0?.response?.status, err0?.response?.data);
      const ct = err0?.response?.headers?.["content-type"] || "";
      if (!ct.includes("application/json")) {
        const errs = { summary: ["Erro interno do servidor (500)."], fields: {} };
        setErrors(errs);
        return focusFirstError(errs, refs);
      }
      const norm = normalizeApiErrors(err0?.response?.data);

      // Mapeia alguns nomes (se o back usar outro) -> ajuste se necessário
      const alias = {
        sepultado_id: "sepultado",
        tumulo_id: "tumulo",
        valor_total: "valor",
      };
      const mapped = { summary: norm.summary.slice(), fields: {} };
      Object.entries(norm.fields).forEach(([k, v]) => {
        mapped.fields[alias[k] || k] = v;
      });

      setErrors(mapped);
      focusFirstError(mapped, refs);
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
      {err(name) && (
        <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
          {err(name).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">
          {isEdit ? "Editar Exumação" : "Cadastro de Exumação"}
        </h2>
      </div>

      {((errors.summary && errors.summary.length) ||
        (errors.fields && Object.keys(errors.fields).length)) && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3">
          <div className="font-semibold mb-1">Por favor, corrija os problemas abaixo:</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.summary?.map((s, i) => (
              <li key={`s-${i}`}>{s}</li>
            ))}
            {Object.entries(errors.fields || {}).map(([k, arr]) =>
              (arr || []).map((m, i) => (
                <li key={`f-${k}-${i}`}>
                  <span className="font-semibold">{k}:</span> {m}
                </li>
              ))
            )}
          </ul>
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

          {/* Vínculos */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Vínculos</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-green-900 mb-1">Sepultado *</label>
                <SepultadoDropdown
                  value={form.sepultado}
                  onChange={onSelectSepultado}
                  api={api}
                  cemiterioId={cem.id}
                  error={err("sepultado")}
                  inputRef={(el) => (refs.current["sepultado"] = el)}
                  initialLabel={sepLabel}
                />
              </div>
              <div>
                <label className="block text-sm text-green-900 mb-1">Túmulo de Origem</label>
                <TumuloDropdown
                  value={form.tumulo}
                  onChange={onSelectTumulo}
                  api={api}
                  cemiterioId={cem.id}
                  error={err("tumulo")}
                  inputRef={(el) => (refs.current["tumulo"] = el)}
                  initialLabel={tumLabel}
                />
              </div>
              <div />
            </div>
          </div>

          {/* Informações */}
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
                {err("motivo") && (
                  <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
                    {err("motivo").map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
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
                {err("observacoes") && (
                  <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
                    {err("observacoes").map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
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
                {err("cpf") && (
                  <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
                    {err("cpf").map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
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
                {err("telefone") && (
                  <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
                    {err("telefone").map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
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
                  <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
                    {err("forma_pagamento").map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
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
                  {err("valor") && (
                    <ul className="mt-1 text-xs text-red-600 list-disc pl-5">
                      {err("valor").map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
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

      {/* Anexos */}
      <AnexosWidget objectId={isEdit ? exumacaoId : null} api={api} disabled={!isEdit} />
    </div>
  );
}
