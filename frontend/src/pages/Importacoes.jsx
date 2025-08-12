// src/pages/Importacoes.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";

const BASE = "http://127.0.0.1:8000";

function getCSRFCookie() {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

const Card = ({ title, children }) => (
  <div className="bg-[#f0f8ea] rounded-xl p-5 shadow space-y-4 border border-[#e0efcf]">
    <div className="text-lg font-semibold text-green-900">{title}</div>
    {children}
  </div>
);

// Tenta extrair as mensagens do Django do HTML retornado
function parseDjangoMessages(htmlText) {
  try {
    const div = document.createElement("div");
    div.innerHTML = htmlText;
    // pega textos visíveis
    const text = div.textContent || "";
    // heurística: tenta achar “X ... importad”
    const m = text.match(/(\d+).{0,40}importad/gi);
    if (m && m.length) return m.join(" • ");
    // caso contrário, devolve um trecho curto do texto
    return text.trim().slice(0, 300);
  } catch {
    return "";
  }
}

export default function Importacoes() {
  const [busy, setBusy] = useState({});
  const [files, setFiles] = useState({});
  const [logs, setLogs] = useState([]);

  const http = useMemo(
    () =>
      axios.create({
        baseURL: BASE,
        withCredentials: true, // manda cookies da sessão admin
        headers: {
          "X-CSRFToken": getCSRFCookie(),
        },
        // para POST multipart, axios define o Content-Type automaticamente
      }),
    []
  );

  function log(msg, kind = "info") {
    setLogs((l) => [{ ts: new Date(), kind, msg }, ...l]);
  }

  async function importar(tipo) {
    const file = files[tipo];
    if (!file) {
      alert("Selecione um arquivo primeiro.");
      return;
    }
    setBusy((b) => ({ ...b, [tipo]: true }));
    try {
      const form = new FormData();
      form.append("arquivo", file); // as suas views esperam 'arquivo'
      const url = `/importar/${tipo}/`;

      const res = await http.post(url, form, {
        responseType: "text", // suas views devolvem HTML
      });

      const text = typeof res.data === "string" ? res.data : "";
      const resumo = parseDjangoMessages(text);
      log(`✅ Importação de ${tipo} concluída. ${resumo || ""}`, "ok");
      alert("Importação enviada. Veja as mensagens no quadro abaixo.");
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Erro ao importar. Verifique se está logado no Admin e se o CSRF está válido.";
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

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-900">Importações</h1>
        <div className="text-sm text-green-900/80">
          Formatos aceitos: <strong>.csv, .xls, .xlsx</strong>
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
              href={`${BASE}/media/planilhas/Planilha de Quadras.xlsx`}
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
              disabled={busy.quadras}
              className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy.quadras ? "Importando…" : "Importar Quadras"}
            </button>
          </div>
        </Card>

        {/* Túmulos */}
        <Card title="Túmulos">
          <p className="text-sm text-green-900/80">
            Colunas: <code>quadra_codigo</code>, <code>identificador</code>, <code>tipo_estrutura</code>,{" "}
            <code>capacidade</code>, <code>usar_linha</code>, <code>linha</code>
          </p>
          <div className="flex gap-2">
            <a
              href={`${BASE}/media/planilhas/Planilha de Tumulos.xlsx`}
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
              disabled={busy.tumulos}
              className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy.tumulos ? "Importando…" : "Importar Túmulos"}
            </button>
          </div>
        </Card>

        {/* Sepultados */}
        <Card title="Sepultados">
          <p className="text-sm text-green-900/80">
            Colunas (principais): <code>identificador_tumulo</code>, <code>quadra</code>, <code>usar_linha</code>,{" "}
            <code>linha</code>, e dados do falecido.
          </p>
          <div className="flex gap-2">
            <a
              href={`${BASE}/media/planilhas/Planilha de Sepultados.xlsx`}
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
              disabled={busy.sepultados}
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
