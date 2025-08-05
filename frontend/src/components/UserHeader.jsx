import React, { useEffect, useState } from "react";
import axios from "axios";
import { Globe2 } from "lucide-react";

function UserHeader() {
  const [usuario, setUsuario] = useState(null);
  const [prefeitura, setPrefeitura] = useState(null);

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

  if (!usuario || !prefeitura) return null;

  return (
    <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow">
      {/* Logo da Prefeitura */}
      {prefeitura.logo_url && (
        <img
          src={prefeitura.logo_url}
          alt="Logo da Prefeitura"
          className="h-10 w-10 object-contain rounded-full"
        />
      )}

      {/* Nome da prefeitura e usuário */}
      <div className="flex flex-col">
        <p className="text-green-900 font-bold leading-tight">{prefeitura.nome}</p>
        <p className="text-gray-600 text-sm">{usuario.nome}</p>
      </div>

      {/* Espaço de preenchimento */}
      <div className="flex-1" />

      {/* Seletor de idioma */}
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
  );
}

export default UserHeader;
