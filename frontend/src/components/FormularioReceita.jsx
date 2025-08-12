// src/components/FormularioReceita.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";

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

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const moneyMask = (str) => {
  const digits = String(str ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const int = digits.slice(0, -2) || "0";
  const dec = digits.slice(-2).padStart(2, "0");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
};
const unmaskMoney = (s) => (s ? s.replace(/\./g, "").replace(",", ".") : "");

const Info = ({ label, children }) => (
  <div>
    <div className="text-xs text-green-900">{label}</div>
    <div className="text-base font-medium">{children ?? "-"}</div>
  </div>
);

export default function FormularioReceita({ receitaId, onCancel, onSuccess }) {
  const token = localStorage.getItem("accessToken");
  const cem = getCemiterioAtivo();
  const isEdit = !!receitaId;

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [errors, setErrors] = useState({});
  const refs = useRef({});

  const [r, setR] = useState(null);
  const [valor_pago, setValorPago] = useState("");
  const [desconto, setDesconto] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setCarregando(true);
        const { data } = await api.get(`receitas/${receitaId}/`, {
          params: { cemiterio: cem?.id },
        });
        setR(data);
        setValorPago(data?.valor_pago ? moneyMask(String(data.valor_pago).replace(".", ",")) : "");
        setDesconto(data?.desconto ? moneyMask(String(data.desconto).replace(".", ",")) : "");
      } catch (e) {
        setErro("Não foi possível carregar esta receita.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [api, receitaId, cem?.id, isEdit]);

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    setErrors({});
    try {
      setSalvando(true);
      const fd = new FormData();
      if (desconto !== "") fd.append("desconto", unmaskMoney(desconto));
      if (valor_pago !== "") fd.append("valor_pago", unmaskMoney(valor_pago));
      await api.put(`receitas/${receitaId}/`, fd, { params: { cemiterio: cem?.id } });
      onSuccess?.();
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === "object") setErrors(data);
      else setErro("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function abrirPDF() {
    const tries = [
      `receitas/${receitaId}/pdf/`,
      `receitas/${receitaId}/recibo_pdf/`,
      `receitas/${receitaId}/recibo/`,
      `receitas/${receitaId}/report/`,
      // fallback possível para rota pública do admin (ajuste se souber o app_label)
      `/admin/recibo/${receitaId}/pdf/`,
    ];
    for (const url of tries) {
      try {
        const res = await api.get(url, { responseType: "blob" });
        const ct = res?.headers?.["content-type"] || "";
        if (ct.includes("pdf")) {
          const blob = new Blob([res.data], { type: "application/pdf" });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, "_blank");
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          return;
        }
      } catch {}
    }
    alert("Não foi possível gerar o recibo PDF.");
  }

  if (!cem?.id) return <div className="text-sm text-red-600">Selecione um cemitério.</div>;
  if (carregando) return <div className="px-4 py-8">Carregando…</div>;
  if (!r) return null;

  const totalCorrigido =
    Number(r.valor_total || 0) +
    Number(r.multa || 0) +
    Number(r.juros || 0) +
    Number(r.mora_diaria || 0) -
    Number(r.desconto || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-900">Receber Receita</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={abrirPDF}
            className="px-4 py-2 rounded-lg border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
            disabled={!isEdit}
          >
            Recibo (PDF)
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-2">
          {erro}
        </div>
      )}

      {/* Identificação */}
      <div className="bg-[#f0f8ea] rounded-xl p-6 shadow space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Info label="Número">{r.numero_documento || "-"}</Info>
          <Info label="Descrição">{r.descricao || "-"}</Info>
          <Info label="Vencimento">
            {r.data_vencimento || "-"}
          </Info>
          <Info label="Status">
            <span className="capitalize">{r.status || "-"}</span>
          </Info>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Info label="Nome">{r.nome || "-"}</Info>
          <Info label="CPF/CNPJ">{r.cpf || "-"}</Info>
          <Info label="Pagamento">{r.data_pagamento || "-"}</Info>
          <Info label="Vinculado a">
            {r.contrato ? "Contrato" : r.exumacao ? "Exumação" : r.translado ? "Translado" : r.sepultado ? "Sepultamento" : "-"}
          </Info>
        </div>

        {/* Valores */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Info label="Valor total">{fmtMoney(r.valor_total)}</Info>
          <Info label="Multa">{fmtMoney(r.multa)}</Info>
          <Info label="Juros">{fmtMoney(r.juros)}</Info>
          <Info label="Mora diária">{fmtMoney(r.mora_diaria)}</Info>
          <Info label="Desconto">{fmtMoney(r.desconto)}</Info>
          <Info label="Total corrigido">{fmtMoney(totalCorrigido)}</Info>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Info label="Valor pago">{fmtMoney(r.valor_pago)}</Info>
          <Info label="Em aberto">{fmtMoney(r.valor_em_aberto)}</Info>
          <Info label="Situação atual">
            <span className="capitalize">{r.status}</span>
          </Info>
        </div>
      </div>

      {/* Formulário de recebimento */}
      <form onSubmit={salvar}>
        <div className="bg-[#f0f8ea] rounded-xl p-6 shadow space-y-6">
          <div className="text-green-900 font-semibold">Registrar pagamento / desconto</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-green-900 mb-1">Desconto (R$)</label>
              <input
                ref={(el) => (refs.current["desconto"] = el)}
                value={desconto}
                onChange={(e) => setDesconto(moneyMask(e.target.value))}
                inputMode="numeric"
                placeholder="0,00"
                className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                  errors.desconto ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                }`}
              />
              {errors.desconto && (
                <p className="mt-1 text-xs text-red-600">{String(errors.desconto)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-green-900 mb-1">Valor pago (R$)</label>
              <input
                ref={(el) => (refs.current["valor_pago"] = el)}
                value={valor_pago}
                onChange={(e) => setValorPago(moneyMask(e.target.value))}
                inputMode="numeric"
                placeholder="0,00"
                className={`w-full border rounded-lg px-3 py-2 outline-none bg-white ${
                  errors.valor_pago ? "border-red-400 ring-1 ring-red-500" : "border-[#bcd2a7]"
                }`}
              />
              {errors.valor_pago && (
                <p className="mt-1 text-xs text-red-600">{String(errors.valor_pago)}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
    </div>
  );
}
