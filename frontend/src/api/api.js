// src/api/api.js
import axios from "axios";

// Base da API (dev)
const BASE_URL = "http://127.0.0.1:8000/api";

// ===== Helpers de tokens =====
export function getTokens() {
  // tenta formato novo
  try {
    const t = JSON.parse(localStorage.getItem("tokens") || "{}");
    if (t && (t.access || t.refresh)) return t;
  } catch {}

  // tenta formato legado
  const legacyAccess =
    localStorage.getItem("accessToken") || localStorage.getItem("access");
  const legacyRefresh =
    localStorage.getItem("refreshToken") || localStorage.getItem("refresh");

  if (legacyAccess || legacyRefresh) {
    return { access: legacyAccess || null, refresh: legacyRefresh || null };
  }
  return {};
}

// >>> mantém compatibilidade e centraliza salvamento <<<
export function setTokens(tokens) {
  const payload = {
    access: tokens?.access || null,
    refresh: tokens?.refresh || null,
  };
  localStorage.setItem("tokens", JSON.stringify(payload));
  // legado (algumas partes do app ainda leem essas chaves)
  if (payload.access) localStorage.setItem("accessToken", payload.access);
  if (payload.refresh) localStorage.setItem("refreshToken", payload.refresh);
}

export function clearTokens() {
  localStorage.removeItem("tokens");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("usuario_logado");
  localStorage.removeItem("email_usuario");
  localStorage.removeItem("nome_usuario");
  localStorage.removeItem("prefeitura_ativa_id");
  localStorage.removeItem("prefeitura_nome");
  localStorage.removeItem("prefeitura_brasao_url");
}

// migra legado -> novo (apenas uma vez)
(() => {
  const t = getTokens();
  if (t?.access && !localStorage.getItem("tokens")) {
    setTokens(t);
  }
})();

// ===== Instância principal do Axios =====
export const api = axios.create({ baseURL: BASE_URL });

// Injeta Authorization em toda request
api.interceptors.request.use((config) => {
  const { access } = getTokens();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// Evita múltiplos refresh simultâneos
let isRefreshing = false;
let queue = [];
const subscribe = (cb) => queue.push(cb);
const flush = (newAccess) => {
  queue.forEach((cb) => cb(newAccess)); // passa token puro
  queue = [];
};

// Interceptor de resposta com refresh automático
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error?.response?.status;
    const code = error?.response?.data?.code || error?.response?.data?.detail;

    // não intercepta endpoints de auth
    const url = original?.url || "";
    const isAuthEndpoint = url.includes("/token/");
    if (isAuthEndpoint) return Promise.reject(error);

    if (status === 401 && (code === "token_not_valid" || code === "Authentication credentials were not provided.") && !original._retry) {
      original._retry = true;

      const { refresh } = getTokens();
      if (!refresh) {
        clearTokens();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // espera o refresh terminar e reenvia
        return new Promise((resolve, reject) => {
          subscribe((newAccess) => {
            if (!newAccess) return reject(error);
            original.headers.Authorization = `Bearer ${newAccess}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const resp = await axios.post(`${BASE_URL}/token/refresh/`, { refresh });
        const newAccess = resp.data.access;
        const newRefresh = resp.data.refresh ?? refresh;
        setTokens({ access: newAccess, refresh: newRefresh });

        isRefreshing = false;
        flush(newAccess); // <- token puro

        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        isRefreshing = false;
        clearTokens();
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);
