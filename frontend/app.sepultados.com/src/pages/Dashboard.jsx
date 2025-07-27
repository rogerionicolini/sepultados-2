import React from "react";
import { Link } from "react-router-dom";
import {
  FaCross,
  FaClipboardList,
  FaSkull,
  FaFileImport,
  FaChartBar,
  FaBookDead,
  FaHandHoldingUsd,
  FaUserShield,
  FaFileAlt,
  FaSignOutAlt,
  FaGlobe,
  FaBuilding
} from "react-icons/fa";
import { useTranslation } from "react-i18next";

const Dashboard = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const userName = "Admin"; // Substituir pelo nome do usuário logado
  const prefeituraNome = "Prefeitura Central"; // Substituir pela prefeitura ativa real

  const sections = [
    {
      title: "📁 Módulos de Gestão",
      items: [
        { icon: <FaCross />, label: "Cemitérios", to: "/cemiterios" },
        { icon: <FaClipboardList />, label: "Quadras", to: "/quadras" },
        { icon: <FaClipboardList />, label: "Túmulos", to: "/tumulos" },
        { icon: <FaSkull />, label: "Sepultados", to: "/sepultados" },
        { icon: <FaHandHoldingUsd />, label: "Contratos", to: "/contratos" },
        { icon: <FaBookDead />, label: "Exumações", to: "/exumacoes" },
        { icon: <FaBookDead />, label: "Traslados", to: "/traslados" },
        { icon: <FaChartBar />, label: "Receitas", to: "/receitas" },
        { icon: <FaUserShield />, label: "Auditoria", to: "/auditoria" },
      ],
    },
    {
      title: "📥 Importações por Planilha",
      items: [
        { icon: <FaFileImport />, label: "Importar Quadras", to: "/importar-quadras" },
        { icon: <FaFileImport />, label: "Importar Túmulos", to: "/importar-tumulos" },
        { icon: <FaFileImport />, label: "Importar Sepultados", to: "/importar-sepultados" },
      ],
    },
    {
      title: "📊 Relatórios",
      items: [
        { icon: <FaFileAlt />, label: "Relatório de Sepultados", to: "/relatorio-sepultados" },
        { icon: <FaFileAlt />, label: "Relatório de Exumações", to: "/relatorio-exumacoes" },
        { icon: <FaFileAlt />, label: "Relatório de Traslados", to: "/relatorio-traslados" },
        { icon: <FaFileAlt />, label: "Relatório de Contratos", to: "/relatorio-contratos" },
        { icon: <FaFileAlt />, label: "Relatório de Receitas", to: "/relatorio-receitas" },
        { icon: <FaFileAlt />, label: "Relatório de Túmulos", to: "/relatorio-tumulos" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#e3efcc]">
      {/* Topbar */}
      <div className="flex items-center justify-between bg-white shadow-md p-4 px-6">
        <h1 className="text-xl font-bold text-green-900">Sepultados.com</h1>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-green-800 font-semibold">
            <FaBuilding />
            {prefeituraNome}
          </div>

          <div className="flex items-center gap-1 text-green-800">
            <FaGlobe />
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="bg-transparent text-green-800 font-medium"
            >
              <option value="pt">PT</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="fr">FR</option>
              <option value="it">IT</option>
            </select>
          </div>

          <div className="text-green-800 font-medium">👤 {userName}</div>

          <button
            className="text-red-600 hover:text-red-800 transition"
            onClick={() => {
              // Adicione aqui lógica de logout
              alert("Logout ainda não implementado");
            }}
          >
            <FaSignOutAlt size={18} />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-green-900 mb-2 drop-shadow-sm">
            👋 {t("Bem-vindo ao Sepultados.com")}
          </h2>
          <p className="text-green-700 text-lg">
            {t("Utilize os atalhos abaixo para acessar os principais módulos do sistema.")}
          </p>
        </div>

        {sections.map((section, idx) => (
          <div key={idx} className="mb-12">
            <h2 className="text-2xl font-semibold text-green-800 border-l-4 border-green-700 pl-4 mb-6">
              {t(section.title)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {section.items.map((item, i) => (
                <Link
                  key={i}
                  to={item.to}
                  className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 transition hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="bg-green-100 text-green-800 p-3 rounded-full text-xl shadow-sm">
                    {item.icon}
                  </div>
                  <span className="text-green-900 font-medium text-lg">{t(item.label)}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
