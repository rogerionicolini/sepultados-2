import React, { useEffect, useState } from "react";
import axios from "axios";

function Dados() {
  const [dados, setDados] = useState(null);
  const [logo, setLogo] = useState(null);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const fetchDados = async () => {
      const token = localStorage.getItem("accessToken");
      const response = await axios.get("http://127.0.0.1:8000/api/prefeitura-logada/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDados(response.data);
    };
    fetchDados();
  }, []);

  const handleChange = (e) => {
    setDados({ ...dados, [e.target.name]: e.target.value });
  };

  const handleLogoChange = (e) => {
    setLogo(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("accessToken");

    const formData = new FormData();
    for (const key in dados) {
      if (dados[key] !== null && dados[key] !== undefined) {
        formData.append(key, dados[key]);
      }
    }

    if (logo) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        formData.append("logo_base64", base64String);

        try {
          await axios.put("http://127.0.0.1:8000/api/prefeitura-logada/", formData, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setMensagem("Dados atualizados com sucesso!");
        } catch (error) {
          setMensagem("Erro ao atualizar os dados.");
        }
      };
      reader.readAsDataURL(logo);
    } else {
      try {
        await axios.put("http://127.0.0.1:8000/api/prefeitura-logada/", formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setMensagem("Dados atualizados com sucesso!");
      } catch (error) {
        setMensagem("Erro ao atualizar os dados.");
      }
    }
  };

  if (!dados) return <div className="p-6 text-green-900">Carregando...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-green-900 mb-3 text-center">
        Editar Dados da Prefeitura
      </h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries({
            nome: "Nome",
            responsavel: "Responsável",
            telefone: "Telefone",
            email: "E-mail",
            cnpj: "CNPJ",
            site: "Site",
            logradouro: "Logradouro",
            endereco_numero: "Número",
            endereco_bairro: "Bairro",
            endereco_cidade: "Cidade",
            endereco_estado: "Estado",
            endereco_cep: "CEP",
          }).map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                name={key}
                value={dados[key] || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          ))}

          {/* Campo Cláusulas do Contrato */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cláusulas do Contrato</label>
            <textarea
              name="clausulas_contrato"
              value={dados.clausulas_contrato || ""}
              onChange={handleChange}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            ></textarea>
          </div>

          {/* Campo de logo */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova Logo (opcional)</label>
            <input type="file" accept="image/*" onChange={handleLogoChange} className="w-full" />
          </div>
        </div>

        {/* Mensagem */}
        {mensagem && (
          <p className="text-center text-sm text-green-800 font-semibold mt-2">{mensagem}</p>
        )}

        {/* Botão de salvar */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full bg-green-900 hover:bg-green-800 text-white font-semibold py-2 px-4 rounded-xl transition"
          >
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}

export default Dados;
