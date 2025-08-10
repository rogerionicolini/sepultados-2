// src/utils/cemiterioStorage.js

// Lê o cemitério ativo do localStorage (compatível com chaves antigas)
export function getCemiterioAtivo() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.id) {
        return {
          id: Number(o.id),
          nome: o.nome || "Cemitério",
          prefeitura_id: o.prefeitura_id ?? o.prefeituraId ?? null,
        };
      }
    }
  } catch {}
  const id = localStorage.getItem("cemiterioAtivoId");
  const nome = localStorage.getItem("cemiterioAtivoNome");
  if (id) return { id: Number(id), nome: nome || "Cemitério", prefeitura_id: null };
  return null;
}

export function setCemiterioAtivo({ id, nome, prefeitura_id }) {
  const payload = { id: Number(id), nome, prefeitura_id: prefeitura_id ?? null };
  localStorage.setItem("cemiterioAtivo", JSON.stringify(payload));
  // compatibilidade temporária
  localStorage.setItem("cemiterioAtivoId", String(id));
  localStorage.setItem("cemiterioAtivoNome", nome);
  // avisa as telas
  window.dispatchEvent(new CustomEvent("cemiterio:changed", { detail: payload }));
}

export function clearCemiterioAtivo() {
  localStorage.removeItem("cemiterioAtivo");
  localStorage.removeItem("cemiterioAtivoId");
  localStorage.removeItem("cemiterioAtivoNome");
  window.dispatchEvent(new CustomEvent("cemiterio:changed", { detail: null }));
}

/**
 * Garante que o cemitério salvo pertence à prefeitura atual.
 * - Se prefId não for informado, apenas retorna o ativo.
 * - Se não bater, limpa e retorna null.
 */
export function ensureValidCemiterio(prefId) {
  const ativo = getCemiterioAtivo();
  if (!ativo) return null;
  if (!prefId) return ativo;
  if (ativo.prefeitura_id == null) return ativo; // sem dado, não invalida
  if (String(ativo.prefeitura_id) === String(prefId)) return ativo;
  clearCemiterioAtivo();
  return null;
}
