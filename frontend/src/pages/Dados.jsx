import React, { useEffect, useState } from "react";
import axios from "axios";

function Dados() {
  const [form, setForm] = useState({});
  const [logo, setLogo] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const estados = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
    "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO",
    "RR", "SC", "SP", "SE", "TO"
  ];

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (token) {
      axios
        .get("http://localhost:8000/api/prefeitura-logada/", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setForm(res.data))
        .catch(() => setErro("Erro ao carregar os dados."));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagem("");
    setErro("");

    const payload = { ...form };

    if (logo) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        payload["logo_base64"] = reader.result;  // ✅ campo correto
        await enviarParaAPI(payload);
      };
      reader.readAsDataURL(logo);
    } else {
      delete payload["logo_base64"];
      await enviarParaAPI(payload);
    }
  };

  const enviarParaAPI = async (payload) => {
    try {
      await axios.patch("http://localhost:8000/api/prefeitura-logada/", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMensagem("Alterações salvas com sucesso.");
    } catch (err) {
      console.error(err);
      setErro("Erro ao salvar as alterações. Verifique os dados.");
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Dados da Prefeitura</h2>
      {mensagem && <p className="text-green-700 mb-4">{mensagem}</p>}
      {erro && <p className="text-red-700 mb-4">{erro}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block">Nome</label>
          <input name="nome" value={form.nome || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">Responsável</label>
          <input name="responsavel" value={form.responsavel || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">Telefone</label>
          <input name="telefone" value={form.telefone || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">E-mail</label>
          <input name="email" value={form.email || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">CNPJ</label>
          <input name="cnpj" value={form.cnpj || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">Site</label>
          <input name="site" value={form.site || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">Logradouro</label>
          <input name="logradouro" value={form.logradouro || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">Número</label>
          <input name="endereco_numero" value={form.endereco_numero || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">Bairro</label>
          <input name="endereco_bairro" value={form.endereco_bairro || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">Cidade</label>
          <input name="endereco_cidade" value={form.endereco_cidade || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="block">Estado</label>
          <select name="endereco_estado" value={form.endereco_estado || ""} onChange={handleChange} className="w-full p-2 border rounded">
            <option value="">Selecione</option>
            {estados.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block">Nova Logo (opcional)</label>
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files[0])} className="w-full" />
        </div>
        <div className="md:col-span-2 text-center mt-4">
          <button type="submit" className="bg-green-800 hover:bg-green-900 text-white font-bold py-2 px-4 rounded">
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}

export default Dados;
