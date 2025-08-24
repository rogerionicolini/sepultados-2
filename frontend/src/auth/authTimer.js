// src/auth/authTimer.js
import axios from "axios";
import { api, getTokens, setTokens, clearTokens } from "../api/api";

// Base pega da instância do api
const API_BASE = api?.defaults?.baseURL || "http://127.0.0.1:8000/api";

let refreshTimeout = null;

function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Agenda um refresh do access token ~2 minutos antes de expirar.
 * Reagenda após cada refresh bem-sucedido.
 */
export function scheduleProactiveRefresh() {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }

  const { access, refresh } = getTokens();
  if (!access || !refresh) return;

  const payload = decodeJwt(access);
  const expSec = payload?.exp; // UNIX seconds UTC
  if (!expSec) return;

  const nowMs = Date.now();
  const expMs = expSec * 1000;
  const aheadMs = 2 * 60 * 1000; // 2 min antes
  let delay = expMs - nowMs - aheadMs;
  if (delay < 0) delay = 0;

  refreshTimeout = setTimeout(async () => {
    try {
      // axios cru para não passar pelos interceptors
      const r = await axios.post(`${API_BASE}/token/refresh/`, { refresh });
      const newAccess = r.data.access;
      const newRefresh = r.data.refresh ?? refresh;
      setTokens({ access: newAccess, refresh: newRefresh });

      scheduleProactiveRefresh();
    } catch (e) {
      clearTokens();
      // opcional: redirecionar para login
    }
  }, delay);
}

/** Reagenda quando a aba volta ao foco */
export function attachVisibilityRescheduler() {
  const handler = () => {
    if (document.visibilityState === "visible") {
      scheduleProactiveRefresh();
    }
  };
  document.addEventListener("visibilitychange", handler);
}
