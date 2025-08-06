import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RecuperarSenhaPage from './pages/RecuperarSenha';
import RedefinirSenhaPage from './pages/RedefinirSenha';
import CadastroPrefeitura from './pages/CadastroPrefeitura';
import VerificarEmail from './pages/VerificarEmail';
import PrivateRoute from "./PrivateRoute";

// Importações das páginas internas
import Dados from './pages/Dados';
import DashboardResumo from './pages/DashboardResumo'; // ✅ IMPORT AQUI

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
      <Route index element={<DashboardResumo />} /> {/* ✅ AQUI TROCA */}

      {/* Página /dados */}
      <Route path="dados" element={<Dados />} />
    </Route>
  </Routes>
);

export default AppRoutes;