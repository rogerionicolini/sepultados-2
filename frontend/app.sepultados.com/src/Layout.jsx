import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaHome,
  FaCemetery,
  FaThList,
  FaUsers,
  FaFileInvoiceDollar,
  FaSignOutAlt,
} from "react-icons/fa";

const Layout = ({ children }) => {
  const [menuAberto, setMenuAberto] = useState(true);

  return (
    <div className="flex min-h-screen bg-[#e3efcc]">
      {/* Menu lateral */}
      <div
        className={`${
          menuAberto ? "w-64" : "w-16"
        } bg-green-900 text-white transition-all duration-300 flex flex-col`}
      >
        <button
          className="p-4 text-left focus:outline-none hover:bg-green-800"
          onClick={() => setMenuAberto(!menuAberto)}
        >
          {menuAberto ? "☰ Menu" : "☰"}
        </button>

        <nav className="flex-1 px-2 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-2 p-2 hover:bg-green-800 rounded">
            <FaHome />
            {menuAberto && <span>Dashboard</span>}
          </Link>
          <Link to="/cemiterios" className="flex items-center gap-2 p-2 hover:bg-green-800 rounded">
            <FaCemetery />
            {menuAberto && <span>Cemitérios</span>}
          </Link>
          <Link to="/quadras" className="flex items-center gap-2 p-2 hover:bg-green-800 rounded">
            <FaThList />
            {menuAberto && <span>Quadras</span>}
          </Link>
          <Link to="/sepultados" className="flex items-center gap-2 p-2 hover:bg-green-800 rounded">
            <FaUsers />
            {menuAberto && <span>Sepultados</span>}
          </Link>
          <Link to="/receitas" className="flex items-center gap-2 p-2 hover:bg-green-800 rounded">
            <FaFileInvoiceDollar />
            {menuAberto && <span>Receitas</span>}
          </Link>
        </nav>

        <div className="p-2 border-t border-green-700">
          <Link to="/logout" className="flex items-center gap-2 p-2 hover:bg-green-800 rounded">
            <FaSignOutAlt />
            {menuAberto && <span>Sair</span>}
          </Link>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 p-6 overflow-y-auto">{children}</div>
    </div>
  );
};

export default Layout;
