import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Globe2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

function UserHeader() {
  const [usuario, setUsuario] = useState(null);
  const [prefeitura, setPrefeitura] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsuario = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const res = await axios.get("http://127.0.0.1:8000/api/usuario-logado/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setUsuario(res.data.usuario);
        setPrefeitura(res.data.prefeitura);
      } catch (error) {
        console.error("Erro ao buscar dados do usuário:", error);
      }
    };

    fetchUsuario();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(event.target) &&
        !event.target.closest(".user-header-trigger")
      ) {
        setDrawerOpen(false);
      }
    }

    if (drawerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [drawerOpen]);

  if (!usuario || !prefeitura) return null;

  return (
    <>
      <div
        className="user-header-trigger flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow cursor-pointer"
        onClick={() => setDrawerOpen(true)}
      >
        {prefeitura.logo_url && (
          <img
            src={prefeitura.logo_url}
            alt="Logo da Prefeitura"
            className="h-10 w-10 object-contain rounded-full"
          />
        )}

        <div className="flex flex-col">
          <p className="text-green-900 font-bold leading-tight">{prefeitura.nome}</p>
          <p className="text-gray-600 text-sm">{usuario.nome}</p>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-green-900">
          <Globe2 className="w-5 h-5" />
          <select className="bg-transparent outline-none text-sm">
            <option>PT</option>
            <option>ES</option>
            <option>EN</option>
            <option>FR</option>
            <option>IT</option>
          </select>
        </div>
      </div>

      {drawerOpen && (
        <div
          ref={drawerRef}
          className="absolute top-[72px] right-4 w-64 bg-[#d8e9c0] shadow-xl rounded-xl"
          style={{ zIndex: 9999 }}
        >
          <div className="p-4 flex flex-col gap-2">
            {/* Dados */}
            <div
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#cde1b1] cursor-pointer text-green-900"
              onClick={() => {
                setDrawerOpen(false);
                navigate("/dados");
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Dados</span>
            </div>

            {/* Usuários */}
            <div
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#cde1b1] cursor-pointer text-green-900"
              onClick={() => {
                setDrawerOpen(false);
                navigate("/usuarios");
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a4 4 0 00-5-4M9 20H4v-2a4 4 0 015-4m4 6v-2a4 4 0 00-3-3.87m6 1.87a4 4 0 00-3-3.87M9 12a4 4 0 110-8 4 4 0 010 8zm6 0a4 4 0 110-8 4 4 0 010 8z"
                />
              </svg>
              <span>Usuários</span>
            </div>

            {/* Importações */}
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#cde1b1] cursor-pointer text-green-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>Importações</span>
            </div>

            {/* Sair */}
            <div
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#cde1b1] cursor-pointer text-green-900"
              onClick={() => {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                navigate("/login");
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1"
                />
              </svg>
              <span>Sair</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UserHeader;
