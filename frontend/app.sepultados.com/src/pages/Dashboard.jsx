// src/pages/Dashboard.jsx
import React from "react";

const Dashboard = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#224c15] mb-6">Painel de Controle</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-[#224c15]">Total de Sepultados</h2>
          <p className="text-3xl font-bold mt-2 text-gray-700">--</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-[#224c15]">Contratos Ativos</h2>
          <p className="text-3xl font-bold mt-2 text-gray-700">--</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-[#224c15]">Receitas Pendentes</h2>
          <p className="text-3xl font-bold mt-2 text-gray-700">--</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
