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
      const response = await axios.post('http://127.0.0.1:8000/api/token/', {
        email,
        password: senha,
      });

      localStorage.setItem('accessToken', response.data.access);
      localStorage.setItem('refreshToken', response.data.refresh);

      navigate('/dashboard'); // Altere se o destino for outro
    } catch (error) {
      setErro('E-mail ou senha inválidos.');
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
