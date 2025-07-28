import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaThList,
  FaCubes,
  FaUsers,
  FaFileContract,
  FaExchangeAlt,
  FaTruck,
  FaFileInvoiceDollar,
  FaChartBar,
} from "react-icons/fa";

const Dashboard = () => {
  const [totalSepultados, setTotalSepultados] = useState(0);
  const [contratosAtivos, setContratosAtivos] = useState(0);
  const [receitasPendentes, setReceitasPendentes] = useState("R$ 0,00");
  const prefeituraAtiva = "Prefeitura Municipal de Exemplo";
  const cemiterioAtivo = "Cemitério Central";

  useEffect(() => {
    // Aqui vão as chamadas reais da API depois
    setTotalSepultados(132);
    setContratosAtivos(57);
    setReceitasPendentes("R$ 8.942,20");
  }, []);

  const atalhos = [
    { icon: <FaThList />, label: "Quadras", to: "/quadras" },
    { icon: <FaCubes />, label: "Túmulos", to: "/tumulos" },
    { icon: <FaUsers />, label: "Sepultados", to: "/sepultados" },
    { icon: <FaFileContract />, label: "Contratos", to: "/contratos" },
    { icon: <FaExchangeAlt />, label: "Exumações", to: "/exumacoes" },
    { icon: <FaTruck />, label: "Translados", to: "/translados" },
    { icon: <FaFileInvoiceDollar />, label: "Receitas", to: "/receitas" },
    { icon: <FaChartBar />, label: "Relatórios", to: "/relatorios" },
  ];

  return (
    <div className="min-h-screen bg-[#e3efcc] p-8 space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-green-900">Painel Administrativo</h1>
        <p className="text-green-800 font-medium">
          Prefeitura: <strong>{prefeituraAtiva}</strong>
        </p>
        <p className="text-green-800 font-medium">
          Cemitério: <strong>{cemiterioAtivo}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {atalhos.map((item, idx) => (
          <Link
            to={item.to}
            key={idx}
            className="bg-green-900 hover:bg-green-800 text-white rounded-xl shadow-md p-5 flex flex-col items-center justify-center text-center space-y-2 transition-all duration-200"
          >
            <div className="text-4xl">{item.icon}</div>
            <div className="text-lg font-semibold">{item.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10">
        <Indicador titulo="Total de Sepultados" valor={totalSepultados} />
        <Indicador titulo="Contratos Ativos" valor={contratosAtivos} />
        <Indicador titulo="Receitas Pendentes" valor={receitasPendentes} />
      </div>
    </div>
  );
};

const Indicador = ({ titulo, valor }) => (
  <div className="bg-white shadow rounded-xl p-6 text-green-900">
    <div className="text-sm text-green-800 mb-1">{titulo}</div>
    <div className="text-3xl font-bold">{valor}</div>
  </div>
);

export default Dashboard;
