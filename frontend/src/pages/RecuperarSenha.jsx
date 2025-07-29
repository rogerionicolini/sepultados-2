import React, { useState } from 'react';
import './login.css';
import axios from 'axios';

function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagem('');
    setErro('');
    setCarregando(true);

    try {
      await axios.post('http://127.0.0.1:8000/api/usuarios/recuperar-senha/', { email });
      setMensagem('Se o e-mail for válido, você receberá instruções.');
    } catch (error) {
      setErro('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Recuperar Senha</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Digite seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={carregando}>
            {carregando ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
        {mensagem && <p className="mensagem-sucesso">{mensagem}</p>}
        {erro && <p className="mensagem-erro">{erro}</p>}
      </div>
    </div>
  );
}

export default RecuperarSenhaPage;
