// Projeto/frontend/src/components/CemeterySelector.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/";
const ENDPOINT = "cemiterios/";

export default function CemeterySelector({ onSelected }) {
  const [open, setOpen] = useState(false);
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  const [ativoId, setAtivoId] = useState(
    () => localStorage.getItem("cemiterioAtivoId") || null
  );
  const [ativoNome, setAtivoNome] = useState(
    () => localStorage.getItem("cemiterioAtivoNome") || "Cemitério"
  );

  const token = localStorage.getItem("accessToken");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  // ---- helper: sincroniza sessão do backend com o cemitério escolhido ----
  async function syncSessaoBackend(cemiterioId) {
    if (!cemiterioId) return;
    try {
      await api.post("selecionar-cemiterio/", { cemiterio_id: Number(cemiterioId) });
    } catch (e) {
      console.error(
        "Falha ao sincronizar cemitério na sessão do backend:",
        e?.response?.data || e
      );
    }
  }

  // Carrega a lista de cemitérios (com fallbacks de filtro)
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);

        // tenta descobrir a prefeitura do usuário (opcional, só para fallback)
        let prefId = null;
        try {
          const a = await api.get("prefeitura-logada/");
          prefId = a.data?.id || a.data?.prefeitura?.id || null;
        } catch {}
        if (!prefId) {
          try {
            const b = await api.get("usuario-logado/");
            prefId = b.data?.prefeitura?.id || null;
          } catch {}
        }

        // 1) Tenta SEM filtro (se o backend já usa prefeitura/cemitério da sessão)
        let res = await api.get(ENDPOINT);
        let data = Array.isArray(res.data) ? res.data : res.data?.results || [];

        // 2) Se vier vazio, tenta com ?prefeitura=
        if ((!data || data.length === 0) && prefId) {
          res = await api.get(`${ENDPOINT}?prefeitura=${prefId}`);
          data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        }

        // 3) Se ainda vazio, tenta com ?prefeitura_id=
        if ((!data || data.length === 0) && prefId) {
          res = await api.get(`${ENDPOINT}?prefeitura_id=${prefId}`);
          data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        }

        setLista(data);

        // se tem ativo salvo, tente achar o nome certo e reconfirmar sessão
        if (ativoId) {
          const achado = data.find((c) => String(c.id) === String(ativoId));
          if (achado) {
            if (!ativoNome || ativoNome === "Cemitério") setAtivoNome(achado.nome);
            // Garante que a sessão do backend está alinhada após refresh
            syncSessaoBackend(achado.id);
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

  async function escolher(cem) {
    // 1) Persistência local (duplo formato para compatibilidade)
    localStorage.setItem("cemiterioAtivoId", String(cem.id));
    localStorage.setItem("cemiterioAtivoNome", cem.nome);
    localStorage.setItem(
      "cemiterioAtivo",
      JSON.stringify({ id: Number(cem.id), nome: cem.nome })
    );

    // 2) Estado do componente
    setAtivoId(String(cem.id));
    setAtivoNome(cem.nome);
    setOpen(false);

    // 3) Sessão no backend (DRF vai herdar automaticamente)
    await syncSessaoBackend(cem.id);

    // 4) Callback e broadcast (outras telas podem ouvir e recarregar)
    onSelected?.(cem);
    window.dispatchEvent(new CustomEvent("cemiterio:changed", { detail: cem }));
    // Se preferir forçar reload da página atual:
    // window.location.reload();
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

  return (
    <div ref={wrapRef} className="relative inline-block">
      {/* Botão principal no header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-w-[260px] sm:min-w-[300px] px-3 py-2 rounded-lg bg-white border border-[#bcd2a7] text-green-900 font-medium shadow hover:bg-[#f7fbf2] flex items-center justify-between"
        style={{ height: 40 }}
      >
        <span className="truncate">{ativoNome || "Cemitério"}</span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown (exatamente abaixo do botão) */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-[#e0efcf] z-[9999]">
          {/* Campo de busca */}
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
              filtrados.map((c) => (
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
                      String(ativoId) === String(c.id)
                        ? "border-[#224c15] text-white bg-[#224c15]"
                        : "border-[#bcd2a7] text-green-900 bg-white hover:bg-[#f7fbf2]"
                    }`}
                  >
                    {String(ativoId) === String(c.id) ? "Selecionado" : "Selecionar"}
                  </button>
                </div>
              ))}

            {!loading && filtrados.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-600">
                Nenhum cemitério encontrado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
