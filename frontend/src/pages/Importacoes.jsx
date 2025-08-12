// src/pages/Importacoes.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const ADMIN_BASE = "http://127.0.0.1:8000";       // arquivos modelo (.xlsx)
const API_BASE   = "http://127.0.0.1:8000/api";  // endpoints REST

function getCSRFCookie() {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// Lê o cemitério ativo do localStorage (suporta dois formatos já usados)
function readCemiterioAtivo() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.id) return { id: Number(o.id), nome: o.nome || `Cemitério ${o.id}` };
    }
  } catch {}
  const id = localStorage.getItem("cemiterioAtivoId");
  const nome = localStorage.getItem("cemiterioAtivoNome");
  return id ? { id: Number(id), nome: nome || `Cemitério ${id}` } : null;
}

const Card = ({ title, children }) => (
  <div className="bg-[#f0f8ea] rounded-xl p-5 shadow space-y-4 border border-[#e0efcf]">
    <div className="text-lg font-semibold text-green-900">{title}</div>
    {children}
  </div>
);

export default function Importacoes() {
  const [busy, setBusy] = useState({});
  const [files, setFiles] = useState({});
  const [logs, setLogs] = useState([]);
  const [cem, setCem] = useState(() => readCemiterioAtivo());

  // mantém badge do cemitério em sincronia com outras abas
  useEffect(() => {
    const onStorage = () => setCem(readCemiterioAtivo());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Garante cookie de CSRF quando NÃO usamos JWT
  useEffect(() => {
    const token = localStorage.getItem("accessToken") || "";
    if (token) return; // com JWT não precisamos do cookie
    // teu projeto expõe /api/csrf/ (em alguns commits também /api/api/csrf/)
    const tryFetch = async () => {
      try { await fetch(`${API_BASE}/csrf/`, { credentials: "include" }); }
      catch {
        // fallback caso a rota tenha sido registrada como "api/csrf/" dentro de /api/
        try { await fetch(`${API_BASE}/api/csrf/`, { credentials: "include" }); } catch {}
      }
    };
    tryFetch();
  }, []);

  // axios: usa JWT se existir; senão, sessão+CSRF
  const api = useMemo(() => {
    const token = localStorage.getItem("accessToken") || "";
    const headers = {};
    let withCredentials = false;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      withCredentials = true;
      headers["X-CSRFToken"] = getCSRFCookie();
    }
    return axios.create({ baseURL: API_BASE, withCredentials, headers });
  }, []);

  function log(msg, kind = "info") {
    setLogs((l) => [{ ts: new Date(), kind, msg }, ...l]);
  }

  async function importar(tipo) {
    if (!cem?.id) {
      alert("Selecione um cemitério ativo no topo da tela antes de importar.");
      return;
    }
    const file = files[tipo];
    if (!file) {
      alert("Selecione um arquivo primeiro.");
      return;
    }

    setBusy((b) => ({ ...b, [tipo]: true }));
    try {
      const form = new FormData();
      form.append("arquivo", file);

      // Sempre força o cemitério na query (as views também aceitam sessão)
      const params = { cemiterio: cem.id };

      // Você tem as duas rotas no backend: /api/importacoes/<tipo>/ e os ALIASES /api/importar/<tipo>/
      // Vamos usar os aliases que você habilitou para o front:
      //   importar/quadras | importar/tumulos | importar/sepultados
      const url = `/importar/${tipo}/`; // OK conforme urls_api.py (aliases). :contentReference[oaicite:2]{index=2}

      const res = await api.post(url, form, { params });
      const okMsg =
        typeof res.data === "object" ? JSON.stringify(res.data) : (res.data || "OK");
      log(`✅ Importação de ${tipo} concluída. ${okMsg}`, "ok");
      alert("Importação enviada. Veja as mensagens no quadro abaixo.");
    } catch (e) {
      const status = e?.response?.status;
      let detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Erro ao importar. Verifique login, permissões e CSRF/CORS.";

      if (status === 401) {
        detail = "Não autenticado (401). Faça login e gere um novo token.";
      } else if (status === 403) {
        detail = "Acesso negado (403). Se estiver sem JWT, confira o cookie de CSRF e o domínio.";
      } else if (status === 404) {
        detail = "Endpoint não encontrado (404). Confira a rota no backend.";
      }
      log(`❌ Erro ao importar ${tipo}: ${detail}`, "err");
      alert(detail);
    } finally {
      setBusy((b) => ({ ...b, [tipo]: false }));
    }
  }

  const inputFile = (tipo) => (
    <input
      type="file"
      accept=".csv,.xls,.xlsx"
      onChange={(e) => setFiles((f) => ({ ...f, [tipo]: e.target.files?.[0] || null }))}
      className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#e6f3d7] file:text-green-900 hover:file:bg-[#d9ebc2] border border-[#bcd2a7] rounded-lg p-1 bg-white"
    />
  );

  const disabledWithoutCem = !cem?.id;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-900">Importações</h1>

        <div className="flex items-center gap-3">
          <div className="text-sm text-green-900/80">
            Formatos aceitos: <strong>.csv, .xls, .xlsx</strong>
          </div>
          <span
            className={
              "text-xs px-3 py-1 rounded-full border " +
              (cem?.id
                ? "bg-[#e6f3d7] border-[#bcd2a7] text-green-900"
                : "bg-red-50 border-red-200 text-red-700")
            }
            title={cem?.id ? `ID: ${cem.id}` : "Nenhum cemitério selecionado"}
          >
            {cem?.id ? `Cemitério ativo: ${cem.nome}` : "Sem cemitério ativo"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quadras */}
        <Card title="Quadras">
          <p className="text-sm text-green-900/80">
            Colunas esperadas (exemplo): <code>codigo</code>
          </p>
          <div className="flex gap-2">
            <a
              href={`${ADMIN_BASE}/media/planilhas/Planilha de Quadras.xlsx`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
            >
              Baixar modelo (.xlsx)
            </a>
          </div>
          <div className="mt-3 space-y-2">
            {inputFile("quadras")}
            <button
              onClick={() => importar("quadras")}
              disabled={busy.quadras || disabledWithoutCem}
              className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy.quadras ? "Importando…" : "Importar Quadras"}
            </button>
          </div>
        </Card>

        {/* Túmulos */}
        <Card title="Túmulos">
          <p className="text-sm text-green-900/80">
            Colunas: <code>quadra_codigo</code>, <code>identificador</code>,{" "}
            <code>tipo_estrutura</code>, <code>capacidade</code>,{" "}
            <code>usar_linha</code>, <code>linha</code>
          </p>
          <div className="flex gap-2">
            <a
              href={`${ADMIN_BASE}/media/planilhas/Planilha de Tumulos.xlsx`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
            >
              Baixar modelo (.xlsx)
            </a>
          </div>
          <div className="mt-3 space-y-2">
            {inputFile("tumulos")}
            <button
              onClick={() => importar("tumulos")}
              disabled={busy.tumulos || disabledWithoutCem}
              className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy.tumulos ? "Importando…" : "Importar Túmulos"}
            </button>
          </div>
        </Card>

        {/* Sepultados */}
        <Card title="Sepultados">
          <p className="text-sm text-green-900/80">
            Colunas (principais): <code>identificador_tumulo</code>,{" "}
            <code>quadra</code>, <code>usar_linha</code>, <code>linha</code>, e dados do falecido.
          </p>
          <div className="flex gap-2">
            <a
              href={`${ADMIN_BASE}/media/planilhas/Planilha de Sepultados.xlsx`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
            >
              Baixar modelo (.xlsx)
            </a>
          </div>
          <div className="mt-3 space-y-2">
            {inputFile("sepultados")}
            <button
              onClick={() => importar("sepultados")}
              disabled={busy.sepultados || disabledWithoutCem}
              className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy.sepultados ? "Importando…" : "Importar Sepultados"}
            </button>
          </div>
        </Card>
      </div>

      {/* Logs */}
      <div className="bg-white rounded-xl border border-[#e0efcf] p-4 shadow">
        <div className="text-sm font-semibold text-green-900 mb-2">Mensagens</div>
        <ul className="space-y-1 text-sm max-h-64 overflow-auto">
          {logs.map((l, i) => (
            <li
              key={i}
              className={
                l.kind === "ok"
                  ? "text-green-800"
                  : l.kind === "err"
                  ? "text-red-700"
                  : "text-gray-700"
              }
            >
              [{new Date(l.ts).toLocaleTimeString()}] {l.msg}
            </li>
          ))}
          {logs.length === 0 && <li className="text-gray-500">Nada ainda.</li>}
        </ul>
      </div>
    </div>
  );
}
