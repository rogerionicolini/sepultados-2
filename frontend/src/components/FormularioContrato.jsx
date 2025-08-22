// src/components/FormularioContrato.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import InputMask from "react-input-mask";

const API_BASE = "http://127.0.0.1:8000/api/";
const CT_CONTRATO = "sepultados_gestao.concessaocontrato"; // ajuste se necessário

/* ========= Helpers: cemitério ativo ========= */
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

/* ========= Normalização de erros da API ========= */
function normalizeApiErrors(data) {
  const out = { summary: "", fields: {} };
  if (!data) return out;

  if (typeof data === "string") {
    if (data.includes("<!DOCTYPE") || data.includes("<html")) {
      out.summary = "Erro interno do servidor (500). Verifique os logs do backend.";
    } else {
      out.summary = data;
    }
    return out;
  }
  if (Array.isArray(data)) {
    out.summary = data.join(" ");
    return out;
  }
  const getMsgs = (val) => {
    if (Array.isArray(val)) {
      return val
        .map((v) => (typeof v === "object" && v?.message ? v.message : String(v)))
        .join(" ");
    }
    if (typeof val === "object" && val !== null) {
      const k = Object.keys(val)[0];
      return getMsgs(val[k]);
    }
    return String(val);
  };
  Object.entries(data).forEach(([k, v]) => {
    if (k === "detail" || k === "non_field_errors") out.summary = getMsgs(v);
    else out.fields[k] = getMsgs(v);
  });
  if (!out.summary) out.summary = "Revise os campos destacados em vermelho.";
  return out;
}
function focusFirstError(errorsObj, refs) {
  const firstKey = Object.keys(errorsObj)[0];
  const el = firstKey && refs?.current?.[firstKey];
  if (el && el.focus) {
    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* ======= Mapeamento backend <-> UI (para carregar/enviar/erros) ======= */
const BACKEND_TO_UI_FIELD = {
  cpf: "documento",
  endereco_numero: "numero",
  endereco_bairro: "bairro",
  endereco_cidade: "cidade",
  endereco_estado: "estado",
  endereco_cep: "cep",
  valor_total: "valor",
};
function mapBackendErrorsToUI(fields) {
  const out = {};
  Object.entries(fields || {}).forEach(([k, v]) => {
    out[BACKEND_TO_UI_FIELD[k] || k] = v;
  });
  return out;
}

/* =============== Dropdown com busca (Túmulo) =============== */
function TumuloDropdown({ value, onChange, api, cemiterioId, error, inputRef }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  async function carregar() {
    if (!cemiterioId) return;
    setLoading(true);
    try {
      const res = await api.get("tumulos/", { params: { cemiterio: cemiterioId } });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setItens(
        arr.map((t) => ({
          id: t.id ?? t.pk,
          label: t.identificador || t.codigo || t.nome || `Túmulo ${t.id ?? t.pk}`,
        }))
      );
    } catch {
      setItens([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cemiterioId]);

  useEffect(() => {
    function outside(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter((o) => o.label.toLowerCase().includes(s));
  }, [itens, q]);

  const currentLabel =
    itens.find((o) => String(o.id) === String(value))?.label || "Selecione…";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        ref={inputRef}
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2 rounded-lg border ${
          error ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
        } bg-white text-left ${error ? "" : "hover:bg-[#f7fbf2]"}`}
      >
        <span className="truncate">{currentLabel}</span>
        <span className="float-right">▾</span>
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

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
            {loading ? (
              <div className="px-3 py-3 text-sm text-gray-600">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-600">Nenhum túmulo encontrado.</div>
            ) : (
              filtered.map((o) => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =================== Widget de Anexos (Genérico) =================== */
function AnexosWidget({ context, objectId, api, disabled }) {
  const [itens, setItens] = useState([]);
  const [arquivo, setArquivo] = useState(null);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [upLoading, setUpLoading] = useState(false);

  async function listar() {
    if (!context || !objectId) return;
    setLoading(true);
    try {
      const { data } = await api.get("anexos/", {
        params: { ct: context, object_id: objectId },
      });
      const arr = Array.isArray(data) ? data : data?.results ?? [];
      setItens(arr);
    } catch (e) {
      console.error("listar anexos", e?.response?.data || e);
      setItens([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    listar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, objectId]);

  async function enviar(e) {
    e.preventDefault();
    if (!arquivo) return;
    try {
      setUpLoading(true);
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      if (nome) fd.append("nome", nome);
      fd.append("content_type", context);
      fd.append("object_id", String(objectId));
      await api.post("anexos/", fd);
      setArquivo(null);
      setNome("");
      await listar();
    } catch (e) {
      console.error("upload anexo", e?.response?.data || e);
      alert("Não foi possível enviar o anexo.");
    } finally {
      setUpLoading(false);
    }
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este anexo?")) return;
    try {
      await api.delete(`anexos/${id}/`);
      await listar();
    } catch (e) {
      console.error("excluir anexo", e?.response?.data || e);
      alert("Erro ao excluir.");
    }
  }

  return (
    <div className="bg-[#f0f8ea] rounded-xl p-4 shadow space-y-4">
      <div className="text-green-900 font-semibold">Anexos</div>

      {/* Envio */}
      <form onSubmit={enviar} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <input
            type="file"
            disabled={disabled}
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            className={`w-full border rounded-lg px-3 py-2 bg-white ${
              disabled ? "border-gray-300 opacity-60" : "border-[#bcd2a7]"
            }`}
          />
          {disabled && (
            <p className="text-xs text-gray-600 mt-1">
              Salve o contrato para habilitar os anexos.
            </p>
          )}
        </div>
        <input
          placeholder="Descrição (opcional)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          disabled={disabled}
          className={`w-full border rounded-lg px-3 py-2 bg-white ${
            disabled ? "border-gray-300 opacity-60" : "border-[#bcd2a7]"
          }`}
        />
        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            disabled={disabled || !arquivo || upLoading}
            className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
          >
            {upLoading ? "Enviando…" : "Enviar anexo"}
          </button>
        </div>
      </form>

      {/* Lista */}
      {loading ? (
        <div className="text-gray-700">Carregando anexos…</div>
      ) : itens.length === 0 ? (
        <div className="text-gray-600">Nenhum anexo.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-green-900 bg-[#e6f3d7]">
                <th className="py-2 px-3 rounded-l-lg">Arquivo</th>
                <th className="py-2 px-3">Nome</th>
                <th className="py-2 px-3">Data de envio</th>
                <th className="py-2 px-3 rounded-r-lg w-32">Ações</th>
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
                    {a.data_upload ? new Date(a.data_upload).toLocaleString() : "-"}
                  </td>
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
export default function FormularioContrato({ contratoId, onCancel, onSuccess }) {
  const isEdit = !!contratoId;
  const token = localStorage.getItem("accessToken");
  const cemAtivo = getCemiterioAtivo();

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
  const fieldRefs = useRef({});

  const [form, setForm] = useState({
    numero_contrato: "",
    data_contrato: "",

    nome: "",
    documento: "",
    telefone: "",

    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",

    tumulo: "",
    observacoes: "",

    forma_pagamento: "gratuito", // gratuito | avista | parcelado
    quantidade_parcelas: "",
    valor: "",
  });

  // carregar edição
  useEffect(() => {
    async function fetchContrato() {
      if (!isEdit) return;
      try {
        setCarregando(true);
        const { data } = await api.get(`contratos/${contratoId}/`, {
          params: { cemiterio: cemAtivo?.id },
        });
        const v = (x) => (x === null || x === undefined ? "" : x);
        setForm((s) => ({
          ...s,
          numero_contrato: v(data.numero_contrato),
          data_contrato: v(data.data_contrato),

          // backend -> UI
          nome: v(data.nome),
          documento: v(data.cpf),
          telefone: v(data.telefone),

          logradouro: v(data.logradouro),
          numero: v(data.endereco_numero),
          bairro: v(data.endereco_bairro),
          cidade: v(data.endereco_cidade),
          estado: v(data.endereco_estado),
          cep: v(data.endereco_cep),

          tumulo: data.tumulo ?? "",
          observacoes: v(data.observacoes),

          forma_pagamento: v(data.forma_pagamento) || "gratuito",
          quantidade_parcelas: v(data.quantidade_parcelas),
          valor: data.valor_total ? String(data.valor_total).replace(".", ",") : "",
        }));
      } catch (e) {
        console.error("erro ao carregar contrato:", e?.response?.data || e);
        alert("Não foi possível carregar este contrato.");
        onCancel?.();
      } finally {
        setCarregando(false);
      }
    }
    fetchContrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  // dependências de UI
  useEffect(() => {
    if (form.forma_pagamento !== "parcelado" && form.quantidade_parcelas) {
      setForm((s) => ({ ...s, quantidade_parcelas: "" }));
    }
  }, [form.forma_pagamento]);

  const UFS = [
    "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
    "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
    "RO","RR","RS","SC","SE","SP","TO",
  ];

  const setField = (name, value) => {
    setForm((s) => ({ ...s, [name]: value }));
    if (errors[name]) {
      setErrors((e) => {
        const copy = { ...e };
        delete copy[name];
        return copy;
      });
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setField(name, value);
  };

  const onChangeValor = (e) => {
    let v = e.target.value || "";
    v = v.replace(/[^\d]/g, "");
    if (!v) return setField("valor", "");
    const int = v.slice(0, -2) || "0";
    const dec = v.slice(-2);
    const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setField("valor", `${intFmt},${dec}`);
  };

  const errMsg = (name) =>
    Array.isArray(errors?.[name]) ? errors[name].join(" ") : errors?.[name];

  // validação mínima do cliente (alinhada ao backend)
  function clientValidate(f) {
    const errs = {};
    if (!f.nome?.trim()) errs.nome = "Informe o nome do titular.";
    if (!f.documento?.trim()) errs.documento = "Informe o CPF/CNPJ.";
    if (!f.tumulo) errs.tumulo = "Selecione o túmulo.";
    if (f.forma_pagamento === "parcelado") {
      const qp = Number(f.quantidade_parcelas);
      if (!qp || qp < 1) errs.quantidade_parcelas = "Informe a quantidade de parcelas.";
    }
    if (f.forma_pagamento !== "gratuito") {
      const valorNumStr = (f.valor || "0").replace(/\./g, "").replace(",", ".");
      const valorNum = Number(valorNumStr);
      if (!valorNum || valorNum <= 0) errs.valor = "Informe o valor.";
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
      focusFirstError(errs, fieldRefs);
      return;
    }

    // UI -> backend (mapeando nomes)
    const payloadBackend = {
      nome: form.nome,
      cpf: form.documento,
      telefone: form.telefone,

      logradouro: form.logradouro,
      endereco_numero: form.numero,
      endereco_bairro: form.bairro,
      endereco_cidade: form.cidade,
      endereco_estado: form.estado,
      endereco_cep: form.cep,

      tumulo: form.tumulo,
      observacoes: form.observacoes,

      forma_pagamento: form.forma_pagamento,
      valor_total:
        form.forma_pagamento === "gratuito"
          ? "0"
          : (form.valor || "0").replace(/\./g, "").replace(",", "."),
      quantidade_parcelas:
        form.forma_pagamento === "parcelado" ? form.quantidade_parcelas : "",
    };

    const fd = new FormData();
    Object.entries(payloadBackend).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") fd.append(k, v);
    });

    try {
      setSalvando(true);
      if (isEdit) {
        await api.put(`contratos/${contratoId}/`, fd, {
          params: { cemiterio: cemAtivo?.id },
        });
      } else {
        await api.post("contratos/", fd);
      }
      onSuccess?.();
    } catch (err) {
      const ct = err?.response?.headers?.["content-type"] || "";
      if (!ct.includes("application/json")) {
        setErrorSummary("Erro interno do servidor (500). Verifique os logs do backend.");
        return;
      }
      const data = err?.response?.data;
      const norm = normalizeApiErrors(data);
      const mapped = mapBackendErrorsToUI(norm.fields);
      setErrors(mapped);
      setErrorSummary(norm.summary);
      focusFirstError(mapped, fieldRefs);
    } finally {
      setSalvando(false);
    }
  }

  if (!cemAtivo?.id) {
    return <div className="text-sm text-red-600">Selecione um cemitério.</div>;
  }
  if (carregando) {
    return <div className="px-4 py-8 text-gray-700">Carregando dados do contrato…</div>;
  }

  const input = (label, name, props = {}, required = false) => {
    const error = errMsg(name);
    return (
      <div key={name}>
        <label className="block text-sm text-green-900 mb-1">
          {label}
          {required ? " *" : ""}
        </label>
        <input
          ref={(el) => (fieldRefs.current[name] = el)}
          name={name}
          value={form[name] || ""}
          onChange={onChange}
          className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
            error ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
          }`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  };
  const displayReadOnly = (label, valueText) => (
    <div>
      <label className="block text-sm text-green-900 mb-1">{label}</label>
      <input
        value={valueText ?? "-"}
        readOnly
        disabled
        className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-gray-100 text-gray-700"
      />
    </div>
  );
  const errBox = (msg) =>
    msg ? (
      <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-2">
        {msg}
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">
          {isEdit ? "Editar Contrato de Concessão" : "Cadastro de Contrato de Concessão"}
        </h2>
      </div>

      {errBox(errorSummary)}

      <form onSubmit={onSubmit}>
        <div className="bg-[#f0f8ea] rounded-xl p-6 shadow space-y-8">
          {/* IDENTIFICAÇÃO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Identificação</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayReadOnly("Número do Contrato", form.numero_contrato || "-")}
              {displayReadOnly("Data do Contrato", form.data_contrato || "-")}
            </div>
          </div>

          {/* TITULAR */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Dados do Titular</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {input("Nome *", "nome", {}, true)}
              <div>
                <label className="block text-sm text-green-900 mb-1">Documento (CPF/CNPJ) *</label>
                <InputMask
                  mask={form.documento?.replace(/\D/g, "").length > 11 ? "99.999.999/9999-99" : "999.999.999-99"}
                  name="documento"
                  value={form.documento}
                  onChange={onChange}
                  inputRef={(el) => (fieldRefs.current["documento"] = el)}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    errMsg("documento") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
                {errMsg("documento") && (
                  <p className="mt-1 text-xs text-red-600">{errMsg("documento")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-green-900 mb-1">Telefone</label>
                <InputMask
                  mask="(99) 99999-9999"
                  name="telefone"
                  value={form.telefone}
                  onChange={onChange}
                  inputRef={(el) => (fieldRefs.current["telefone"] = el)}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    errMsg("telefone") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
                {errMsg("telefone") && (
                  <p className="mt-1 text-xs text-red-600">{errMsg("telefone")}</p>
                )}
              </div>
            </div>
          </div>

          {/* ENDEREÇO DO TITULAR */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Endereço do Titular</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {input("Logradouro", "logradouro")}
              {input("Número", "numero")}
              {input("Bairro", "bairro")}
              {input("Cidade", "cidade")}
              <div>
                <label className="block text-sm text-green-900 mb-1">Estado (UF)</label>
                <select
                  ref={(el) => (fieldRefs.current["estado"] = el)}
                  name="estado"
                  value={form.estado}
                  onChange={onChange}
                  className={`w-full border rounded-lg px-3 py-2 bg-white ${
                    errMsg("estado") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                >
                  <option value="">Selecione</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                {errMsg("estado") && <p className="mt-1 text-xs text-red-600">{errMsg("estado")}</p>}
              </div>
              {input("CEP", "cep")}
            </div>
          </div>

          {/* TÚMULO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Túmulo</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-green-900 mb-1">Túmulo *</label>
                <TumuloDropdown
                  value={form.tumulo}
                  onChange={(idSel) => setField("tumulo", idSel)}
                  api={api}
                  cemiterioId={cemAtivo?.id}
                  error={errMsg("tumulo")}
                  inputRef={(el) => (fieldRefs.current["tumulo"] = el)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-green-900 mb-1">Observações</label>
                <textarea
                  ref={(el) => (fieldRefs.current["observacoes"] = el)}
                  name="observacoes"
                  value={form.observacoes}
                  onChange={onChange}
                  rows={4}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    errMsg("observacoes") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
                {errMsg("observacoes") && (
                  <p className="mt-1 text-xs text-red-600">{errMsg("observacoes")}</p>
                )}
              </div>
            </div>
          </div>

          {/* PAGAMENTO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Pagamento</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-green-900 mb-1">Forma de Pagamento</label>
                <select
                  ref={(el) => (fieldRefs.current["forma_pagamento"] = el)}
                  name="forma_pagamento"
                  value={form.forma_pagamento}
                  onChange={onChange}
                  className={`w-full border rounded-lg px-3 py-2 bg-white ${
                    errMsg("forma_pagamento") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                >
                  <option value="gratuito">Gratuito</option>
                  <option value="avista">À Vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
                {errMsg("forma_pagamento") && (
                  <p className="mt-1 text-xs text-red-600">{errMsg("forma_pagamento")}</p>
                )}
              </div>

              {form.forma_pagamento === "parcelado" &&
                input("Quantidade de Parcelas", "quantidade_parcelas", { type: "number", min: 1 })}

              {form.forma_pagamento !== "gratuito" && (
                <div>
                  <label className="block text-sm text-green-900 mb-1">Valor (R$)</label>
                  <input
                    ref={(el) => (fieldRefs.current["valor"] = el)}
                    name="valor"
                    value={form.valor}
                    onChange={onChangeValor}
                    inputMode="numeric"
                    className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                      errMsg("valor") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                    }`}
                    placeholder="0,00"
                  />
                  {errMsg("valor") && <p className="mt-1 text-xs text-red-600">{errMsg("valor")}</p>}
                </div>
              )}
            </div>
          </div>

          {/* AÇÕES */}
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

      {/* ANEXOS */}
      <AnexosWidget
        context={CT_CONTRATO}
        objectId={isEdit ? contratoId : null}
        api={api}
        disabled={!isEdit}
      />
    </div>
  );
}