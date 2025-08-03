import React, { useState } from "react";
import {
  LayoutDashboard,
  UserCircle,
  Book,
  FileText,
  LogOut,
  FolderKanban,
  Users,
  Building,
  ScrollText,
  ClipboardList,
  FileBarChart,
  Globe2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import MapaCemiterio from "../components/MapaCemiterio"; // ← Adicionado aqui

const SidebarItem = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#d8e9c0] rounded-xl cursor-pointer transition">
    <Icon className="w-5 h-5 text-green-900" />
    <span className="text-green-900 font-medium">{label}</span>
  </div>
);

function Dashboard() {
  const totalSepultados = 1523;
  const totalTumulosLivres = 476;
  const totalContratos = 324;

  const [cemiterioOpen, setCemiterioOpen] = useState(false);
  const [sepultadosOpen, setSepultadosOpen] = useState(false);
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#cde1b1] p-5 shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo" className="h-14" />
        </div>
        <nav className="flex flex-col gap-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" />
          <div>
            <div
              onClick={() => setCemiterioOpen(!cemiterioOpen)}
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
                <SidebarItem icon={FolderKanban} label="Quadras" />
                <SidebarItem icon={FolderKanban} label="Túmulos" />
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

          <SidebarItem icon={FileText} label="Receitas" />
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
          <SidebarItem icon={UserCircle} label="Usuários" />
          <SidebarItem icon={Book} label="Importações" />
          <SidebarItem icon={LogOut} label="Sair" />
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="bg-[#cde1b1] px-8 py-4 shadow-md">
          <div className="grid grid-cols-3 items-center">
            <div></div>
            <div className="flex justify-center">
              <h1 className="text-2xl font-bold text-green-900">Gestão de Cemitérios</h1>
            </div>
            <div className="flex justify-end items-center gap-4">
              <span className="text-green-900 font-semibold">Usuário: Digital Copy</span>
              <div className="flex items-center gap-2 cursor-pointer text-green-900">
                <Globe2 className="w-5 h-5" />
                <select className="bg-transparent outline-none">
                  <option>PT</option>
                  <option>ES</option>
                  <option>EN</option>
                  <option>FR</option>
                  <option>IT</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-white p-8 rounded-tl-3xl mt-[-5px] ml-[-20px]">
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
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
