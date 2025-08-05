import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

function VerificarEmail() {
  const { token } = useParams();
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState('aguardando'); // aguardando, sucesso, erro

  useEffect(() => {
    async function verificar() {
      try {
        const response = await axios.get(`http://localhost:8000/api/verificar-email/${token}/`);
        setMensagem(response.data.detail);
        setStatus('sucesso');
      } catch (error) {
        const msg = error.response?.data?.detail || 'Erro ao verificar e-mail.';
        setMensagem(msg);
        setStatus('erro');
      }
    }

    verificar();
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#e3efcc] px-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-green-900">
          {status === 'sucesso' ? '✅ E-mail confirmado' : '🔐 Verificando e-mail...'}
        </h1>
        <p className="text-gray-700">{mensagem}</p>
      </div>
    </div>
  );
}

export default VerificarEmail;
