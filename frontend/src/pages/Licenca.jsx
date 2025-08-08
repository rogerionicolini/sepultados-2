// src/pages/Licenca.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Licenca() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [licenca, setLicenca] = useState(null);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setErro("");
        setLoading(true);

        // 1) pega prefeitura logada
        const pref = await axios.get("http://localhost:8000/api/prefeitura-logada/", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const prefeituraId = pref.data?.id;
        if (!prefeituraId) {
          throw new Error("ID da prefeitura não encontrado.");
        }

        // 2) pega a licença
        const res = await axios.get(`http://localhost:8000/api/licenca/${prefeituraId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setLicenca(res.data);
      } catch (e) {
        console.error(e);
        setErro("Não foi possível carregar a licença.");
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchData();
    else setErro("Token de acesso não encontrado. Faça login novamente.");
  }, [token]);

  if (loading) return <div className="p-6">Carregando...</div>;

  if (erro) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-green-900 mb-4">Licença</h1>
        <p className="text-red-700">{erro}</p>
      </div>
    );
  }

  if (!licenca) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-green-900 mb-4">Licença</h1>
        <p>Nenhuma licença encontrada.</p>
      </div>
    );
  }

  // helpers
  const fmtData = (d) => {
    if (!d) return "-";
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      return date.toLocaleDateString("pt-BR");
    } catch {
      return d;
    }
  };
  const moeda = (v) =>
    typeof v === "number"
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : v ?? "-";
  const simNao = (b) => (b ? "Sim" : "Não");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-green-900 mb-6">Licença</h1>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Cabeçalho do card */}
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-green-900">Detalhes da Licença</h2>
        </div>

        {/* Conteúdo */}
        <div className="p-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Coluna esquerda */}
          <div className="space-y-6">
            {/* Plano */}
            <section>
              <SectionTitle>Plano</SectionTitle>
              <div className="text-base text-gray-900">{licenca.plano_nome || "-"}</div>
            </section>

            {/* Período (Início / Término lado a lado + Duração) */}
            <section>
              <SectionTitle>Período</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Início" value={fmtData(licenca.data_inicio)} />
                <Field label="Término" value={fmtData(licenca.data_fim)} />
              </div>
              <div className="mt-3">
                <Field
                  label="Duração"
                  value={
                    licenca.meses_contrato
                      ? `${licenca.meses_contrato} meses`
                      : `${(licenca.anos_contratados || 0) * 12} meses`
                  }
                />
              </div>
            </section>

            {/* Valores */}
            <section>
              <SectionTitle>Valores</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Valor mensal (atual)" value={moeda(licenca.valor_mensal_atual)} />
                <Field label="Valor reajustado" value={moeda(licenca.valor_mensal_reajustado)} />
              </div>
              <div className="mt-3">
                <Field
                  label="Reajuste anual (%)"
                  value={
                    typeof licenca.percentual_reajuste_anual === "number"
                      ? `${licenca.percentual_reajuste_anual.toFixed(2)}%`
                      : "-"
                  }
                />
              </div>
            </section>
          </div>

          {/* Coluna direita */}
          <div className="space-y-6">
            {/* Limites */}
            <section>
              <SectionTitle>Limites</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Usuários permitidos"
                  value={`${licenca.usuarios_min} - ${licenca.usuarios_max}`}
                />
                <Field
                  label="Sepultados máx."
                  value={licenca.sepultados_max ?? "Ilimitado"}
                />
              </div>
            </section>

            {/* Recursos */}
            <section>
              <SectionTitle>Recursos</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Pill label="Inclui API" value={simNao(licenca.inclui_api)} />
                <Pill label="Inclui ERP" value={simNao(licenca.inclui_erp)} />
                <Pill
                  label="Suporte prioritário"
                  value={simNao(licenca.inclui_suporte_prioritario)}
                  className="col-span-2 lg:col-span-1"
                />
              </div>
            </section>

            {/* Situação */}
            <section>
              <SectionTitle>Situação</SectionTitle>
              {licenca.expirada ? (
                <Badge tone="red">Expirada</Badge>
              ) : (
                <Badge tone="green">Vigente</Badge>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
      {children}
    </h3>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value ?? "-"}</p>
    </div>
  );
}

function Pill({ label, value, className = "" }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${className}`}>
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
        {value}
      </span>
    </div>
  );
}

function Badge({ children, tone = "green" }) {
  const toneClasses =
    tone === "red"
      ? "bg-red-100 text-red-700"
      : "bg-green-100 text-green-700";
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${toneClasses}`}>
      {children}
    </span>
  );
}
