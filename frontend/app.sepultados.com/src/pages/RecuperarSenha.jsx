import React, { useState } from 'react';
import './login.css';

function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aqui você poderá fazer a integração futura com o backend (email)
    alert('Se o e-mail for válido, você receberá instruções.');
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
          <button type="submit">Enviar</button>
        </form>
      </div>
    </div>
  );
}

export default RecuperarSenhaPage;
