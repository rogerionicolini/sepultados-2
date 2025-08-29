// src/pages/DashboardResumo.jsx
import React, { useEffect, useMemo, useState } from "react";
import MapaCemiterio from "../components/MapaCemiterio";
import QuickActions from "../components/QuickActions";
import { api } from "../api/api"; // usa sua instância Axios (com Authorization + refresh)

function Donut({ percent = 0 }) {
  const r = 36, C = 2 * Math.PI * r;
  const pct = Math.min(Math.max(Number(percent || 0), 0), 100);
  const dash = (pct * C) / 100;
  const color = pct < 50 ? "text-green-700" : pct < 80 ? "text-yellow-600" : "text-red-600";
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <circle cx="50" cy="50" r={r} strokeWidth="12" fill="none" className="text-gray-200" stroke="currentColor" />
      <circle
        cx="50" cy="50" r={r} strokeWidth="12" fill="none"
        className={color} stroke="currentColor" strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`} transform="rotate(-90 50 50)"
      />
      <text x="50" y="54" textAnchor="middle" className="fill-green-900 font-bold text-[16px]">
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
}

// lê o cemitério selecionado salvo pela sua UI
function getCemiterioAtivoLocal() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function DashboardResumo() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState({
    total_sepultados: 0,
    total_tumulos_livres: 0,
    total_vagas: 0,
    contratos_ativos: 0,
    ocupacao: { percentual: 0, vagas_totais: 0, vagas_ocupadas: 0, vagas_livres: 0 },
  });
  const [cemAtivo, setCemAtivo] = useState(() => getCemiterioAtivoLocal());

  // reage a troca do cemitério (dropdown do topo)
  useEffect(() => {
    const onChanged = () => setCemAtivo(getCemiterioAtivoLocal());
    window.addEventListener("cemiterio:changed", onChanged);
    const onStorage = (e) => { if (e.key === "cemiterioAtivo") onChanged(); };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cemiterio:changed", onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // carrega o resumo priorizando SEMPRE o cemitério selecionado
  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true);
      setErro(null);
      try {
        let cemId = cemAtivo?.id || null;

        // fallback leve: tenta descobrir pelo backend se não houver no localStorage
        if (!cemId) {
          try {
            const r1 = await api.get("/cemiterio-logado/");
            cemId = r1?.data?.id || r1?.data?.cemiterio_id || r1?.data?.cemiterio?.id || null;
          } catch {}
        }

        const params = {};
        if (cemId) params.cemiterio = cemId;
        else {
          // último fallback: prefeitura ativa
          try {
            const r2 = await api.get("/prefeitura-logada/");
            const prefId = r2?.data?.id || r2?.data?.prefeitura_id || r2?.data?.prefeitura?.id || null;
            if (prefId) params.prefeitura = prefId;
          } catch {}
        }

        const r = await api.get("/dashboard/resumo/", { params });
        if (!dead) setDados(r.data);
      } catch (e) {
        if (!dead) setErro(e?.response?.data?.detail || e.message || "Falha ao carregar o resumo");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => { dead = true; };
  }, [cemAtivo?.id]);

  const cards = useMemo(() => [
    { label: "Total de Sepultados", value: dados.total_sepultados },
    { label: "Total de Túmulos Livres", value: dados.total_tumulos_livres },
    { label: "Total de Vagas", value: dados.total_vagas },
    { label: "Contratos Ativos", value: dados.contratos_ativos },
  ], [dados]);

  return (
    <>
      <QuickActions />

      {erro && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-200">
          <strong>Erro:</strong> {erro}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {cards.map((c, i) => (
          <div key={i} className="bg-[#f0f8ea] p-6 rounded-xl shadow text-green-900 flex flex-col items-center justify-center text-center">
            <p className="text-sm mb-1">{c.label}</p>
            <p className="text-2xl font-bold">{loading ? "…" : c.value}</p>
          </div>
        ))}
        <div className="bg-[#f0f8ea] p-6 rounded-xl shadow text-green-900 flex items-center justify-center text-center">
          {loading ? (
            <p className="text-sm">Carregando…</p>
          ) : (
            <div className="flex items-center gap-4">
              <Donut percent={dados?.ocupacao?.percentual || 0} />
              <div className="text-left">
                <p className="text-sm font-semibold mb-1">Ocupação</p>
                <p className="text-xs">Ocupadas: <b>{dados?.ocupacao?.vagas_ocupadas ?? 0}</b></p>
                <p className="text-xs">Livres: <b>{dados?.ocupacao?.vagas_livres ?? 0}</b></p>
                <p className="text-xs">Total: <b>{dados?.ocupacao?.vagas_totais ?? 0}</b></p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-green-900 mb-3">Mapa do Cemitério</h2>
        {/* força remontagem ao trocar de cemitério */}
        <MapaCemiterio key={cemAtivo?.id || "mapa-default"} />
      </div>
    </>
  );
}
