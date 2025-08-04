import React, { useEffect, useState } from "react";
import axios from "axios";

function CadastroPrefeitura() {
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    responsavel: "",
    telefone: "",
    email: "",
    senha: "",
    logradouro: "",
    endereco_numero: "",
    endereco_bairro: "",
    endereco_cidade: "",
    endereco_estado: "",
    endereco_cep: "",
    plano_id: "",
    duracao_anos: "1",  // <- campo novo
  });

  const [planos, setPlanos] = useState([]);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    axios.get("http://localhost:8000/api/planos/")
      .then((res) => setPlanos(res.data))
      .catch((err) => console.error("Erro ao buscar planos:", err));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErro("");
    setSucesso("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
        const payload = {
        ...form,
        plano_id: parseInt(form.plano_id),
        duracao_anos: parseInt(form.duracao_anos),
        };

        const response = await axios.post("http://localhost:8000/api/registrar-prefeitura/", payload);

        setSucesso("Cadastro realizado com sucesso!");
        setErro("");
        setForm({
        nome: "",
        cnpj: "",
        responsavel: "",
        telefone: "",
        email: "",
        senha: "",
        logradouro: "",
        endereco_numero: "",
        endereco_bairro: "",
        endereco_cidade: "",
        endereco_estado: "",
        endereco_cep: "",
        plano_id: "",
        duracao_anos: "1",
        });
    } catch (error) {
        console.error(error);
        setSucesso("");
        if (error.response?.data?.detail) {
        setErro(error.response.data.detail);
        } else {
        setErro("Erro ao registrar. Verifique os dados.");
        }
    }
    };


  const planoSelecionado = planos.find(p => String(p.id) === form.plano_id);

  return (
    <div className="min-h-screen bg-[#e3efcc] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-lg w-full max-w-xl"
      >
        <h2 className="text-2xl font-bold text-green-800 mb-6 text-center">
          Cadastro de Prefeitura
        </h2>

        {erro && <p className="text-red-600 font-semibold mb-4">{erro}</p>}
        {sucesso && <p className="text-green-700 font-semibold mb-4">{sucesso}</p>}

        <div className="grid grid-cols-1 gap-3">
          <select
            name="plano_id"
            value={form.plano_id}
            onChange={handleChange}
            className="input"
            required
          >
            <option value="">Selecione um Plano</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} - R$ {p.preco_mensal}
              </option>
            ))}
          </select>

          {/* CAMPO NOVO: duração da licença */}
          <input
            type="number"
            name="duracao_anos"
            placeholder="Duração da licença (anos)"
            value={form.duracao_anos}
            onChange={handleChange}
            className="input"
            min={1}
          />

          {planoSelecionado && (
            <div className="text-sm text-gray-700 p-2 bg-gray-100 rounded">
              <p><strong>Descrição:</strong> {planoSelecionado.descricao || "Sem descrição."}</p>
              <p><strong>Valor mensal:</strong> R$ {planoSelecionado.preco_mensal}</p>
              <p><strong>Usuários:</strong> {planoSelecionado.usuarios_min} a {planoSelecionado.usuarios_max}</p>
              <p><strong>Sepultados permitidos:</strong> {planoSelecionado.sepultados_max || "Ilimitado"}</p>
              <p><strong>Suporte Prioritário:</strong> {planoSelecionado.inclui_suporte_prioritario ? "Sim" : "Não"}</p>
            </div>
          )}

          <input type="text" name="nome" placeholder="Nome da Prefeitura" value={form.nome} onChange={handleChange} className="input" />
          <input type="text" name="cnpj" placeholder="CNPJ" value={form.cnpj} onChange={handleChange} className="input" />
          <input type="text" name="responsavel" placeholder="Nome do Responsável" value={form.responsavel} onChange={handleChange} className="input" />
          <input type="text" name="telefone" placeholder="Telefone" value={form.telefone} onChange={handleChange} className="input" />
          <input type="email" name="email" placeholder="E-mail" value={form.email} onChange={handleChange} className="input" />
          <input type="password" name="senha" placeholder="Senha de acesso" value={form.senha} onChange={handleChange} className="input" />
          <input type="text" name="logradouro" placeholder="Rua / Avenida" value={form.logradouro} onChange={handleChange} className="input" />
          <input type="text" name="endereco_numero" placeholder="Número" value={form.endereco_numero} onChange={handleChange} className="input" />
          <input type="text" name="endereco_bairro" placeholder="Bairro" value={form.endereco_bairro} onChange={handleChange} className="input" />
          <input type="text" name="endereco_cidade" placeholder="Cidade" value={form.endereco_cidade} onChange={handleChange} className="input" />
          <input type="text" name="endereco_estado" placeholder="UF" value={form.endereco_estado} onChange={handleChange} className="input" />
          <input type="text" name="endereco_cep" placeholder="CEP" value={form.endereco_cep} onChange={handleChange} className="input" />
        </div>

        <button
          type="submit"
          className="mt-6 w-full bg-green-800 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Registrar Prefeitura
        </button>
      </form>
    </div>
  );
}

export default CadastroPrefeitura;
