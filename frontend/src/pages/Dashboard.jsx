import React from "react";
import {
  LayoutDashboard,
  UserCircle,
  Book,
  FileText,
  Settings,
  LogOut,
  FolderKanban,
  Users,
  Building,
  ScrollText,
  ClipboardList,
  Landmark,
  FileBarChart,
  Globe2,
} from "lucide-react";

const SidebarItem = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#d8e9c0] rounded-xl cursor-pointer transition">
    <Icon className="w-5 h-5 text-green-900" />
    <span className="text-green-900 font-medium">{label}</span>
  </div>
);

function Dashboard() {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#cde1b1] p-5 shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo" className="h-14" />
        </div>
        <nav className="flex flex-col gap-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem icon={Landmark} label="Prefeituras" />
          <SidebarItem icon={Building} label="Cemitérios" />
          <SidebarItem icon={FolderKanban} label="Quadras e Túmulos" />
          <SidebarItem icon={Users} label="Sepultados" />
          <SidebarItem icon={ScrollText} label="Contratos de Concessão" />
          <SidebarItem icon={ClipboardList} label="Exumações e Translados" />
          <SidebarItem icon={FileText} label="Receitas" />
          <SidebarItem icon={FileBarChart} label="Relatórios" />
          <SidebarItem icon={UserCircle} label="Usuários e Permissões" />
          <SidebarItem icon={Settings} label="Administração e Licenças" />
          <SidebarItem icon={Book} label="Importações" />
          <SidebarItem icon={LogOut} label="Sair" />
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="bg-[#cde1b1] px-8 py-4 shadow-md">
          <div className="grid grid-cols-3 items-center">
            {/* Esquerda (vazia ou futuro menu) */}
            <div></div>

            {/* Centro */}
            <div className="flex justify-center">
              <h1 className="text-2xl font-bold text-green-900">Gestão de Cemitérios</h1>
            </div>

            {/* Direita */}
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
        {/* Conteúdo da Dashboard */}
        <main className="flex-1 bg-white p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow text-green-900">
              <p className="text-sm">Total de Sepultados</p>
              <p className="text-2xl font-bold">1.523</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow text-green-900">
              <p className="text-sm">Receitas Geradas</p>
              <p className="text-2xl font-bold">R$ 84.932,00</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow text-green-900">
              <p className="text-sm">Exumações</p>
              <p className="text-2xl font-bold">137</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow text-green-900">
              <p className="text-sm">Contratos Ativos</p>
              <p className="text-2xl font-bold">324</p>
            </div>
          </div>

          <p className="text-green-800">
            Use o menu à esquerda para navegar pelo sistema.
          </p>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
