// src/pages/BackupSistema.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";

const BASE = "http://127.0.0.1:8000";

// tenta extrair nome do arquivo do header
function filenameFromDisposition(h) {
  if (!h) return null;
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(h);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function BackupSistema() {
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState([]);

  const http = useMemo(
    () =>
      axios.create({
        baseURL: BASE,
        withCredentials: true, // envia cookies da sessão/admin
      }),
    []
  );

  function log(msg, kind = "info") {
    setLogs((l) => [{ ts: new Date(), kind, msg }, ...l]);
  }

  async function baixarBackup() {
    setBusy(true);
    log("Iniciando backup…");

    // rotas prováveis para a sua view backup_prefeitura_ativa
    const tries = [
      "/backup/prefeitura_ativa/",
      "/backup/prefeitura-ativa/",
      "/admin/backup/prefeitura_ativa/",
      "/admin/backup/prefeitura-ativa/",
    ];

    for (const url of tries) {
      try {
        const res = await http.get(url, { responseType: "blob" });
        const ct = (res.headers?.["content-type"] || "").toLowerCase();

        // se vier HTML, é a tela do admin (não é o ZIP)
        if (!ct.includes("zip") && !ct.includes("octet-stream")) {
          // tenta próxima
          continue;
        }

        const cd = res.headers?.["content-disposition"] || "";
        const name =
          filenameFromDisposition(cd) ||
          `backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;

        const blob = new Blob([res.data], { type: "application/zip" });
        const urlBlob = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = urlBlob;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(urlBlob), 60000);

        log("Backup gerado e download iniciado.", "ok");
        setBusy(false);
        return;
      } catch (e) {
        // tenta próxima
      }
    }

    log(
      "Não foi possível gerar o backup. Verifique se você está logado no Admin, se há uma prefeitura ativa na sessão e se as rotas estão corretas.",
      "err"
    );
    setBusy(false);
    alert(
      "Falha ao gerar backup. Abra o Admin, confirme a prefeitura ativa e tente novamente."
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-900">Backup do Sistema</h1>
      </div>

      <div className="bg-[#f0f8ea] rounded-xl p-6 shadow space-y-4 border border-[#e0efcf]">
        <p className="text-green-900/85">
          Este backup reúne dados da <strong>prefeitura ativa</strong>: Sepultados,
          Contratos de Concessão, Exumações, Translados, Receitas, Auditoria e
          arquivos de mídia vinculados. O arquivo será baixado em formato{" "}
          <strong>.zip</strong>.
        </p>

        <div className="flex gap-3">
          <button
            onClick={baixarBackup}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[#224c15] text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Gerando..." : "Gerar Backup (ZIP)"}
          </button>
        </div>
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
