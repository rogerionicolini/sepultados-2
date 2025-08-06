import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
        <li>
          <span
            onClick={() => navigate("/")}
            className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition cursor-pointer"
          >
            Dashboard
          </span>
        </li>
        <li><Link to="/cemiterios" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Cemitérios</Link></li>
        <li><Link to="/quadras" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Quadras</Link></li>
        <li><Link to="/tumulos" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Túmulos</Link></li>
        <li><Link to="/sepultados" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Sepultados</Link></li>
        <li><Link to="/contratos" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Contratos</Link></li>
        <li><Link to="/exumacoes" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Exumações</Link></li>
        <li><Link to="/traslados" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Translados</Link></li>
        <li><Link to="/receitas" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Receitas</Link></li>
        <li><Link to="/auditoria" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Auditoria</Link></li>
        <li><Link to="/importar-quadras" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Importar Quadras</Link></li>
        <li><Link to="/importar-tumulos" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Importar Túmulos</Link></li>
        <li><Link to="/importar-sepultados" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Importar Sepultados</Link></li>
        <li><Link to="/relatorio-sepultados" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Relatório de Sepultados</Link></li>
        <li><Link to="/relatorio-exumacoes" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Relatório de Exumações</Link></li>
        <li><Link to="/relatorio-traslados" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Relatório de Traslados</Link></li>
        <li><Link to="/relatorio-contratos" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Relatório de Contratos</Link></li>
        <li><Link to="/relatorio-receitas" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Relatório de Receitas</Link></li>
        <li><Link to="/relatorio-tumulos" className="block px-2 py-2 rounded hover:bg-[#d8e9c0] transition">Relatório de Túmulos</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar;
