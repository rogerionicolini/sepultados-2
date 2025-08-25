// src/pages/Receitas.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";
const ENDPOINT = "receitas/";

/* ===================== helpers ===================== */

// moeda -> "R$ 1.234,56"
function moeda(v) {
  const n = toNumber(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace("\u00A0", " ");
}

// número seguro (aceita "1.234,56", "1234.56", "R$ 1.234,56", etc.)
function toNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  if (typeof v === "string") {
    let s = v.trim();

    // Remove símbolos (exceto dígitos, vírgula, ponto, sinais)
    s = s.replace(/[^\d,.\-+]/g, "");

    if (s.includes(",") && s.includes(".")) {
      // Tem vírgula e ponto -> assume ponto como milhar e vírgula como decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
      // Só vírgula -> vírgula é decimal
      s = s.replace(",", ".");
    } else {
      // Só ponto -> ponto é decimal (não remove)
      // nada a fazer
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}


// string pt-BR "123,45" (para mostrar no input)
function toPtBRString(n) {
  const v = toNumber(n);
  return v.toFixed(2).replace(".", ",");
}

// normaliza digitação do usuário para uma string pt-BR (mantém vírgula)
function sanitizeMoneyInput(s) {
  let x = (s || "").toString();
  // remove tudo que não é dígito, vírgula ou ponto
  x = x.replace(/[^\d.,]/g, "");
  // se tem vírgula e ponto, assumimos ponto como milhar e removemos
  if (x.includes(",") && x.includes(".")) x = x.replace(/\./g, "");
  // apenas uma vírgula
  const parts = x.split(",");
  if (parts.length > 2) x = parts[0] + "," + parts.slice(1).join("");
  // se só tem ponto, troca por vírgula (pt-BR)
  if (!x.includes(",") && x.includes(".")) x = x.replace(/\./g, ",");
  return x;
}

// converte string pt-BR do input p/ número
function moneyInputToNumber(s) {
  return toNumber((s || "").replace(/\./g, "").replace(",", "."));
}

function StatusPill({ status }) {
  const s = (status || "").toString().toLowerCase();
  const map = {
    aberto: "bg-red-100 text-red-800 border-red-300",
    parcial: "bg-blue-100 text-blue-800 border-blue-300",
    pago: "bg-green-100 text-green-800 border-green-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded border ${map[s] || "bg-gray-100 text-gray-700 border-gray-300"}`}>
      {s || "-"}
    </span>
  );
}

/* ===================== página ===================== */

export default function Receitas() {
  const [prefeituraId, setPrefeituraId] = useState(null);

  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");

  // modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    desconto: "",    // strings pt-BR (com vírgula)
    valor_pago: "",
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
      console.warn("carregarPrefeitura erro:", e?.response?.status, e?.response?.data || e);
    }
  }

  async function carregar() {
    if (!prefeituraId) return;
    try {
      setLoading(true);
      setErro("");
      const res = await api.get(qsWith(ENDPOINT));
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setItens(data);
    } catch (e) {
      console.error("receitas ERRO:", e?.response?.status, e?.response?.data || e);
      setErro("Não foi possível carregar as receitas.");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPrefeitura();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefeituraId]);

  const filtrados = useMemo(() => {
    let arr = [...itens];
    const q = busca.trim().toLowerCase();

    if (statusFiltro) {
      arr = arr.filter((r) => (r.status || "").toLowerCase() === statusFiltro);
    }
    if (q) {
      arr = arr.filter((r) => {
        const texto = [
          r.numero_documento || r.numero,
          r.descricao_segura || r.descricao,
          r.nome,
          r.cpf,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return texto.includes(q);
      });
    }
    return arr;
  }, [itens, busca, statusFiltro]);

  // KPIs (tudo com toNumber para não dar NaN)
  const kpis = useMemo(() => {
    const total = filtrados.length;
    const abertas = filtrados.filter((r) => (r.status || "").toLowerCase() === "aberto").length;
    const pagas = filtrados.filter((r) => (r.status || "").toLowerCase() === "pago").length;
    const emAbertoValor = filtrados.reduce((acc, r) => acc + toNumber(r.valor_em_aberto), 0);
    return { total, abertas, pagas, emAbertoValor };
  }, [filtrados]);

  function abrirPdf(r) {
    const url = qsWith(`${ENDPOINT}${r.id || r.pk}/pdf/`);
    window.open(`${API_BASE}${url}`, "_blank", "noopener,noreferrer");
  }

  async function abrirEditar(r, pagar = false) {
    try {
      // carrega do backend (garante números exatos do admin)
      const res = await api.get(qsWith(`${ENDPOINT}${r.id || r.pk}/`));
      const full = res.data || r;

      setEditando(full);
      // mantém exatamente os valores do backend (sem inventar 33.334,00)
      const descontoStr = toPtBRString(full.desconto);
      const pagoStr = toPtBRString(full.valor_pago);

      // se for "Pagar", pré-preenche valor_pago = total - desconto
      let valorPagoStr = pagoStr;
      if (pagar) {
        const v = toNumber(full.valor_total) - toNumber(full.desconto || 0);
        valorPagoStr = toPtBRString(Math.max(0, v));
      }

      setForm({
        desconto: descontoStr,
        valor_pago: valorPagoStr,
      });
      setModalAberto(true);
    } catch (e) {
      console.error("abrirEditar ERRO:", e?.response?.status, e?.response?.data || e);
      alert("Não foi possível abrir a receita.");
    }
  }

  async function salvar() {
    if (!editando) return;
    try {
      setSalvando(true);

      const payload = {
        // **somente** os dois campos editáveis
        desconto: moneyInputToNumber(form.desconto),
        valor_pago: moneyInputToNumber(form.valor_pago),
      };

      await api.put(qsWith(`${ENDPOINT}${editando.id || editando.pk}/`), payload, {
        headers: { "Content-Type": "application/json" },
      });

      setModalAberto(false);
      setEditando(null);
      await carregar();
    } catch (e) {
      console.error("salvar ERRO:", e?.response?.status, e?.response?.data || e);
      alert(
        e?.response?.data
          ? "Erro ao salvar: " + JSON.stringify(e.response.data)
          : "Erro ao salvar."
      );
    } finally {
      setSalvando(false);
    }
  }

  const valorTotalEditando = toNumber(editando?.valor_total);
  const descontoEditando = moneyInputToNumber(form.desconto);
  const valorPagoEditando = moneyInputToNumber(form.valor_pago);
  const emAbertoPreview = Math.max(0, valorTotalEditando - descontoEditando - valorPagoEditando);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">Receitas</h2>
        <button
          onClick={carregar}
          className="px-4 py-2 rounded-lg bg-[#688f53] text-white hover:opacity-90"
          disabled={!prefeituraId}
        >
          Atualizar
        </button>
      </div>

      <div className="bg-[#f0f8ea] rounded-xl p-4 shadow">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-white rounded-lg border border-[#e0efcf]">
            <div className="text-xs text-gray-600">Total</div>
            <div className="text-2xl font-semibold text-green-900">{kpis.total}</div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-[#e0efcf]">
            <div className="text-xs text-gray-600">Abertas</div>
            <div className="text-2xl font-semibold text-red-700">{kpis.abertas}</div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-[#e0efcf]">
            <div className="text-xs text-gray-600">Pagas</div>
            <div className="text-2xl font-semibold text-green-700">{kpis.pagas}</div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-[#e0efcf]">
            <div className="text-xs text-gray-600">Em aberto (R$)</div>
            <div className="text-2xl font-semibold text-amber-700">{moeda(kpis.emAbertoValor)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <input
            className="w-full md:flex-1 border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
            placeholder="Buscar por nº, descrição, nome, CPF/CNPJ…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            disabled={loading}
          />
          <select
            className="w-full md:w-56 border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none bg-white"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            disabled={loading}
          >
            <option value="">Status: Todos</option>
            <option value="aberto">Abertos</option>
            <option value="parcial">Parciais</option>
            <option value="pago">Pagos</option>
          </select>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-gray-600 px-1">Carregando…</div>
        ) : erro ? (
          <div className="text-red-600 px-1">{erro}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-green-900 bg-[#e6f3d7]">
                  <th className="py-2 px-3 rounded-l-lg">Nº</th>
                  <th className="py-2 px-3">Descrição</th>
                  <th className="py-2 px-3">Nome</th>
                  <th className="py-2 px-3">CPF/CNPJ</th>
                  <th className="py-2 px-3">Vencimento</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3 text-right">Pago</th>
                  <th className="py-2 px-3 text-right">Em aberto</th>
                  <th className="py-2 px-3 rounded-r-lg w-40">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white/50">
                {filtrados.map((r) => (
                  <tr key={r.id || r.pk} className="border-t border-[#d8e9c0] hover:bg-white">
                    <td className="py-2 px-3">{r.numero_documento || r.numero || "-"}</td>
                    <td className="py-2 px-3">{r.descricao_segura || r.descricao || "-"}</td>
                    <td className="py-2 px-3">{r.nome || "-"}</td>
                    <td className="py-2 px-3">{r.cpf || "-"}</td>
                    <td className="py-2 px-3">{r.data_vencimento || "-"}</td>
                    <td className="py-2 px-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="py-2 px-3 text-right">{moeda(r.valor_total)}</td>
                    <td className="py-2 px-3 text-right">{moeda(r.valor_pago)}</td>
                    <td className="py-2 px-3 text-right">{moeda(r.valor_em_aberto)}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirPdf(r)}
                          className="px-3 py-1 rounded border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
                          title="Abrir recibo (PDF)"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => abrirEditar(r, false)}
                          className="px-3 py-1 rounded bg-[#f2b705] text-white hover:opacity-90"
                          title="Editar (desconto/valor pago)"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => abrirEditar(r, true)}
                          className="px-3 py-1 rounded bg-[#2e7d32] text-white hover:opacity-90"
                          title="Pagar (pré-preenche valor pago)"
                        >
                          Pagar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td className="py-6 px-3 text-gray-600" colSpan={10}>
                      Nada encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal editar/pagar */}
      {modalAberto && editando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-900">Contrato de Concessão</h3>
              <button
                onClick={() => setModalAberto(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* bloco “completo”, porém somente 2 campos editáveis */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-green-900">Número</div>
                  <div className="border rounded-lg px-3 py-2 bg-gray-50">{editando.numero_documento || editando.numero || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-green-900">Data do pagamento</div>
                  <div className="border rounded-lg px-3 py-2 bg-gray-50">{editando.data_pagamento || "-"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-green-900">Descrição</div>
                  <div className="border rounded-lg px-3 py-2 bg-gray-50">{editando.descricao_segura || editando.descricao || "-"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-green-900">Nome</div>
                  <div className="border rounded-lg px-3 py-2 bg-gray-50">{editando.nome || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-green-900">CPF/CNPJ</div>
                  <div className="border rounded-lg px-3 py-2 bg-gray-50">{editando.cpf || "-"}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-green-900 mb-1">Valores</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-green-900">Valor total</div>
                    <div className="border rounded-lg px-3 py-2 bg-gray-50">{moeda(editando.valor_total)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-green-900">Desconto (editável)</div>
                    <input
                      className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.desconto}
                      onChange={(e) => setForm((f) => ({ ...f, desconto: sanitizeMoneyInput(e.target.value) }))}
                    />
                  </div>

                  <div>
                    <div className="text-xs text-green-900">Valor pago (editável)</div>
                    <input
                      className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.valor_pago}
                      onChange={(e) => setForm((f) => ({ ...f, valor_pago: sanitizeMoneyInput(e.target.value) }))}
                    />
                  </div>

                  <div>
                    <div className="text-xs text-green-900">Valor em aberto (prévia)</div>
                    <div className="border rounded-lg px-3 py-2 bg-gray-50">{moeda(emAbertoPreview)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-green-900">Vencimento</div>
                  <div className="border rounded-lg px-3 py-2 bg-gray-50">{editando.data_vencimento || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-green-900">Status</div>
                  <div className="border rounded-lg px-3 py-2 bg-gray-50 capitalize">{(editando.status || "-").toString().toLowerCase()}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModalAberto(false)}
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
