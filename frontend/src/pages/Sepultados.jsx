import React, { useState, useEffect } from "react";
import axios from "axios";
import FormularioSepultado from "../components/FormularioSepultado";

export default function Sepultados() {
  const [modoFormulario, setModoFormulario] = useState(false);
  const [sepultados, setSepultados] = useState([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (!modoFormulario) {
      buscarSepultados();
    }
  }, [modoFormulario]);

  const buscarSepultados = async () => {
    try {
      const response = await axios.get("http://localhost:8000/api/sepultados/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setSepultados(response.data);
      setErro("");
    } catch (err) {
      setErro("Erro ao carregar sepultados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {modoFormulario ? (
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-md">
          <FormularioSepultado
            onCancel={() => setModoFormulario(false)}
            onSuccess={() => {
              setModoFormulario(false);
              buscarSepultados();
            }}
          />
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-green-900">Sepultados</h1>
            <div>
              <button
                onClick={() => setModoFormulario(true)}
                className="bg-green-800 text-white px-4 py-2 rounded-xl shadow hover:bg-green-700"
              >
                Adicionar
              </button>
            </div>
          </div>

          {erro && <p className="text-red-500">{erro}</p>}
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <table className="w-full bg-green-50 rounded-xl overflow-hidden">
              <thead className="bg-green-100 text-green-900">
                <tr>
                  <th className="py-2 px-4 text-left">Nome</th>
                  <th className="py-2 px-4 text-left">Data Falecimento</th>
                  <th className="py-2 px-4 text-left">Túmulo</th>
                  <th className="py-2 px-4 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sepultados.map((s) => (
                  <tr key={s.id} className="border-t border-green-200">
                    <td className="py-2 px-4">{s.nome}</td>
                    <td className="py-2 px-4">{s.data_falecimento}</td>
                    <td className="py-2 px-4">{s.tumulo_label}</td>
                    <td className="py-2 px-4">
                      <button className="text-yellow-600 hover:underline">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
