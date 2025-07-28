// src/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <div className="fixed top-0 left-0 h-screen w-64 bg-[#224c15] text-white shadow-md z-40 flex flex-col pt-8">
      <div className="text-center text-xl font-bold mb-6 px-4">Sepultados.com</div>

      <nav className="flex-1 overflow-y-auto px-4">
        {[
          { to: "/", label: "Dashboard" },
          { to: "/cemiterios", label: "Cemitérios" },
          { to: "/quadras", label: "Quadras" },
          { to: "/tumulos", label: "Túmulos" },
          { to: "/sepultados", label: "Sepultados" },
          { to: "/contratos", label: "Contratos" },
          { to: "/exumacoes", label: "Exumações" },
          { to: "/traslados", label: "Translados" },
          { to: "/receitas", label: "Receitas" },
          { to: "/auditoria", label: "Auditoria" },
          { to: "/importar-quadras", label: "Importar Quadras" },
          { to: "/importar-tumulos", label: "Importar Túmulos" },
          { to: "/importar-sepultados", label: "Importar Sepultados" },
          { to: "/relatorios/sepultados", label: "Relatório de Sepultados" },
          { to: "/relatorios/exumacoes", label: "Relatório de Exumações" },
          { to: "/relatorios/traslados", label: "Relatório de Translados" },
          { to: "/relatorios/contratos", label: "Relatório de Contratos" },
          { to: "/relatorios/receitas", label: "Relatório de Receitas" },
          { to: "/relatorios/tumulos", label: "Relatório de Túmulos" },
        ].map((item, idx) => (
          <Link
            key={idx}
            to={item.to}
            className="block py-2 px-4 rounded hover:bg-[#1a3b10] transition-colors text-white font-medium"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Navbar;
  