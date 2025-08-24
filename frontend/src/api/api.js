// src/api/api.js
import axios from "axios";

// Base da sua API confirmada no Network
const BASE_URL = "http://127.0.0.1:8000/api";

// ===== Helpers de tokens =====
export function getTokens() {
  try {
    return JSON.parse(localStorage.getItem("tokens") || "{}");
  } catch {
    return {};
  }
}

// >>> retrocompatível com chaves antigas que seu header pode ler <<<
export function setTokens(tokens) {
  // novo formato
  localStorage.setItem("tokens", JSON.stringify(tokens));
  // legacy
  if (tokens?.access) localStorage.setItem("accessToken", tokens.access);
  if (tokens?.refresh) localStorage.setItem("refreshToken", tokens.refresh);
}

export function clearTokens() {
  localStorage.removeItem("tokens");
  // legacy
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("usuario_logado");
  localStorage.removeItem("email_usuario");
  localStorage.removeItem("nome_usuario");
  localStorage.removeItem("prefeitura_ativa_id");
  localStorage.removeItem("prefeitura_nome");
  localStorage.removeItem("prefeitura_brasao_url");
}

// ===== Instância principal do Axios =====
export const api = axios.create({
  baseURL: BASE_URL,
});

// Injeta o access token em toda request
api.interceptors.request.use((config) => {
  const { access } = getTokens();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// Evita múltiplos refresh simultâneos
let isRefreshing = false;
let queue = [];
const subscribe = (cb) => queue.push(cb);
const flush = (newAccess) => { queue.forEach((cb) => cb(newAccess)); queue = []; };

// Tenta refresh ao receber 401 token_not_valid e refaz a requisição original
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error?.response?.status;
    const code = error?.response?.data?.code;

    // não intercepta os próprios endpoints de auth
    const url = original?.url || "";
    const isAuthEndpoint = url.includes("/token/");
    if (isAuthEndpoint) return Promise.reject(error);

    if (status === 401 && code === "token_not_valid" && !original._retry) {
      original._retry = true;

      const { refresh } = getTokens();
      if (!refresh) {
        clearTokens();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // espera o refresh em andamento e reenvia a request
        return new Promise((resolve) => {
          subscribe((newAccess) => {
            original.headers.Authorization = `Bearer ${newAccess}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        // usa axios cru para não passar pelos interceptors
        const resp = await axios.post(`${BASE_URL}/token/refresh/`, { refresh });
        const newAccess = resp.data.access;
        const newRefresh = resp.data.refresh ?? refresh;

        setTokens({ access: newAccess, refresh: newRefresh });

        isRefreshing = false;
        flush(`Bearer ${newAccess}`);

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
