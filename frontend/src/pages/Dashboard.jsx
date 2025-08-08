import React, { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  Users,
  Building,
  ScrollText,
  ClipboardList,
  FileBarChart,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { Outlet, useNavigate } from "react-router-dom";
import UserHeader from "../components/UserHeader";
import CemeterySelector from "../components/CemeterySelector";

const SidebarItem = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#d8e9c0] rounded-xl cursor-pointer transition">
    <Icon className="w-5 h-5 text-green-900" />
    <span className="text-green-900 font-medium">{label}</span>
  </div>
);

function Dashboard() {
  const [cemiterioOpen, setCemiterioOpen] = useState(false);
  const [sepultadosOpen, setSepultadosOpen] = useState(false);
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#cde1b1] p-5 shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo" className="h-14" />
        </div>
        <nav className="flex flex-col gap-1">
          <div onClick={() => navigate("/")}>
            <SidebarItem icon={LayoutDashboard} label="Dashboard" />
          </div>

          <div>
            <div
              onClick={() => {
                setCemiterioOpen((v) => !v);
                navigate("/cemiterios"); // abre a página central
              }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#d8e9c0] rounded-xl cursor-pointer transition"
            >
              <Building className="w-5 h-5 text-green-900" />
              <span className="text-green-900 font-medium flex-1">Cemitérios</span>
              {cemiterioOpen ? (
                <ChevronDown className="w-4 h-4 text-green-900" />
              ) : (
                <ChevronRight className="w-4 h-4 text-green-900" />
              )}
            </div>
            {cemiterioOpen && (
              <div className="ml-8 mt-1 flex flex-col gap-1">
                <div onClick={() => navigate("/quadras")}>
                  <SidebarItem icon={FolderKanban} label="Quadras" />
                </div>
                <div onClick={() => navigate("/tumulos")}>
                  <SidebarItem icon={FolderKanban} label="Túmulos" />
                </div>
              </div>
            )}
          </div>

          <div>
            <div
              onClick={() => setSepultadosOpen(!sepultadosOpen)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#d8e9c0] rounded-xl cursor-pointer transition"
            >
              <Users className="w-5 h-5 text-green-900" />
              <span className="text-green-900 font-medium flex-1">Sepultados</span>
              {sepultadosOpen ? (
                <ChevronDown className="w-4 h-4 text-green-900" />
              ) : (
                <ChevronRight className="w-4 h-4 text-green-900" />
              )}
            </div>
            {sepultadosOpen && (
              <div className="ml-8 mt-1 flex flex-col gap-1">
                <SidebarItem icon={ScrollText} label="Contratos de Concessão" />
                <SidebarItem icon={ClipboardList} label="Exumações" />
                <SidebarItem icon={ClipboardList} label="Translados" />
              </div>
            )}
          </div>

          <div>
            <div
              onClick={() => setRelatoriosOpen(!relatoriosOpen)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#d8e9c0] rounded-xl cursor-pointer transition"
            >
              <FileBarChart className="w-5 h-5 text-green-900" />
              <span className="text-green-900 font-medium flex-1">Relatórios</span>
              {relatoriosOpen ? (
                <ChevronDown className="w-4 h-4 text-green-900" />
              ) : (
                <ChevronRight className="w-4 h-4 text-green-900" />
              )}
            </div>
            {relatoriosOpen && (
              <div className="ml-8 mt-1 flex flex-col gap-1">
                <SidebarItem icon={FileBarChart} label="Sepultados" />
                <SidebarItem icon={FileBarChart} label="Exumações" />
                <SidebarItem icon={FileBarChart} label="Translados" />
                <SidebarItem icon={FileBarChart} label="Contratos" />
                <SidebarItem icon={FileBarChart} label="Receitas" />
                <SidebarItem icon={FileBarChart} label="Túmulos" />
                <SidebarItem icon={FileBarChart} label="Histórico de Ações" />
              </div>
            )}
          </div>

          <SidebarItem icon={FileText} label="Receitas" />
        </nav>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col bg-[#cde1b1]">
        {/* Cabeçalho */}
        <header className="bg-[#cde1b1] px-6 py-4 relative header-elevate flex items-center justify-end">
          {/* seletor à esquerda, centralizado verticalmente */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2">
            <CemeterySelector onSelected={() => { /* opcional: window.location.reload(); */ }} />
          </div>

          {/* título central */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <h1 className="text-2xl font-bold text-green-900">Gestão de Cemitérios</h1>
          </div>

          {/* usuário à direita */}
          <UserHeader />
        </header>
        {/* Conteúdo principal com rotas dinâmicas */}
        <main className="flex-1 bg-white p-8 rounded-tl-3xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
