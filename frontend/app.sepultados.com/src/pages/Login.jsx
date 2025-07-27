import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './login.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    // Aqui vai a chamada para sua API (JWT)
    // await fazerLogin(email, senha);
    navigate('/'); // Redireciona após login
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
        <Link to="/recuperar-senha" className="link">
          Esqueci minha senha
        </Link>
      </div>
    </div>
  );
}

export default LoginPage;
