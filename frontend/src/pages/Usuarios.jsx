import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000/api";

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    senha: "",
    // UI decide o papel; backend recebe is_master (bool)
    role: "normal", // "normal" | "master"
  });

  const token = localStorage.getItem("accessToken");
  const api = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  useEffect(() => {
    if (!token) {
      setErro("Token de acesso não encontrado. Faça login novamente.");
      return;
    }
    fetchUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function fetchUsuarios() {
    try {
      const res = await api.get("/usuarios/lista/");
      setUsuarios(res.data || []);
    } catch (e) {
      setErro("Erro ao carregar usuários.");
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem("");
    setErro("");

    try {
      if (editandoId) {
        // edição básica: nome/sobrenome
        await api.put(`/usuarios/${editandoId}/`, {
          first_name: form.first_name,
          last_name: form.last_name,
        });
        setMensagem("Usuário atualizado com sucesso.");
      } else {
        // criação: envia is_master conforme escolha do select
        await api.post("/usuarios/", {
          email: form.email,
          senha: form.senha,
          first_name: form.first_name,
          last_name: form.last_name,
          is_master: form.role === "master",
        });
        setMensagem(
          "Usuário adicionado com sucesso. Um e-mail de confirmação foi enviado."
        );
      }

      setForm({
        first_name: "",
        last_name: "",
        email: "",
        senha: "",
        role: "normal",
      });
      setEditandoId(null);
      fetchUsuarios();
    } catch (error) {
      const d = error.response?.data;
      const msg =
        typeof d === "string"
          ? d
          : d?.detail ||
            d?.erro ||
            d?.non_field_errors?.join?.(" ") ||
            d?.email?.join?.(" ") ||
            (d ? Object.values(d).flat().join(" ") : null) ||
            "Erro ao adicionar/editar usuário.";
      setErro(msg);
    }
  }

  function handleEditar(usuario) {
    setForm({
      first_name: usuario.first_name || "",
      last_name: usuario.last_name || "",
      email: usuario.email || "",
      senha: "",
      role: "normal", // papel não muda na edição
    });
    setEditandoId(usuario.id);
    setMensagem("");
    setErro("");
  }

  async function handleExcluir(id) {
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) return;
    try {
      await api.delete(`/usuarios/${id}/`);
      setMensagem("Usuário excluído com sucesso.");
      fetchUsuarios();
    } catch (error) {
      const d = error.response?.data;
      setErro(d?.detail || d?.erro || "Erro ao excluir usuário.");
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-green-900 mb-6">Usuários</h1>

      {mensagem && <p className="text-green-700 mb-4">{mensagem}</p>}
      {erro && <p className="text-red-600 mb-4">{erro}</p>}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow mb-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

          {/* Tipo do usuário (somente na criação) */}
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            disabled={!!editandoId}
            className="border border-gray-300 rounded px-3 py-2 w-full"
            title="Escolha Master para criar um administrador (se permitido pela sua permissão)"
          >
            <option value="normal">Normal</option>
            <option value="master">Master</option>
          </select>
        </div>

        <div>
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
                setForm({
                  first_name: "",
                  last_name: "",
                  email: "",
                  senha: "",
                  role: "normal",
                });
                setEditandoId(null);
              }}
              className="ml-4 mt-4 bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
            >
              Cancelar Edição
            </button>
          )}
        </div>
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
          {usuarios.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="px-4 py-2">
                {u.first_name} {u.last_name}
              </td>
              <td className="px-4 py-2">{u.email}</td>
              <td className="px-4 py-2">{u.is_active ? "Ativo" : "Inativo"}</td>
              <td className="px-4 py-2">{u.tipo}</td>
              <td className="px-4 py-2 space-x-2">
                <button
                  onClick={() => handleEditar(u)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleExcluir(u.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
          {usuarios.length === 0 && (
            <tr>
              <td className="px-4 py-4 text-gray-500" colSpan={5}>
                Nenhum usuário encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
