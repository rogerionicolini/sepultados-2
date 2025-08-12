// src/pages/DashboardResumo.jsx
import React from "react";
import MapaCemiterio from "../components/MapaCemiterio";
import QuickActions from "../components/QuickActions"; // <— importe aqui

function DashboardResumo() {
  const totalSepultados = 1523;
  const totalTumulosLivres = 476;
  const totalContratos = 324;

  return (
    <>
      {/* Atalhos rápidos */}
      <QuickActions />

      {/* Caixas de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#f0f8ea] p-6 rounded-xl shadow text-green-900 flex flex-col items-center justify-center text-center">
          <p className="text-sm mb-1">Total de Sepultados</p>
          <p className="text-2xl font-bold">{totalSepultados}</p>
        </div>
        <div className="bg-[#f0f8ea] p-6 rounded-xl shadow text-green-900 flex flex-col items-center justify-center text-center">
          <p className="text-sm mb-1">Total de Túmulos Livres</p>
          <p className="text-2xl font-bold">{totalTumulosLivres}</p>
        </div>
        <div className="bg-[#f0f8ea] p-6 rounded-xl shadow text-green-900 flex flex-col items-center justify-center text-center">
          <p className="text-sm mb-1">Total de Vagas</p>
          <p className="text-2xl font-bold">839</p>
        </div>
        <div className="bg-[#f0f8ea] p-6 rounded-xl shadow text-green-900 flex flex-col items-center justify-center text-center">
          <p className="text-sm mb-1">Contratos Ativos</p>
          <p className="text-2xl font-bold">{totalContratos}</p>
        </div>
      </div>

      {/* Mapa do Cemitério */}
      <div>
        <h2 className="text-lg font-bold text-green-900 mb-3">Mapa do Cemitério</h2>
        <MapaCemiterio />
      </div>
    </>
  );
}

export default DashboardResumo;
