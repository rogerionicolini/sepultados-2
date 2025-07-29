import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RecuperarSenhaPage from './pages/RecuperarSenha'; // essa também precisa estar
import RedefinirSenhaPage from './pages/RedefinirSenha'; // ADICIONE ESSA
import PrivateRoute from "./PrivateRoute";

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
    <Route path="/redefinir-senha/:uid/:token/" element={<RedefinirSenhaPage />} />
    <Route
      path="/dashboard"
      element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      }
    />
  </Routes>
);

export default AppRoutes;
