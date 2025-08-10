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
import Tumulos from "./pages/Tumulos"; // ✅ nova página

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
      <Route path="tumulos" element={<Tumulos />} /> {/* ✅ nova rota */}
    </Route>
  </Routes>
);

export default AppRoutes;
