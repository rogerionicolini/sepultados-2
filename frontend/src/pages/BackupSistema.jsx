// src/pages/BackupSistema.jsx
import React, { useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("accessToken") || "";
}
function getPrefeituraAtivaId() {
  try {
    const raw = localStorage.getItem("prefeituraAtiva");
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.id) return Number(o.id);
    }
  } catch {}
  const id = localStorage.getItem("prefeituraAtivaId");
  return id ? Number(id) : null;
}

export default function BackupSistema() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function gerar() {
    const token = getToken();
    if (!token) {
      alert("Sem token. Faça login no app primeiro.");
      return;
    }
    setBusy(true);
    setMsg("Iniciando backup...");

    const prefId = getPrefeituraAtivaId();
    const qs = new URLSearchParams({ ts: String(Date.now()) });
    if (prefId) qs.set("prefeitura", String(prefId));

    try {
      const res = await fetch(`${API_BASE}/api/backup/prefeitura/?${qs}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_prefeitura_${prefId ?? "ativa"}_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Backup gerado e download iniciado.");
    } catch (e) {
      setMsg(`Erro: ${e.message}`);
      alert("Falha ao gerar backup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="bg-[#f0f8ea] rounded-xl p-5 shadow border border-[#e0efcf]">
        <button
          onClick={gerar}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-[#224c15] text-white disabled:opacity-60"
        >
          {busy ? "Gerando..." : "Gerar Backup (ZIP)"}
        </button>
        <div className="mt-3 text-sm text-green-900">{msg || " "}</div>
      </div>
    </div>
  );
}
