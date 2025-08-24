// src/PrivateRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, getTokens, clearTokens } from "./api/api";

const PrivateRoute = ({ children }) => {
  const [autenticado, setAutenticado] = useState(null);

  useEffect(() => {
    const verificarAutenticacao = async () => {
      const { access } = getTokens();
      if (!access) {
        setAutenticado(false);
        return;
      }

      try {
        const res = await api.get("/usuario-logado/");

        // espelha dados para componentes legados (Header, etc.)
        const usuario = res.data;
        localStorage.setItem("usuario_logado", JSON.stringify(usuario));
        if (usuario?.email) localStorage.setItem("email_usuario", usuario.email);
        if (usuario?.nome)  localStorage.setItem("nome_usuario", usuario.nome);

        if (usuario?.prefeitura?.id) {
          localStorage.setItem("prefeitura_ativa_id", usuario.prefeitura.id);
          if (usuario.prefeitura?.nome)  localStorage.setItem("prefeitura_nome", usuario.prefeitura.nome);
          if (usuario.prefeitura?.brasao_url) localStorage.setItem("prefeitura_brasao_url", usuario.prefeitura.brasao_url);
        }

        setAutenticado(true);
      } catch (err) {
        clearTokens();
        setAutenticado(false);
      }
    };

    verificarAutenticacao();
  }, []);

  if (autenticado === null) return null; // pode trocar por um spinner

  return autenticado ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
