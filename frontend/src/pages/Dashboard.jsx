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
} from "lucide-react";

const SidebarItem = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#d8e9c0] rounded-xl cursor-pointer transition">
    <Icon className="w-5 h-5 text-green-900" />
    <span className="text-green-900 font-medium">{label}</span>
  </div>
);

function Dashboard() {
  return (
    <div className="flex min-h-screen bg-[#e3efcc]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#cde1b1] p-5 shadow-lg">
        <h2 className="text-2xl font-bold text-green-900 mb-8">
          Sepultados.com
        </h2>
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
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold text-green-900 mb-4">
          Bem-vindo ao Painel Administrativo
        </h1>
        <p className="text-green-800">
          Use o menu à esquerda para navegar pelo sistema.
        </p>
      </main>
    </div>
  );
}

export default Dashboard;
