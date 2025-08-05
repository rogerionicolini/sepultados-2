import React, { useEffect, useState } from "react";
import axios from "axios";
import { Mail, Lock } from "lucide-react";

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
    duracao_anos: "1",
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

      await axios.post("http://localhost:8000/api/registrar-prefeitura/", payload);
      setSucesso("Enviamos um e-mail para confirmação. Verifique sua caixa de entrada.");
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
      setSucesso("");
      if (error.response?.data?.detail) {
        const msg = error.response.data.detail;

        if (msg.includes("Enviamos um e-mail para confirmação")) {
          setSucesso(msg);
          setErro("");
        } else {
          setErro(msg);
        }
      } else {
        setErro("Erro ao registrar. Verifique os dados.");
      }
    }
  };

  const planoSelecionado = planos.find(p => String(p.id) === form.plano_id);

  return (
    <div className="h-screen bg-[#e3efcc] flex items-center justify-center p-4 overflow-hidden">
      <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-xl shadow-xl w-full max-w-[900px] transform scale-90"
        >

        <h2 className="text-4xl font-bold text-green-900 mb-6 text-center">Cadastro de Cliente</h2>

        {erro && <p className="text-red-600 font-semibold mb-4 text-center">{erro}</p>}
        {sucesso && <p className="text-green-700 font-semibold mb-4 text-center">{sucesso}</p>}

        <div className="space-y-6">

          {/* Plano e assinatura */}
          <div className="border rounded-xl p-4">
            <h3 className="text-green-800 font-semibold mb-3">Plano e Assinatura</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Plano</label>
                <select
                  name="plano_id"
                  value={form.plano_id}
                  onChange={handleChange}
                  className="w-full border rounded-md px-4 py-2 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  required
                >
                  <option value="">Selecione um Plano</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} - R$ {p.preco_mensal}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Duração (anos)</label>
                <input
                  type="number"
                  name="duracao_anos"
                  value={form.duracao_anos}
                  onChange={handleChange}
                  className="w-full border rounded-md px-4 py-2 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  min={1}
                  placeholder="Ex: 1"
                />
                <small className="text-gray-500">Tempo contratado em anos.</small>
              </div>
            </div>

            {planoSelecionado && (
              <div className="text-sm text-gray-700 mt-4 p-3 bg-gray-100 rounded">
                <p><strong>Descrição:</strong> {planoSelecionado.descricao || "Sem descrição."}</p>
                <p><strong>Valor mensal:</strong> R$ {planoSelecionado.preco_mensal}</p>
                <p><strong>Usuários:</strong> {planoSelecionado.usuarios_min} a {planoSelecionado.usuarios_max}</p>
                <p><strong>Sepultados:</strong> {planoSelecionado.sepultados_max || "Ilimitado"}</p>
                <p><strong>Suporte Prioritário:</strong> {planoSelecionado.inclui_suporte_prioritario ? "Sim" : "Não"}</p>
              </div>
            )}
          </div>

          {/* Informações da prefeitura */}
          <div className="border rounded-xl p-4">
            <h3 className="text-green-800 font-semibold mb-3">Informações</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" name="nome" placeholder="Nome" value={form.nome} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              <input type="text" name="cnpj" placeholder="CNPJ" value={form.cnpj} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              <input type="text" name="responsavel" placeholder="Responsável" value={form.responsavel} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              <input type="text" name="telefone" placeholder="Telefone" value={form.telefone} onChange={handleChange} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          {/* Endereço */}
          <div className="border rounded-xl p-4">
            <h3 className="text-green-800 font-semibold mb-3">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" name="logradouro" placeholder="Rua / Avenida" value={form.logradouro} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              <input type="text" name="endereco_numero" placeholder="Número" value={form.endereco_numero} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              <input type="text" name="endereco_bairro" placeholder="Bairro" value={form.endereco_bairro} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              <input type="text" name="endereco_cidade" placeholder="Cidade" value={form.endereco_cidade} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              <input type="text" name="endereco_estado" placeholder="UF" value={form.endereco_estado} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              <input type="text" name="endereco_cep" placeholder="CEP" value={form.endereco_cep} onChange={handleChange} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          {/* Acesso */}
          <div className="border rounded-xl p-4">
            <h3 className="text-green-800 font-semibold mb-3">Acesso</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Mail className="absolute top-3 left-3 text-gray-500" />
                <input
                  type="email"
                  name="email"
                  placeholder="E-mail"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full border rounded pl-10 pr-3 py-2"
                />
              </div>
              <div className="relative">
                <Lock className="absolute top-3 left-3 text-gray-500" />
                <input
                  type="password"
                  name="senha"
                  placeholder="Senha de acesso"
                  value={form.senha}
                  onChange={handleChange}
                  className="w-full border rounded pl-10 pr-3 py-2"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-4 w-full bg-green-800 text-white py-3 rounded-xl hover:bg-green-700 transition font-semibold text-lg"
          >
            Cadastrar
          </button>
        </div>
      </form>
    </div>
  );
}

export default CadastroPrefeitura;
