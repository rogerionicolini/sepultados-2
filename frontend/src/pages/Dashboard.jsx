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

import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();

  // Helper: se já estamos no path, navega com um query param para forçar "refresh"
  const go = (path) => {
    if (location.pathname.startsWith(path)) {
      navigate(`${path}?r=${Date.now()}`, { replace: false });
    } else {
      navigate(path);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#cde1b1] p-5 shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo" className="h-14" />
        </div>
        <nav className="flex flex-col gap-1">
          <div onClick={() => go("/")}>
            <SidebarItem icon={LayoutDashboard} label="Dashboard" />
          </div>

          <div>
            <div
              onClick={() => {
                setCemiterioOpen((v) => !v);
                go("/cemiterios");
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
                <div onClick={() => go("/quadras")}>
                  <SidebarItem icon={FolderKanban} label="Quadras" />
                </div>
                <div onClick={() => go("/tumulos")}>
                  <SidebarItem icon={FolderKanban} label="Túmulos" />
                </div>
              </div>
            )}
          </div>

          <div>
            <div
              onClick={() => {
                go("/sepultados");
                setSepultadosOpen((v) => !v);
              }}
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
                <div onClick={() => go("/contratos")}>
                  <SidebarItem icon={ScrollText} label="Contratos de Concessão" />
                </div>
                <div onClick={() => go("/exumacoes")}>
                  <SidebarItem icon={ClipboardList} label="Exumações" />
                </div>
                <div onClick={() => go("/traslados")}>
                  <SidebarItem icon={ClipboardList} label="Translados" />
                </div>
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
                <div onClick={() => go("/relatorio/sepultados")}>
                  <SidebarItem icon={FileBarChart} label="Sepultados" />
                </div>
                <div onClick={() => go("/relatorio/exumacoes")}>
                  <SidebarItem icon={FileBarChart} label="Exumações" />
                </div>
                <div onClick={() => go("/relatorio/traslados")}>
                  <SidebarItem icon={FileBarChart} label="Translados" />
                </div>
                <div onClick={() => go("/relatorio/contratos")}>
                  <SidebarItem icon={FileBarChart} label="Contratos" />
                </div>
                <div onClick={() => go("/relatorio/receitas")}>
                  <SidebarItem icon={FileBarChart} label="Receitas" />
                </div>
                <div onClick={() => go("/relatorio/tumulos")}>
                  <SidebarItem icon={FileBarChart} label="Túmulos" />
                </div>
                <div onClick={() => go("/relatorio/auditorias")}>
                  <SidebarItem icon={FileBarChart} label="Histórico de Ações" />
                </div>
              </div>
            )}
          </div>

          <div onClick={() => go("/receitas")}>
            <SidebarItem icon={FileText} label="Receitas" />
          </div>
        </nav>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col bg-[#cde1b1]">
        <header className="bg-[#cde1b1] px-6 py-4 relative header-elevate flex items-center justify-end">
          <div className="absolute left-6 top-1/2 -translate-y-1/2">
            <CemeterySelector onSelected={() => {}} />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2">
            <h1 className="text-2xl font-bold text-green-900">Gestão de Cemitérios</h1>
          </div>
          <UserHeader />
        </header>

        {/* chaveia pelo pathname + search para remontar quando só o ?r muda */}
        <main className="flex-1 bg-white p-8 rounded-tl-3xl">
          <Outlet key={location.pathname + location.search} />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
