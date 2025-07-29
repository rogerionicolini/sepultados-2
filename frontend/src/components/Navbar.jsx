import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

const Navbar = () => {
  const location = useLocation();
  const [showNavbar, setShowNavbar] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const hiddenRoutes = ["/", "/login", "/recuperar-senha", "/redefinir-senha"];
    if (!token || hiddenRoutes.includes(location.pathname)) {
      setShowNavbar(false);
    } else {
      setShowNavbar(true);
    }
  }, [location]);

  if (!showNavbar) return null;

  return (
    <nav className="w-60 bg-[#224c15] text-white h-screen fixed left-0 top-0 overflow-y-auto p-4">
      <h2 className="text-lg font-bold mb-4">Sepultados.com</h2>
      <ul className="space-y-1">
        <li><Link to="/dashboard">Dashboard</Link></li>
        <li><Link to="/cemiterios">Cemitérios</Link></li>
        <li><Link to="/quadras">Quadras</Link></li>
        <li><Link to="/tumulos">Túmulos</Link></li>
        <li><Link to="/sepultados">Sepultados</Link></li>
        <li><Link to="/contratos">Contratos</Link></li>
        <li><Link to="/exumacoes">Exumações</Link></li>
        <li><Link to="/traslados">Translados</Link></li>
        <li><Link to="/receitas">Receitas</Link></li>
        <li><Link to="/auditoria">Auditoria</Link></li>
        <li><Link to="/importar-quadras">Importar Quadras</Link></li>
        <li><Link to="/importar-tumulos">Importar Túmulos</Link></li>
        <li><Link to="/importar-sepultados">Importar Sepultados</Link></li>
        <li><Link to="/relatorio-sepultados">Relatório de Sepultados</Link></li>
        <li><Link to="/relatorio-exumacoes">Relatório de Exumações</Link></li>
        <li><Link to="/relatorio-traslados">Relatório de Traslados</Link></li>
        <li><Link to="/relatorio-contratos">Relatório de Contratos</Link></li>
        <li><Link to="/relatorio-receitas">Relatório de Receitas</Link></li>
        <li><Link to="/relatorio-tumulos">Relatório de Túmulos</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar;
