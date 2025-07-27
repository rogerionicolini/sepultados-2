import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Cemiterios from "./pages/Cemiterios";
import Quadras from "./pages/Quadras";
import Tumulos from "./pages/Tumulos";
import Sepultados from "./pages/Sepultados";
import Contratos from "./pages/Contratos";
import Exumacoes from "./pages/Exumacoes";
import Traslados from "./pages/Traslados";
import Receitas from "./pages/Receitas";
import Auditoria from "./pages/Auditoria";
import ImportarQuadras from "./pages/ImportarQuadras";
import ImportarTumulos from "./pages/ImportarTumulos";
import ImportarSepultados from "./pages/ImportarSepultados";
import RelatorioSepultados from "./pages/RelatorioSepultados";
import RelatorioExumacoes from "./pages/RelatorioExumacoes";
import RelatorioTraslados from "./pages/RelatorioTraslados";
import RelatorioContratos from "./pages/RelatorioContratos";
import RelatorioReceitas from "./pages/RelatorioReceitas";
import RelatorioTumulos from "./pages/RelatorioTumulos";
import RecuperarSenha from "./pages/RecuperarSenha";

function AppContent() {
  const location = useLocation();

  // Navbar só aparece nas páginas internas
  const esconderNavbar = ["/", "/login", "/recuperar-senha"].includes(location.pathname);


  return (
    <>
      {!esconderNavbar && <Navbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/cemiterios" element={<Cemiterios />} />
        <Route path="/quadras" element={<Quadras />} />
        <Route path="/tumulos" element={<Tumulos />} />
        <Route path="/sepultados" element={<Sepultados />} />
        <Route path="/contratos" element={<Contratos />} />
        <Route path="/exumacoes" element={<Exumacoes />} />
        <Route path="/traslados" element={<Traslados />} />
        <Route path="/receitas" element={<Receitas />} />
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="/importar-quadras" element={<ImportarQuadras />} />
        <Route path="/importar-tumulos" element={<ImportarTumulos />} />
        <Route path="/importar-sepultados" element={<ImportarSepultados />} />
        <Route path="/relatorio-sepultados" element={<RelatorioSepultados />} />
        <Route path="/relatorio-exumacoes" element={<RelatorioExumacoes />} />
        <Route path="/relatorio-traslados" element={<RelatorioTraslados />} />
        <Route path="/relatorio-contratos" element={<RelatorioContratos />} />
        <Route path="/relatorio-receitas" element={<RelatorioReceitas />} />
        <Route path="/relatorio-tumulos" element={<RelatorioTumulos />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
