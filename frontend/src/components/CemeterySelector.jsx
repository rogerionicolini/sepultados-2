// src/components/CemeterySelector.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  getCemiterioAtivo,
  setCemiterioAtivo,
  ensureValidCemiterio,
  clearCemiterioAtivo,
} from "../utils/cemiterioStorage";

const API_BASE = "http://127.0.0.1:8000/api/";
const ENDPOINT = "cemiterios/";

export default function CemeterySelector({ onSelected }) {
  const [open, setOpen] = useState(false);
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  const [ativo, setAtivo] = useState(getCemiterioAtivo());

  const token = localStorage.getItem("accessToken");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  async function syncSessaoBackend(cemiterioId) {
    if (!cemiterioId) return;
    try {
      await api.post("selecionar-cemiterio/", { cemiterio_id: Number(cemiterioId) });
    } catch (e) {
      console.error("Falha ao sincronizar cemitério na sessão do backend:", e?.response?.data || e);
    }
  }

  async function obterPrefeituraId() {
    try {
      const a = await api.get("prefeitura-logada/");
      return a.data?.id || a.data?.prefeitura?.id || null;
    } catch {}
    try {
      const b = await api.get("usuario-logado/");
      return b.data?.prefeitura?.id || null;
    } catch {}
    return null;
  }

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const prefId = await obterPrefeituraId();

        // invalida ativo se não pertencer à prefeitura
        const valido = ensureValidCemiterio(prefId);
        if (!valido) setAtivo(null);

        const url = prefId ? `${ENDPOINT}?prefeitura=${prefId}` : ENDPOINT;
        const res = await api.get(url);
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setLista(data);

        if (valido) {
          const achado = data.find((c) => String(c.id) === String(valido.id));
          if (achado) {
            const payload = {
              id: achado.id,
              nome: achado.nome || achado.codigo || "Cemitério",
              prefeitura_id: achado.prefeitura_id || achado.prefeitura?.id || prefId,
            };
            setCemiterioAtivo(payload);
            setAtivo(payload);
            await syncSessaoBackend(payload.id);
          } else {
            clearCemiterioAtivo();
            setAtivo(null);
          }
        }
      } catch (e) {
        console.error("Erro ao listar cemitérios:", e?.response?.data || e);
        setLista([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((c) => {
      const t1 = (c.nome || "").toLowerCase();
      const t2 = (c.cidade || "").toLowerCase();
      const t3 = (c.estado || "").toLowerCase();
      return t1.includes(q) || t2.includes(q) || t3.includes(q);
    });
  }, [lista, busca]);

  async function escolher(c) {
    const payload = {
      id: Number(c.id),
      nome: c.nome || c.codigo || "Cemitério",
      prefeitura_id: Number(c.prefeitura_id || c.prefeitura?.id),
    };

    setCemiterioAtivo(payload); // salva + dispara evento
    setAtivo(payload);
    setOpen(false);

    await syncSessaoBackend(payload.id);
    onSelected?.(payload);
  }

  // fecha dropdown ao clicar fora
  const wrapRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const titulo = ativo?.nome || "Cemitério";

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-w-[260px] sm:min-w-[300px] px-3 py-2 rounded-lg bg-white border border-[#bcd2a7] text-green-900 font-medium shadow hover:bg-[#f7fbf2] flex items-center justify-between"
        style={{ height: 40 }}
      >
        <span className="truncate">{titulo}</span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-[#e0efcf] z-[9999]">
          <div className="p-2 border-b border-[#e6f2d9]">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, cidade, UF…"
              className="w-full px-3 py-2 rounded-lg border border-[#bcd2a7] outline-none"
            />
          </div>

          <div className="max-h-[340px] overflow-auto">
            {loading && <div className="px-3 py-3 text-sm text-gray-600">Carregando…</div>}

            {!loading &&
              filtrados.map((c) => {
                const selecionado = ativo && String(ativo.id) === String(c.id);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-[#f8fcf2] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-green-900 font-medium truncate">{c.nome}</div>
                      <div className="text-xs text-gray-600 truncate">
                        {c.cidade || "-"} — {c.estado || "-"}
                      </div>
                    </div>
                    <button
                      onClick={() => escolher(c)}
                      className={`px-3 py-1 rounded border text-sm ${
                        selecionado
                          ? "border-[#224c15] text-white bg-[#224c15]"
                          : "border-[#bcd2a7] text-green-900 bg-white hover:bg-[#f7fbf2]"
                      }`}
                    >
                      {selecionado ? "Selecionado" : "Selecionar"}
                    </button>
                  </div>
                );
              })}

            {!loading && filtrados.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-600">Nenhum cemitério encontrado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
