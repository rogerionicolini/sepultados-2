// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './login.css'; // ✅ estava ../login.css e quebrou

import { api, setTokens } from '../api/api';
import { scheduleProactiveRefresh } from '../auth/authTimer';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      // 1) tokens (ajuste p/ username se seu backend usar isso)
      const { data } = await api.post('/token/', {
        email,
        password: senha,
      });
      const { access, refresh } = data;

      // 2) salva (novo + legacy)
      setTokens({ access, refresh });

      // 3) agenda refresh proativo
      scheduleProactiveRefresh();

      // 4) busca usuário
      const userRes = await api.get('/usuario-logado/');
      const usuario = userRes.data;

      // espelha p/ header/legados
      localStorage.setItem('usuario_logado', JSON.stringify(usuario));
      if (usuario?.email) localStorage.setItem('email_usuario', usuario.email);
      if (usuario?.nome)  localStorage.setItem('nome_usuario', usuario.nome);

      const prefeituraId = usuario?.prefeitura?.id;
      if (prefeituraId) {
        localStorage.setItem('prefeitura_ativa_id', prefeituraId);
        if (usuario.prefeitura?.nome)       localStorage.setItem('prefeitura_nome', usuario.prefeitura.nome);
        if (usuario.prefeitura?.brasao_url) localStorage.setItem('prefeitura_brasao_url', usuario.prefeitura.brasao_url);
        navigate('/');
      } else {
        setErro('Prefeitura não encontrada para este usuário.');
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'E-mail ou senha inválidos.';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {erro && <p style={{ color: 'red', marginTop: '10px' }}>{erro}</p>}

        <Link to="/recuperar-senha" className="link">
          Esqueci minha senha
        </Link>
      </div>
    </div>
  );
}

export default LoginPage;
