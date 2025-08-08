import React, { useEffect, useState } from "react";
import axios from "axios";

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    senha: "",
  });
  const [editandoId, setEditandoId] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (token) {
      fetchUsuarios();
    } else {
      setErro("Token de acesso não encontrado. Faça login novamente.");
    }
  }, [token]);

  const fetchUsuarios = async () => {
    try {
      const response = await axios.get("http://localhost:8000/api/usuarios/lista/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuarios(response.data);
    } catch (error) {
      console.error(error);
      setErro("Erro ao carregar usuários.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagem("");
    setErro("");

    try {
      if (editandoId) {
        await axios.put(
          `http://localhost:8000/api/usuarios/${editandoId}/`,
          {
            first_name: form.first_name,
            last_name: form.last_name,
            // email não enviado
            // senha não enviada
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setMensagem("Usuário atualizado com sucesso.");
      } else {
        await axios.post(
          "http://localhost:8000/api/usuarios/",
          {
            email: form.email,
            senha: form.senha,
            first_name: form.first_name,
            last_name: form.last_name,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setMensagem("Usuário adicionado com sucesso. Um e-mail de confirmação foi enviado.");
      }
      setForm({ first_name: "", last_name: "", email: "", senha: "" });
      setEditandoId(null);
      fetchUsuarios();
    } catch (error) {
      if (error.response?.data) {
        const erroData = error.response.data;
        if (typeof erroData === "string") {
          setErro(erroData);
        } else if (erroData.detail) {
          setErro(erroData.detail);
        } else if (erroData.email) {
          setErro("E-mail já cadastrado.");
        } else {
          const mensagens = Object.values(erroData).flat().join(" ");
          setErro(mensagens || "Erro ao adicionar/editar usuário.");
        }
      } else {
        setErro("Erro ao adicionar/editar usuário.");
      }
    }
  };

  const handleEditar = (usuario) => {
    setForm({
      first_name: usuario.first_name,
      last_name: usuario.last_name,
      email: usuario.email,
      senha: "",
    });
    setEditandoId(usuario.id);
    setMensagem("");
    setErro("");
  };

  const handleExcluir = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) return;
    try {
      await axios.delete(`http://localhost:8000/api/usuarios/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMensagem("Usuário excluído com sucesso.");
      fetchUsuarios();
    } catch (error) {
      setErro("Erro ao excluir usuário.");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-green-900 mb-6">Usuários</h1>

      {mensagem && <p className="text-green-700 mb-4">{mensagem}</p>}
      {erro && <p className="text-red-600 mb-4">{erro}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            name="first_name"
            placeholder="Nome"
            value={form.first_name}
            onChange={handleChange}
            required
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
          <input
            type="text"
            name="last_name"
            placeholder="Sobrenome"
            value={form.last_name}
            onChange={handleChange}
            required
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
          <input
            type="email"
            name="email"
            placeholder="E-mail"
            value={form.email}
            onChange={handleChange}
            required={!editandoId}
            disabled={!!editandoId}
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
          <input
            type="password"
            name="senha"
            placeholder="Senha"
            value={form.senha}
            onChange={handleChange}
            required={!editandoId}
            disabled={!!editandoId}
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
        </div>
        <button
          type="submit"
          className="mt-4 bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800"
        >
          {editandoId ? "Salvar Alterações" : "Adicionar Usuário"}
        </button>
        {editandoId && (
          <button
            type="button"
            onClick={() => {
              setForm({ first_name: "", last_name: "", email: "", senha: "" });
              setEditandoId(null);
            }}
            className="ml-4 mt-4 bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
          >
            Cancelar Edição
          </button>
        )}
      </form>

      <h2 className="text-xl font-semibold mb-2">Lista de Usuários</h2>
      <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left px-4 py-2">Nome</th>
            <th className="text-left px-4 py-2">E-mail</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Tipo</th>
            <th className="text-left px-4 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="border-t">
              <td className="px-4 py-2">{usuario.first_name} {usuario.last_name}</td>
              <td className="px-4 py-2">{usuario.email}</td>
              <td className="px-4 py-2">{usuario.is_active ? "Ativo" : "Inativo"}</td>
              <td className="px-4 py-2">{usuario.tipo}</td>
              <td className="px-4 py-2 space-x-2">
                <button
                  onClick={() => handleEditar(usuario)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleExcluir(usuario.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Usuarios;
