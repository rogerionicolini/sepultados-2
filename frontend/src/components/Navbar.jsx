import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const Item = ({ label, to, onGo, active }) => (
  <button
    type="button"
    onClick={() => onGo(to)}
    className={`w-full text-left block px-2 py-2 rounded transition ${
      active ? "bg-[#d8e9c0] text-[#224c15]" : "hover:bg-[#d8e9c0]"
    }`}
  >
    {label}
  </button>
);

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNavbar, setShowNavbar] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const hiddenRoutes = ["/", "/login", "/recuperar-senha", "/redefinir-senha"];
    setShowNavbar(Boolean(token) && !hiddenRoutes.includes(location.pathname));
  }, [location]);

  if (!showNavbar) return null;

  // Navegação que força “refresh” quando clicamos na mesma rota
  const go = (path) => {
    if (location.pathname === path) {
      // mesmo caminho -> força remontagem do Outlet via state.refresh
      navigate(path, { replace: true, state: { refresh: Date.now() } });
    } else {
      navigate(path);
    }
  };

  const items = [
    { label: "Dashboard", to: "/dashboard" }, // se sua home do painel é /, use "/"
    { label: "Cemitérios", to: "/cemiterios" },
    { label: "Quadras", to: "/quadras" },
    { label: "Túmulos", to: "/tumulos" },
    { label: "Sepultados", to: "/sepultados" },
    { label: "Contratos", to: "/contratos" },
    { label: "Exumações", to: "/exumacoes" },
    { label: "Translados", to: "/traslados" },
    { label: "Receitas", to: "/receitas" },
    { label: "Auditoria", to: "/relatorio/auditorias" },
    { label: "Importar Quadras", to: "/importacoes" }, // ajuste se tiver páginas separadas
    { label: "Relatório de Sepultados", to: "/relatorio/sepultados" },
    { label: "Relatório de Exumações", to: "/relatorio/exumacoes" },
    { label: "Relatório de Traslados", to: "/relatorio/traslados" },
    { label: "Relatório de Contratos", to: "/relatorio/contratos" },
    { label: "Relatório de Receitas", to: "/relatorio/receitas" },
    { label: "Relatório de Túmulos", to: "/relatorio/tumulos" },
  ];

  return (
    <nav className="w-60 bg-[#224c15] text-white h-screen fixed left-0 top-0 overflow-y-auto p-4">
      <h2 className="text-lg font-bold mb-4">Sepultados.com</h2>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.to}>
            <Item
              label={it.label}
              to={it.to}
              onGo={go}
              active={location.pathname === it.to}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
