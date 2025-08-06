// src/utils/auth.js
export function logout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("prefeitura_ativa_id");
  window.location.href = "/login"; // força redirecionamento
}
