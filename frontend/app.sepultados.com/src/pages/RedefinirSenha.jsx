import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './login.css';

function RedefinirSenhaPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [novaSenha, setNovaSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagem('');
    setErro('');
    setCarregando(true);

    try {
      await axios.post(`http://127.0.0.1:8000/api/usuarios/redefinir-senha/${uid}/${token}/`, {
        nova_senha: novaSenha,
      });

      setMensagem('Senha redefinida com sucesso! Redirecionando...');
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      if (err.response?.data?.erro) {
        setErro(err.response.data.erro);
      } else {
        setErro('Erro ao redefinir a senha.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Redefinir Senha</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Digite a nova senha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
          />
          <button type="submit" disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </form>
        {mensagem && <p className="mensagem-sucesso">{mensagem}</p>}
        {erro && <p className="mensagem-erro">{erro}</p>}
      </div>
    </div>
  );
}

export default RedefinirSenhaPage;
