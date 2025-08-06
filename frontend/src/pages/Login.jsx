import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './login.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');

    try {
      // Obter tokens
      const response = await axios.post('http://127.0.0.1:8000/api/token/', {
        email,
        password: senha,
      });

      const accessToken = response.data.access;
      const refreshToken = response.data.refresh;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Buscar dados do usuário e prefeitura
      const userRes = await axios.get("http://127.0.0.1:8000/api/usuario-logado/", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const prefeituraId = userRes.data.prefeitura?.id;

      if (prefeituraId) {
        localStorage.setItem("prefeitura_ativa_id", prefeituraId);
        navigate("/");
      } else {
        setErro("Prefeitura não encontrada para este usuário.");
      }
    } catch (error) {
      setErro("E-mail ou senha inválidos.");
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
          <button type="submit">Entrar</button>
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
