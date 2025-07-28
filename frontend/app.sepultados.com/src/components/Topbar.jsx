// src/components/Topbar.jsx
import React from "react";

const Topbar = () => {
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    window.location.href = "/login";
  };

  const prefeituraNome = localStorage.getItem("prefeituraNome") || "Prefeitura Ativa";
  const idioma = localStorage.getItem("idioma") || "PT-BR";

  return (
    <header className="fixed top-0 left-64 right-0 h-14 bg-white border-b border-[#bcd2a7] flex items-center justify-end px-6 shadow z-30">
      <span className="text-sm text-gray-700 mr-4">{idioma}</span>
      <span className="text-sm text-gray-700 mr-6 font-medium">{prefeituraNome}</span>
      <button
        onClick={handleLogout}
        className="bg-[#224c15] text-white px-4 py-1 rounded hover:bg-[#1c3e11]"
      >
        Sair
      </button>
    </header>
  );
};

export default Topbar;
