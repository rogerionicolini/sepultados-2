import React from "react";
import { Routes, Route } from "react-router-dom";

// Públicas
import Home from "./pages/Home";
import Login from "./pages/Login";
import RecuperarSenhaPage from "./pages/RecuperarSenha";
import RedefinirSenhaPage from "./pages/RedefinirSenha";
import CadastroPrefeitura from "./pages/CadastroPrefeitura";
import VerificarEmail from "./pages/VerificarEmail";

// Layout/Proteção
import PrivateRoute from "./PrivateRoute";
import Dashboard from "./pages/Dashboard";

// Internas (painel)
import DashboardResumo from "./pages/DashboardResumo";
import Dados from "./pages/Dados";
import Usuarios from "./pages/Usuarios";
import Licenca from "./pages/Licenca";
import Cemiterios from "./pages/Cemiterios";
import Quadras from "./pages/Quadras";
import Tumulos from "./pages/Tumulos";
import Sepultados from "./pages/Sepultados";
import Contratos from "./pages/Contratos";
import Exumacoes from "./pages/Exumacoes";
import Translados from "./pages/Translados";
import Receitas from "./pages/Receitas";

// Relatórios (tudo direto em pages/)
import RelatorioSepultados from "./pages/RelatorioSepultados";
import RelatorioExumacoes from "./pages/RelatorioExumacoes";
import RelatorioTranslados from "./pages/RelatorioTranslados";
import RelatorioContratos from "./pages/RelatorioContratos";
import RelatorioReceitas from "./pages/RelatorioReceitas";
import RelatorioTumulos from "./pages/RelatorioTumulos";
import RelatorioAuditorias from "./pages/RelatorioAuditorias.jsx";
import Importacoes from "./pages/Importacoes";
import BackupSistema from "./pages/BackupSistema";



const AppRoutes = () => (
  <Routes>
    {/* Rotas públicas */}
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
    <Route path="/redefinir-senha/:uid/:token/" element={<RedefinirSenhaPage />} />
    <Route path="/cadastro-prefeitura" element={<CadastroPrefeitura />} />
    <Route path="/verificar-email/:token" element={<VerificarEmail />} />

    {/* Rotas privadas dentro do layout Dashboard */}
    <Route
      path="/"
      element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      }
    >
      {/* Página inicial do dashboard */}
      <Route index element={<DashboardResumo />} />

      {/* Telas internas */}
      <Route path="dados" element={<Dados />} />
      <Route path="usuarios" element={<Usuarios />} />
      <Route path="licenca" element={<Licenca />} />
      <Route path="cemiterios" element={<Cemiterios />} />
      <Route path="quadras" element={<Quadras />} />
      <Route path="tumulos" element={<Tumulos />} />
      <Route path="sepultados" element={<Sepultados />} />
      <Route path="contratos" element={<Contratos />} />
      <Route path="exumacoes" element={<Exumacoes />} />
      <Route path="traslados" element={<Translados />} />
      <Route path="receitas" element={<Receitas />} />
      <Route path="importacoes" element={<Importacoes />} />
      <Route path="backup" element={<BackupSistema />} />


      {/* Relatórios */}
      <Route path="relatorio/sepultados" element={<RelatorioSepultados />} />
      <Route path="relatorio/exumacoes" element={<RelatorioExumacoes />} />
      <Route path="relatorio/traslados" element={<RelatorioTranslados />} />
      <Route path="relatorio/contratos" element={<RelatorioContratos />} />
      <Route path="relatorio/receitas" element={<RelatorioReceitas />} />
      <Route path="relatorio/tumulos" element={<RelatorioTumulos />} />
      <Route path="relatorio/auditorias" element={<RelatorioAuditorias />} />
    </Route>
  </Routes>
);

export default AppRoutes;
