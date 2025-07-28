// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import RecuperarSenha from "./pages/RecuperarSenha";
import RedefinirSenhaPage from "./pages/RedefinirSenha";
import PrivateRoute from "./PrivateRoute";
import Layout from "./Layout";
import routes from "./routes";

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/redefinir-senha/:uid/:token" element={<RedefinirSenhaPage />} />

        {/* Rotas privadas protegidas */}
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          {routes}
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
