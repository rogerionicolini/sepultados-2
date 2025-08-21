// src/pages/BackupSistema.jsx
import React, { useState } from "react";

const BASE = "http://127.0.0.1:8000";

export default function BackupSistema() {
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState([]);

  function log(msg, kind = "info") {
    setLogs((l) => [{ ts: new Date(), kind, msg }, ...l]);
  }

  function baixarBackup() {
    try {
      setBusy(true);
      log("Iniciando backup...");

      // ROTA CERTA do seu urls.py:
      const url = `${BASE}/backup/prefeitura/?ts=${Date.now()}`;

      // navega para a rota (o download começa pelo próprio Django)
      window.location.assign(url);

      log("Backup disparado. (Se não iniciou o download, confira se está logado no Admin e se a prefeitura ativa está definida.)", "ok");
    } catch (e) {
      log(`Falha ao iniciar backup: ${e?.message || e}`, "err");
      alert("Falha ao gerar backup. Veja os logs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="bg-[#f0f8ea] rounded-xl p-5 shadow border border-[#e0efcf]">
        <p className="text-green-900/90 mb-3">
          Este backup reúne dados da <b>prefeitura ativa</b> e baixa um .zip.
        </p>
        <button
          onClick={baixarBackup}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-[#224c15] text-white disabled:opacity-60"
        >
          {busy ? "Gerando..." : "Gerar Backup (ZIP)"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#e0efcf] p-4 shadow">
        <div className="text-sm font-semibold text-green-900 mb-2">Mensagens</div>
        <ul className="space-y-1 text-sm max-h-64 overflow-auto">
          {logs.map((l, i) => (
            <li key={i} className={l.kind === "ok" ? "text-green-800" : l.kind === "err" ? "text-red-700" : "text-gray-700"}>
              [{new Date(l.ts).toLocaleTimeString()}] {l.msg}
            </li>
          ))}
          {logs.length === 0 && <li className="text-gray-500">Nada ainda.</li>}
        </ul>
      </div>
    </div>
  );
}
