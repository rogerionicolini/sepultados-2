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
import RedefinirSenhaPage from "./pages/RedefinirSenha";
import PrivateRoute from "./PrivateRoute"; // IMPORTADO AQUI
import Dashboard from "./pages/Dashboard";


function AppContent() {
  const location = useLocation();

  const esconderNavbar =
    ["/", "/login", "/recuperar-senha"].includes(location.pathname) ||
    location.pathname.startsWith("/redefinir-senha/");

  return (
    <>
      {!esconderNavbar && <Navbar />}

      <Routes>
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/redefinir-senha/:uid/:token" element={<RedefinirSenhaPage />} />
        <Route path="/cemiterios" element={<PrivateRoute><Cemiterios /></PrivateRoute>} />
        <Route path="/quadras" element={<PrivateRoute><Quadras /></PrivateRoute>} />
        <Route path="/tumulos" element={<PrivateRoute><Tumulos /></PrivateRoute>} />
        <Route path="/sepultados" element={<PrivateRoute><Sepultados /></PrivateRoute>} />
        <Route path="/contratos" element={<PrivateRoute><Contratos /></PrivateRoute>} />
        <Route path="/exumacoes" element={<PrivateRoute><Exumacoes /></PrivateRoute>} />
        <Route path="/traslados" element={<PrivateRoute><Traslados /></PrivateRoute>} />
        <Route path="/receitas" element={<PrivateRoute><Receitas /></PrivateRoute>} />
        <Route path="/auditoria" element={<PrivateRoute><Auditoria /></PrivateRoute>} />
        <Route path="/importar-quadras" element={<PrivateRoute><ImportarQuadras /></PrivateRoute>} />
        <Route path="/importar-tumulos" element={<PrivateRoute><ImportarTumulos /></PrivateRoute>} />
        <Route path="/importar-sepultados" element={<PrivateRoute><ImportarSepultados /></PrivateRoute>} />
        <Route path="/relatorio-sepultados" element={<PrivateRoute><RelatorioSepultados /></PrivateRoute>} />
        <Route path="/relatorio-exumacoes" element={<PrivateRoute><RelatorioExumacoes /></PrivateRoute>} />
        <Route path="/relatorio-traslados" element={<PrivateRoute><RelatorioTraslados /></PrivateRoute>} />
        <Route path="/relatorio-contratos" element={<PrivateRoute><RelatorioContratos /></PrivateRoute>} />
        <Route path="/relatorio-receitas" element={<PrivateRoute><RelatorioReceitas /></PrivateRoute>} />
        <Route path="/relatorio-tumulos" element={<PrivateRoute><RelatorioTumulos /></PrivateRoute>} />
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
