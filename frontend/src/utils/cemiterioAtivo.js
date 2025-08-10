// src/utils/cemiterioAtivo.js

// Lê o cemitério ativo do localStorage
export function getCemiterioAtivo() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Define/atualiza o cemitério ativo e dispara evento global
export function setCemiterioAtivo(cem) {
  if (!cem) return clearCemiterioAtivo();

  const payload = {
    id: Number(cem.id),
    nome: cem.nome || cem.codigo || "Cemitério",
    // MUITO importante: amarra ao dono (prefeitura)
    prefeitura_id: Number(cem.prefeitura_id || cem.prefeitura?.id),
  };

  localStorage.setItem("cemiterioAtivo", JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("cemiterio:changed", { detail: payload }));
}

// Limpa o cemitério ativo e avisa a app
export function clearCemiterioAtivo() {
  localStorage.removeItem("cemiterioAtivo");
  window.dispatchEvent(new CustomEvent("cemiterio:changed", { detail: null }));
}

// Garante que o cemitério salvo pertence à prefeitura atual.
// Se não pertencer, limpa e retorna null.
export function ensureValidCemiterio(prefeituraId) {
  const ativo = getCemiterioAtivo();
  if (!ativo) return null;
  if (!prefeituraId || Number(ativo.prefeitura_id) !== Number(prefeituraId)) {
    clearCemiterioAtivo();
    return null;
  }
  return ativo;
}
