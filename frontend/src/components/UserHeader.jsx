import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Globe2 } from "lucide-react";

function UserHeader() {
  const [usuario, setUsuario] = useState(null);
  const [prefeitura, setPrefeitura] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);

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
    className="fixed top-[72px] right-4 w-64 bg-[#d8e9c0] shadow-xl z-40 rounded-xl"
  >
    <div className="p-4">
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
            d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span>Dados</span>
      </div>
    </div>
  </div>
)}

    </>
  );
}

export default UserHeader;
