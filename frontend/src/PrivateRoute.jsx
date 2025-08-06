// src/PrivateRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

const PrivateRoute = ({ children }) => {
  const [autenticado, setAutenticado] = useState(null);

  useEffect(() => {
    const verificarAutenticacao = async () => {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        setAutenticado(false);
        return;
      }

      try {
        const res = await axios.get("http://127.0.0.1:8000/api/usuario-logado/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Armazena a prefeitura ativa para o restante do sistema
        if (res.data?.prefeitura?.id) {
          localStorage.setItem("prefeitura_ativa_id", res.data.prefeitura.id);
        }

        setAutenticado(true);
      } catch (err) {
        setAutenticado(false);
      }
    };

    verificarAutenticacao();
  }, []);

  if (autenticado === null) {
    return null; // ou um loader/spinner
  }

  return autenticado ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
