// src/components/FormularioSepultado.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import InputMask from "react-input-mask";

function buildTumuloLabel(t) {
  const id = t?.id ?? t?.pk ?? "";
  const base = t?.identificador || t?.codigo || t?.nome || `Túmulo ${id}`;
  const linha = t?.usar_linha && (t?.linha || t?.linha === 0) ? ` L${t.linha}` : "";
  const q = t?.quadra?.codigo || t?.quadra?.nome || t?.quadra?.id || null;
  return q ? `Q ${q} - ${base}${linha}` : `${base}${linha}`;
}

/* ===================== CONFIG ===================== */
const API_BASE = "http://127.0.0.1:8000/api/";
// content type do modelo no Django ContentTypes (ajuste se seu app_label diferir)
const CT_SEPULTADO = "sepultados_gestao.sepultado";

/* ========== Helpers (cemitério ativo) ========== */
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

/* ========== Normalização de erros da API ========== */
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
    if (k === "detail" || k === "non_field_errors") {
      out.summary = getMsgs(v);
    } else {
      out.fields[k] = getMsgs(v);
    }
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
// Usa nome da quadra se existir; senão, "Quadra 02" (com zero à esquerda)
function rotuloTumulo(t, quadrasMap = new Map()) {
  if (!t) return "";
  const id = t.id ?? t.pk ?? "";
  const base =
    t.identificador || t.codigo || t.nome || `T ${String(id).padStart(2, "0")}`;

  // linha
  let linhaTxt = "";
  const lraw =
    typeof t.linha === "object"
      ? t.linha?.id ?? t.linha?.numero ?? t.linha?.codigo
      : t.linha;
  if (t.usar_linha && (lraw || lraw === 0)) linhaTxt = `L ${lraw}`;

  // quadra (preferir nome; se vier só id, resolver pelo mapa)
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
    if (typeof q === "object") {
      quadraTxt = resolveQuadra(q);
    } else {
      // número/id
      const info = quadrasMap.get(String(q)) || quadrasMap.get(Number(q));
      if (info) quadraTxt = resolveQuadra(info);
      else {
        const cod = String(q);
        quadraTxt = /^\d+$/.test(cod) ? `Quadra ${cod.padStart(2, "0")}` : cod;
      }
    }
  }

  return [base, linhaTxt, quadraTxt].filter(Boolean).join(" ");
}

function TumuloDropdown({ value, onChange, api, cemiterioId, error, inputRef }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [quadrasMap, setQuadrasMap] = useState(new Map());
  const wrapRef = useRef(null);

  async function carregar() {
    if (!cemiterioId) return;
    setLoading(true);
    try {
      // buscamos túmulos e quadras em paralelo
      const [tumulosRes, quadrasRes] = await Promise.all([
        api.get("tumulos/", { params: { cemiterio: cemiterioId } }),
        api.get("quadras/", { params: { cemiterio: cemiterioId } }),
      ]);

      // monta mapa id -> {id, nome, codigo}
      const quadArr = Array.isArray(quadrasRes.data)
        ? quadrasRes.data
        : quadrasRes.data?.results ?? [];
      const qMap = new Map();
      quadArr.forEach((q) => {
        const qid = String(q.id ?? q.pk);
        qMap.set(qid, { id: q.id ?? q.pk, nome: q.nome, codigo: q.codigo });
      });
      setQuadrasMap(qMap);

      const tArr = Array.isArray(tumulosRes.data)
        ? tumulosRes.data
        : tumulosRes.data?.results ?? [];
      setItens(
        tArr.map((t) => ({
          id: t.id ?? t.pk,
          label: rotuloTumulo(t, qMap),
        }))
      );
    } catch {
      setItens([]);
    } finally {
      setLoading(false);
    }
  }

  async function carregarSelecionado() {
    if (!cemiterioId || !value) return;
    try {
      // se ainda não temos quadras, carrega pelo menos uma vez
      if (quadrasMap.size === 0) {
        const { data } = await api.get("quadras/", {
          params: { cemiterio: cemiterioId },
        });
        const quadArr = Array.isArray(data) ? data : data?.results ?? [];
        const qMap = new Map();
        quadArr.forEach((q) => {
          const qid = String(q.id ?? q.pk);
          qMap.set(qid, { id: q.id ?? q.pk, nome: q.nome, codigo: q.codigo });
        });
        setQuadrasMap(qMap);
      }

      const { data: t } = await api.get(`tumulos/${value}/`, {
        params: { cemiterio: cemiterioId },
      });
      setSelecionado({
        id: t.id ?? t.pk,
        label: rotuloTumulo(t, quadrasMap.size ? quadrasMap : new Map()),
      });
    } catch {
      setSelecionado(null);
    }
  }

  useEffect(() => {
    if (open) carregar();
  }, [open, cemiterioId]);

  useEffect(() => {
    function outside(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  useEffect(() => {
    if (value && !open) carregarSelecionado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cemiterioId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter((o) => o.label.toLowerCase().includes(s));
  }, [itens, q]);

  const currentLabel =
    itens.find((o) => String(o.id) === String(value))?.label ||
    (selecionado && String(selecionado.id) === String(value)
      ? selecionado.label
      : "Selecione…");

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
              <div className="px-3 py-3 text-sm text-gray-600">
                Nenhum túmulo encontrado.
              </div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.id}
                  className="px-3 py-2 hover:bg-[#f8fcf2] cursor-pointer flex items-center justify-between"
                  onClick={() => {
                    onChange?.(o.id);
                    setSelecionado(o);
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
      // sem headers manuais: axios/browser define o boundary
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
              Salve o sepultado para habilitar os anexos.
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

/* ============================== Página =============================== */
export default function FormularioSepultado({ sepultadoId, onClose }) {
  const navigate = useNavigate();
  const { id: routeId } = useParams(); // quando abrir por rota
  const id = sepultadoId ?? routeId;   // prioridade: prop (interno) > rota
  const isEdit = !!id;

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
    // Somente leitura
    numero_sepultamento: "",
    idade_ao_falecer: "",
    exumado: false,
    data_exumacao: "",
    trasladado: false,
    data_translado: "",

    // Pessoais
    nome: "",
    cpf_sepultado: "",
    sexo: "NI",
    sexo_outro_descricao: "",
    data_nascimento: "",
    local_nascimento: "",
    nacionalidade: "",
    cor_pele: "",
    estado_civil: "NAO_INFORMADO",
    nome_conjuge: "",
    nome_pai: "",
    nome_mae: "",
    profissao: "",
    grau_instrucao: "",
    // Endereço
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    // Falecimento
    data_falecimento: "",
    hora_falecimento: "",
    local_falecimento: "",
    causa_morte: "",
    medico_responsavel: "",
    crm_medico: "",
    // Cartório
    cartorio_nome: "",
    cartorio_numero_registro: "",
    cartorio_livro: "",
    cartorio_folha: "",
    cartorio_data_registro: "",
    // Sepultamento
    tumulo: "",
    data_sepultamento: "",
    observacoes: "",
    // Pagamento
    forma_pagamento: "gratuito",
    quantidade_parcelas: "",
    valor: "",
    // Responsável
    nome_responsavel: "",
    cpf: "",
    endereco: "",
    telefone: "",
  });

  // helper para normalizar datas para <input type="date">
  function toDateInput(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // carregar na edição
  useEffect(() => {
    async function fetchSepultado() {
      if (!isEdit) return;
      try {
        setCarregando(true);
        // >>> inclui o parâmetro de contexto do cemitério para não dar 404
        const { data } = await api.get(`sepultados/${id}/`, {
          params: { cemiterio: cemAtivo?.id },
        });
        const v = (x) => (x === null || x === undefined ? "" : x);

        setForm((s) => ({
          ...s,
          numero_sepultamento: v(data.numero_sepultamento),
          idade_ao_falecer: v(data.idade_ao_falecer),
          exumado: !!data.exumado,
          data_exumacao: v(data.data_exumacao),
          trasladado: !!data.trasladado,
          data_translado: v(data.data_translado),

          nome: v(data.nome),
          cpf_sepultado: v(data.cpf_sepultado),
          sexo: v(data.sexo) || "NI",
          sexo_outro_descricao: v(data.sexo_outro_descricao),
          data_nascimento: toDateInput(data.data_nascimento),
          local_nascimento: v(data.local_nascimento),
          nacionalidade: v(data.nacionalidade),
          cor_pele: v(data.cor_pele),
          estado_civil: v(data.estado_civil) || "NAO_INFORMADO",
          nome_conjuge: v(data.nome_conjuge),
          nome_pai: v(data.nome_pai),
          nome_mae: v(data.nome_mae),
          profissao: v(data.profissao),
          grau_instrucao: v(data.grau_instrucao),

          logradouro: v(data.logradouro),
          numero: v(data.numero),
          bairro: v(data.bairro),
          cidade: v(data.cidade),
          estado: v(data.estado),

          data_falecimento: toDateInput(data.data_falecimento),
          hora_falecimento: v(data.hora_falecimento),
          local_falecimento: v(data.local_falecimento),
          causa_morte: v(data.causa_morte),
          medico_responsavel: v(data.medico_responsavel),
          crm_medico: v(data.crm_medico),

          cartorio_nome: v(data.cartorio_nome),
          cartorio_numero_registro: v(data.cartorio_numero_registro),
          cartorio_livro: v(data.cartorio_livro),
          cartorio_folha: v(data.cartorio_folha),
          cartorio_data_registro: toDateInput(data.cartorio_data_registro),

          tumulo:
            typeof data.tumulo === "object" && data.tumulo !== null
              ? (data.tumulo.id ?? data.tumulo.pk ?? "")
              : (data.tumulo ?? ""),
          tumulo_label:
            typeof data.tumulo === "object" && data.tumulo !== null
              ? buildTumuloLabel(data.tumulo)
              : "",

          data_sepultamento: toDateInput(data.data_sepultamento),
          observacoes: v(data.observacoes),

          forma_pagamento: v(data.forma_pagamento) || "gratuito",
          quantidade_parcelas: v(data.quantidade_parcelas),
          valor: data.valor ? String(data.valor).replace(".", ",") : "",

          nome_responsavel: v(data.nome_responsavel),
          cpf: v(data.cpf),
          endereco: v(data.endereco),
          telefone: v(data.telefone),
        }));
      } catch (e) {
        console.error("erro ao carregar sepultado:", e?.response?.data || e);
        alert("Não foi possível carregar este sepultado.");
        if (onClose) onClose();
        else navigate("/sepultados");
      } finally {
        setCarregando(false);
      }
    }
    fetchSepultado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // condicionais
  useEffect(() => {
    if (form.sexo !== "O" && form.sexo_outro_descricao) {
      setForm((s) => ({ ...s, sexo_outro_descricao: "" }));
    }
  }, [form.sexo]);

  useEffect(() => {
    const casadoOuViuvo = form.estado_civil === "CASADO" || form.estado_civil === "VIUVO";
    if (!casadoOuViuvo && form.nome_conjuge) {
      setForm((s) => ({ ...s, nome_conjuge: "" }));
    }
  }, [form.estado_civil]);

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

  // ======= Validação de obrigatórios (alinhado ao backend) =======
  function clientValidate(f) {
    const errs = {};
    if (!f.nome?.trim()) errs.nome = "Informe o nome.";
    if (!f.tumulo) errs.tumulo = "Selecione o túmulo.";
    if (!f.data_sepultamento) errs.data_sepultamento = "Informe a data do sepultamento.";
    if (!f.data_falecimento) errs.data_falecimento = "Informe a data do falecimento.";

    // condicionais
    if (f.sexo === "O" && !f.sexo_outro_descricao?.trim()) {
      errs.sexo_outro_descricao = "Descreva o sexo.";
    }
    const casadoOuViuvo = f.estado_civil === "CASADO" || f.estado_civil === "VIUVO";
    if (casadoOuViuvo && !f.nome_conjuge?.trim()) {
      errs.nome_conjuge = "Informe o nome do cônjuge.";
    }
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

    let valorNum = "0";
    if (form.forma_pagamento !== "gratuito") {
      valorNum = (form.valor || "0").replace(/\./g, "").replace(",", ".");
    }

    const payload = {
      ...form,
      valor: valorNum,
      ...(form.forma_pagamento !== "parcelado" ? { quantidade_parcelas: "" } : {}),
      ...(form.sexo !== "O" ? { sexo_outro_descricao: "" } : {}),
      ...(!(form.estado_civil === "CASADO" || form.estado_civil === "VIUVO")
        ? { nome_conjuge: "" }
        : {}),
    };

    const fd = new FormData();
    const ignorar = new Set([
      "numero_sepultamento",
      "idade_ao_falecer",
      "exumado",
      "data_exumacao",
      "trasladado",
      "data_translado",
    ]);
    Object.entries(payload).forEach(([k, v]) => {
      if (ignorar.has(k)) return;
      if (v !== undefined && v !== null && v !== "") fd.append(k, v);
    });

    try {
      setSalvando(true);
      if (isEdit) {
        // >>> inclui cemiterio e NÃO define Content-Type manualmente
        await api.put(`sepultados/${id}/`, fd, {
          params: { cemiterio: cemAtivo?.id },
        });
      } else {
        // >>> deixe o axios montar o boundary do multipart
        await api.post("sepultados/", fd);
      }
      // fechar interno se onClose existir; senão, voltar para a lista
      if (onClose) onClose();
      else navigate("/sepultados");
    } catch (err) {
      const ct = err?.response?.headers?.["content-type"] || "";
      if (!ct.includes("application/json")) {
        setErrorSummary("Este Tumulo não possui contrato de concessão");
        return;
      }
      const data = err?.response?.data;
      const norm = normalizeApiErrors(data);
      setErrors(norm.fields);
      setErrorSummary(norm.summary);
      focusFirstError(norm.fields, fieldRefs);
    } finally {
      setSalvando(false);
    }
  }

  if (!cemAtivo?.id) {
    return <div className="text-sm text-red-600">Selecione um cemitério.</div>;
  }
  if (carregando) {
    return <div className="px-4 py-8 text-gray-700">Carregando dados do sepultado…</div>;
  }

  const input = (label, name, props = {}) => {
    const error = errMsg(name);
    const obrigatorio = ["nome"].includes(name);
    return (
      <div key={name}>
        <label className="block text-sm text-green-900 mb-1">
          {label}
          {obrigatorio ? " *" : ""}
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
    <div className="space-y-6 px-4 pb-10 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">
          {isEdit ? "Editar Sepultado" : "Cadastro de Sepultado"}
        </h2>
      </div>

      {errBox(errorSummary)}

      <form onSubmit={onSubmit}>
        <div className="bg-[#f0f8ea] rounded-xl p-6 shadow space-y-8">
          {/* IDENTIFICAÇÃO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Identificação do Sepultamento</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayReadOnly("Número do sepultamento", form.numero_sepultamento || "-")}
            </div>
          </div>

          {/* DADOS DO SEPULTADO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Dados do Sepultado</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {input("Nome", "nome")}
              <div>
                <label className="block text-sm text-green-900 mb-1">CPF do Sepultado</label>
                <InputMask
                  mask="999.999.999-99"
                  name="cpf_sepultado"
                  value={form.cpf_sepultado}
                  onChange={onChange}
                  inputRef={(el) => (fieldRefs.current["cpf_sepultado"] = el)}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    errMsg("cpf_sepultado") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
                {errMsg("cpf_sepultado") && (
                  <p className="mt-1 text-xs text-red-600">{errMsg("cpf_sepultado")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-green-900 mb-1">Sexo</label>
                <select
                  ref={(el) => (fieldRefs.current["sexo"] = el)}
                  name="sexo"
                  value={form.sexo}
                  onChange={onChange}
                  className={`w-full border rounded-lg px-3 py-2 bg-white ${
                    errMsg("sexo") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                  <option value="NI">Não Informado</option>
                </select>
                {errMsg("sexo") && <p className="mt-1 text-xs text-red-600">{errMsg("sexo")}</p>}
              </div>

              {form.sexo === "O" && input("Descrição do Sexo (se Outro)", "sexo_outro_descricao")}
              {input("Data de Nascimento", "data_nascimento", { type: "date" })}
              {input("Local nascimento", "local_nascimento")}
              {input("Nacionalidade", "nacionalidade")}
              {input("Cor pele", "cor_pele")}
              <div>
                <label className="block text-sm text-green-900 mb-1">Estado civil</label>
                <select
                  ref={(el) => (fieldRefs.current["estado_civil"] = el)}
                  name="estado_civil"
                  value={form.estado_civil}
                  onChange={onChange}
                  className={`w-full border rounded-lg px-3 py-2 bg-white ${
                    errMsg("estado_civil") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                >
                  <option value="SOLTEIRO">Solteiro(a)</option>
                  <option value="CASADO">Casado(a)</option>
                  <option value="VIUVO">Viúvo(a)</option>
                  <option value="DIVORCIADO">Divorciado(a)</option>
                  <option value="NAO_INFORMADO">Não Informado</option>
                </select>
                {errMsg("estado_civil") && (
                  <p className="mt-1 text-xs text-red-600">{errMsg("estado_civil")}</p>
                )}
              </div>

              {(form.estado_civil === "CASADO" || form.estado_civil === "VIUVO") &&
                input("Nome do Cônjuge", "nome_conjuge")}

              {input("Nome do Pai", "nome_pai")}
              {input("Nome da Mãe", "nome_mae")}
              {input("Profissão", "profissao")}
              {input("Escolaridade", "grau_instrucao")}
            </div>
          </div>

          {/* ENDEREÇO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Endereço</div>
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
            </div>
          </div>

          {/* FALECIMENTO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Falecimento</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {input("Data do Falecimento *", "data_falecimento", { type: "date" })}
              <div>
                <label className="block text-sm text-green-900 mb-1">Hora falecimento</label>
                <InputMask
                  mask="99:99"
                  name="hora_falecimento"
                  value={form.hora_falecimento}
                  onChange={onChange}
                  inputRef={(el) => (fieldRefs.current["hora_falecimento"] = el)}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    errMsg("hora_falecimento") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
                {errMsg("hora_falecimento") && (
                  <p className="mt-1 text-xs text-red-600">{errMsg("hora_falecimento")}</p>
                )}
              </div>
              {input("Local falecimento", "local_falecimento")}
              {input("Causa morte", "causa_morte")}
              {input("Médico responsável", "medico_responsavel")}
              {input("CRM médico", "crm_medico")}
              {displayReadOnly("Idade ao falecer", form.idade_ao_falecer || "-")}
            </div>
          </div>

          {/* CARTÓRIO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Registro em Cartório</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {input("Cartório nome", "cartorio_nome")}
              {input("Cartório número registro", "cartorio_numero_registro")}
              {input("Cartório livro", "cartorio_livro")}
              {input("Cartório folha", "cartorio_folha")}
              {input("Data do Registro", "cartorio_data_registro", { type: "date" })}
            </div>
          </div>

          {/* SEPULTAMENTO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Local de Sepultamento</div>
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
                  initialLabel={form.tumulo_label}
                />
              </div>
              {input("Data do Sepultamento *", "data_sepultamento", { type: "date" })}
              <div className="md:col-span-3">
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
                input("Quantidade de Parcelas", "quantidade_parcelas", {
                  type: "number",
                  min: 1,
                })}

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
                  {errMsg("valor") && (
                    <p className="mt-1 text-xs text-red-600">{errMsg("valor")}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RESPONSÁVEL */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Responsável pelo Sepultamento</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {input("Nome", "nome_responsavel")}
              <div>
                <label className="block text-sm text-green-900 mb-1">CPF</label>
                <InputMask
                  mask="999.999.999-99"
                  name="cpf"
                  value={form.cpf}
                  onChange={onChange}
                  inputRef={(el) => (fieldRefs.current["cpf"] = el)}
                  className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                    errMsg("cpf") ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                  }`}
                />
                {errMsg("cpf") && <p className="mt-1 text-xs text-red-600">{errMsg("cpf")}</p>}
              </div>
              {input("Endereço", "endereco")}
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

          {/* MOVIMENTAÇÕES (Exumado/Data; Trasladado/Data) */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Informações de movimentações</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                {displayReadOnly("Exumado", form.exumado ? "Sim" : "Não")}
              </div>
              <div className="md:col-span-2">
                {displayReadOnly("Data da exumação", form.data_exumacao || "-")}
              </div>

              <div className="md:col-span-1">
                {displayReadOnly("Trasladado", form.trasladado ? "Sim" : "Não")}
              </div>
              <div className="md:col-span-2">
                {displayReadOnly("Data do translado", form.data_translado || "-")}
              </div>
            </div>
          </div>

          {/* AÇÕES */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => (onClose ? onClose() : navigate("/sepultados"))}
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
        context={CT_SEPULTADO}
        objectId={isEdit ? id : null}
        api={api}
        disabled={!isEdit}
      />
    </div>
  );
}
