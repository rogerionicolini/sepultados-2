export function getCemiterioAtivo() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o?.id) return { id: Number(o.id), nome: o.nome };
    return null;
  } catch {
    return null;
  }
}

export function setCemiterioAtivo(id, nome) {
  localStorage.setItem(
    "cemiterioAtivo",
    JSON.stringify({ id: Number(id), nome })
  );
}
