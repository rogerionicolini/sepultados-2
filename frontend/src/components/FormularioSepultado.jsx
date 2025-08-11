// src/components/FormularioSepultado.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import InputMask from "react-input-mask";

/* ================= Helpers ================= */
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

/* =============== Dropdown com busca (Túmulo) =============== */
function TumuloDropdown({ value, onChange, api, cemiterioId }) {
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

  useEffect(() => { if (open) carregar(); /* eslint-disable-next-line */ }, [open, cemiterioId]);

  useEffect(() => {
    function outside(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter((o) => o.label.toLowerCase().includes(s));
  }, [itens, q]);

  const currentLabel = itens.find((o) => String(o.id) === String(value))?.label || "Selecione…";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 rounded-lg border border-[#bcd2a7] bg-white text-left hover:bg-[#f7fbf2]"
      >
        <span className="truncate">{currentLabel}</span>
        <span className="float-right">▾</span>
      </button>

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

/* ============================== Página =============================== */
export default function FormularioSepultado() {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const cemAtivo = getCemiterioAtivo();

  const api = useMemo(
    () =>
      axios.create({
        baseURL: "http://127.0.0.1:8000/api/",
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  const [form, setForm] = useState({
    // Somente leitura (exibição)
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
    tumulo: "", // id
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
  const [arquivos, setArquivos] = useState([]);

  // condicionais e limpezas
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

  const estadosCivis = [
    { value: "SOLTEIRO", label: "Solteiro(a)" },
    { value: "CASADO", label: "Casado(a)" },
    { value: "VIUVO", label: "Viúvo(a)" },
    { value: "DIVORCIADO", label: "Divorciado(a)" },
    { value: "NAO_INFORMADO", label: "Não Informado" },
  ];

  const UFS = [
    "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
    "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
    "RO","RR","RS","SC","SE","SP","TO",
  ];

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  // máscara simples de moeda pt-BR
  const onChangeValor = (e) => {
    let v = e.target.value || "";
    v = v.replace(/[^\d]/g, "");
    if (!v) return setForm((s) => ({ ...s, valor: "" }));
    const int = v.slice(0, -2) || "0";
    const dec = v.slice(-2);
    const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setForm((s) => ({ ...s, valor: `${intFmt},${dec}` }));
  };

  async function onSubmit(e) {
    e.preventDefault();

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
      if (ignorar.has(k)) return; // somente leitura -> não enviar
      if (v !== undefined && v !== null && v !== "") fd.append(k, v);
    });
    arquivos.forEach((f) => fd.append("arquivos", f));

    try {
      await api.post("sepultados/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Sepultado cadastrado com sucesso!");
      navigate("/sepultados");
    } catch (err) {
      console.error("Erro ao salvar:", err?.response?.data || err);
      alert("Erro ao salvar. Verifique os campos.");
    }
  }

  if (!cemAtivo?.id) {
    return <div className="text-sm text-red-600">Selecione um cemitério.</div>;
  }

  const input = (label, name, props = {}) => (
    <div key={name}>
      <label className="block text-sm text-green-900 mb-1">{label}</label>
      <input
        name={name}
        value={form[name] || ""}
        onChange={onChange}
        className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
        {...props}
      />
    </div>
  );

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

  const simNao = (v) => (v ? "Sim" : "Não");

  return (
    <div className="space-y-6 px-4 pb-10 pt-4">
      <h2 className="text-xl font-bold text-green-900">Cadastro de Sepultado</h2>

      <form onSubmit={onSubmit} encType="multipart/form-data">
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
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm text-green-900 mb-1">Sexo</label>
                <select
                  name="sexo"
                  value={form.sexo}
                  onChange={onChange}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                  <option value="NI">Não Informado</option>
                </select>
              </div>

              {form.sexo === "O" && input("Descrição do Sexo (se Outro)", "sexo_outro_descricao")}
              {input("Data de Nascimento", "data_nascimento", { type: "date" })}
              {input("Local nascimento", "local_nascimento")}
              {input("Nacionalidade", "nacionalidade")}
              {input("Cor pele", "cor_pele")}
              <div>
                <label className="block text-sm text-green-900 mb-1">Estado civil</label>
                <select
                  name="estado_civil"
                  value={form.estado_civil}
                  onChange={onChange}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
                >
                  {estadosCivis.map((ec) => (
                    <option key={ec.value} value={ec.value}>
                      {ec.label}
                    </option>
                  ))}
                </select>
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
                  name="estado"
                  value={form.estado}
                  onChange={onChange}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">Selecione</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* FALECIMENTO */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Falecimento</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {input("Data do Falecimento", "data_falecimento", { type: "date" })}
              <div>
                <label className="block text-sm text-green-900 mb-1">Hora falecimento</label>
                <InputMask
                  mask="99:99"
                  name="hora_falecimento"
                  value={form.hora_falecimento}
                  onChange={onChange}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
                />
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
                <label className="block text-sm text-green-900 mb-1">Túmulo</label>
                <TumuloDropdown
                  value={form.tumulo}
                  onChange={(id) => setForm((s) => ({ ...s, tumulo: id }))}
                  api={api}
                  cemiterioId={cemAtivo?.id}
                />
              </div>
              {input("Data do Sepultamento", "data_sepultamento", { type: "date" })}
              <div className="md:col-span-3">
                <label className="block text-sm text-green-900 mb-1">Observações</label>
                <textarea
                  name="observacoes"
                  value={form.observacoes}
                  onChange={onChange}
                  rows={4}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
                />
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
                  name="forma_pagamento"
                  value={form.forma_pagamento}
                  onChange={onChange}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 bg-white"
                >
                  <option value="gratuito">Gratuito</option>
                  <option value="avista">À Vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
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
                    name="valor"
                    value={form.valor}
                    onChange={onChangeValor}
                    inputMode="numeric"
                    className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
                    placeholder="0,00"
                  />
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
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
                />
              </div>
              {input("Endereço", "endereco")}
              <div>
                <label className="block text-sm text-green-900 mb-1">Telefone</label>
                <InputMask
                  mask="(99) 99999-9999"
                  name="telefone"
                  value={form.telefone}
                  onChange={onChange}
                  className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* INFORMAÇÕES DE MOVIMENTAÇÕES (somente leitura) */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Informações de movimentações</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayReadOnly("Exumado", simNao(form.exumado))}
              {displayReadOnly("Data da exumação", form.data_exumacao || "-")}
              {displayReadOnly("Trasladado", simNao(form.trasladado))}
              {displayReadOnly("Data do translado", form.data_translado || "-")}
            </div>
          </div>

          {/* ANEXOS */}
          <div>
            <div className="text-green-900 font-semibold mb-2">Arquivos Anexados</div>
            <input
              type="file"
              multiple
              onChange={(e) => setArquivos(Array.from(e.target.files))}
              className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
            />
          </div>

          {/* AÇÕES */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate("/sepultados")}
              className="px-4 py-2 rounded-lg border border-[#bcd2a7] text-green-900 hover:bg-[#f0f8ea]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90"
            >
              Salvar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
