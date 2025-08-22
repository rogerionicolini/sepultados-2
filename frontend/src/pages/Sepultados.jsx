// src/pages/Sepultados.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import FormularioSepultado from "../components/FormularioSepultado";

const API_BASE = "http://localhost:8000/api/";
const SEPULTADOS_EP = "sepultados/";
const TUMULOS_EP = "tumulos/";

/** Helpers */
const getToken = () => localStorage.getItem("accessToken") || "";

function getCemiterioAtivoId() {
  try {
    const raw = localStorage.getItem("cemiterioAtivo");
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.id) return Number(o.id);
    }
  } catch {}
  const id = localStorage.getItem("cemiterioAtivoId");
  return id ? Number(id) : null;
}

const maskCpf = (v) => {
  const s = (v || "").replace(/\D/g, "").slice(0, 11);
  if (s.length <= 3) return s;
  if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3)}`;
  if (s.length <= 9) return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`;
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
};

const fmtDate = (d) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? d : dt.toISOString().slice(0, 10);
};

export default function Sepultados() {
  /** layout: lista <-> formulário */
  const [modoFormulario, setModoFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  /** dados */
  const [sepultados, setSepultados] = useState([]);
  const [tumulosMap, setTumulosMap] = useState(new Map()); // id -> label
  const [busca, setBusca] = useState("");

  /** ui */
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const cemiterioId = getCemiterioAtivoId();

  const [search] = useSearchParams();
  const navigate = useNavigate();

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  /** ------- carregar lista ------- */
  async function buscarSepultados() {
    try {
      setLoading(true);
      setErro("");
      const qs = new URLSearchParams();
      if (cemiterioId) qs.set("cemiterio", cemiterioId);
      const url = qs.toString() ? `${SEPULTADOS_EP}?${qs}` : SEPULTADOS_EP;

      const { data } = await api.get(url);
      const arr = Array.isArray(data) ? data : data?.results ?? [];
      setSepultados(arr);
    } catch (err) {
      console.error("listar sepultados ERRO:", err?.response?.data || err);
      setErro("Erro ao carregar sepultados.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarTumulosMap() {
    try {
      const qs = new URLSearchParams();
      if (cemiterioId) qs.set("cemiterio", cemiterioId);
      const urlTum = qs.toString() ? `${TUMULOS_EP}?${qs}` : TUMULOS_EP;
      const urlQua = qs.toString() ? `quadras/?${qs}` : "quadras/";

      const [tumulosRes, quadrasRes] = await Promise.all([
        api.get(urlTum),
        api.get(urlQua),
      ]);

      const quadArr = Array.isArray(quadrasRes.data)
        ? quadrasRes.data
        : quadrasRes.data?.results ?? [];
      const qMap = new Map();
      quadArr.forEach((q) => {
        const qid = String(q.id ?? q.pk);
        qMap.set(qid, { id: q.id ?? q.pk, nome: q.nome, codigo: q.codigo });
      });

      const tArr = Array.isArray(tumulosRes.data)
        ? tumulosRes.data
        : tumulosRes.data?.results ?? [];
      const m = new Map();
      tArr.forEach((t) => {
        const id = t.id ?? t.pk;
        m.set(String(id), rotuloTumulo(t, qMap));
      });
      setTumulosMap(m);
    } catch (e) {
      console.warn("tumulos map ERRO:", e?.response?.status || e);
    }
  }



  useEffect(() => {
    if (!modoFormulario) {
      Promise.all([buscarSepultados(), carregarTumulosMap()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoFormulario, cemiterioId]);

  /** abrir automático quando vier ?novo=1 */
  useEffect(() => {
    if (search.get("novo") === "1") {
      setEditandoId(null);
      setModoFormulario(true);
    }
  }, [search]);
  function rotuloTumulo(t, quadrasMap = new Map()) {
    if (!t) return "";
    const id = t.id ?? t.pk ?? "";
    const base =
      t.identificador || t.codigo || t.nome || `T ${String(id).padStart(2, "0")}`;

    let linhaTxt = "";
    const lraw =
      typeof t.linha === "object"
        ? t.linha?.id ?? t.linha?.numero ?? t.linha?.codigo
        : t.linha;
    if (t.usar_linha && (lraw || lraw === 0)) linhaTxt = `L ${lraw}`;

    let quadraTxt = "";
    const q = t.quadra;
    const resolveQuadra = (info) => {
      if (!info) return "";
      if (info.nome) return info.nome;
      if (info.codigo != null) {
        const cod = String(info.codigo);
        return /^\d+$/.test(cod) ? `Quadra ${cod.padStart(2, "0")}` : cod;
      }
      if (info.id != null) return `Quadra ${info.id}`;
      return "";
    };

    if (q) {
      if (typeof q === "object") quadraTxt = resolveQuadra(q);
      else {
        const info = quadrasMap.get(String(q)) || quadrasMap.get(Number(q));
        if (info) quadraTxt = resolveQuadra(info);
        else {
          const cod = String(q);
          quadraTxt = /^\d+$/.test(cod) ? `Quadra ${cod.padStart(2, "0")}` : cod;
        }
      }
    }

    return [base, linhaTxt, quadraTxt].filter(Boolean).join(" ");
  }


  function tumuloLabelFromRow(s) {
    if (s?.tumulo && typeof s.tumulo === "object") {
      return rotuloTumulo(s.tumulo, new Map()); // já veio resolvido
    }
    if (s?.tumulo_label) return s.tumulo_label;
    if (s?.tumulo) {
      return tumulosMap.get(String(s.tumulo)) || `T ${s.tumulo}`;
    }
    return "-";
  }



  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return sepultados;
    return sepultados.filter((s) => {
      const nome = (s.nome || s.nome_completo || "").toString().toLowerCase();
      const cpf = (s.cpf_sepultado || s.cpf || "").toString().toLowerCase();
      const num = (s.numero_sepultamento || "").toString().toLowerCase();
      const tumuloTxt = tumuloLabelFromRow(s).toString().toLowerCase();
      return (
        nome.includes(q) || cpf.includes(q) || num.includes(q) || tumuloTxt.includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sepultados, busca, tumulosMap]);

  /** ------- ações ------- */
  async function excluir(id) {
    if (!window.confirm("Excluir este registro?")) return;
    try {
      await api.delete(`${SEPULTADOS_EP}${id}/`);
      await buscarSepultados();
    } catch (e) {
      console.error("excluir sepultado ERRO:", e?.response?.data || e);
      alert("Erro ao excluir.");
    }
  }

  async function abrirRelatorio(s) {
    const id = s.id ?? s.pk;
    const tentativas = [
      `${SEPULTADOS_EP}${id}/pdf/`,
      `${SEPULTADOS_EP}${id}/relatorio_pdf/`,
      `${SEPULTADOS_EP}${id}/report/`,
    ];
    for (const url of tentativas) {
      try {
        const res = await api.get(url, { responseType: "blob" });
        const ct = (res?.headers && res.headers["content-type"]) || "";
        if (ct.includes("pdf")) {
          const blob = new Blob([res.data], { type: "application/pdf" });
          const blobUrl = URL.createObjectURL(blob);
          const w = window.open(blobUrl, "_blank");
          if (!w) {
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `sepultado_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          return;
        }
      } catch {
        // tenta o próximo
      }
    }
    alert("Não foi possível gerar o PDF deste sepultado.");
  }

  /** ------- render ------- */
  return (
    <div className="p-6">
      {modoFormulario ? (
        <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-md">
          <FormularioSepultado
            sepultadoId={editandoId}
            onClose={() => {
              setModoFormulario(false);
              setEditandoId(null);
              buscarSepultados();                   // recarrega a lista ao fechar (salvo/cancelado)
              navigate("/sepultados", { replace: true }); // limpa ?novo=1
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-green-900">Sepultados</h1>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/sepultados?novo=1")}
                className="bg-green-800 text-white px-4 py-2 rounded-xl shadow hover:bg-green-700"
              >
                Adicionar
              </button>
              <button
                onClick={buscarSepultados}
                className="bg-[#688f53] text-white px-4 py-2 rounded-xl shadow hover:opacity-90"
              >
                Atualizar
              </button>
            </div>
          </div>

          {/* Busca */}
          <div className="bg-[#f0f8ea] rounded-xl p-4 shadow">
            <div className="flex items-center gap-3 mb-4">
              <input
                className="w-full border border-[#bcd2a7] rounded-lg px-3 py-2 outline-none"
                placeholder="Buscar por nome, CPF, túmulo ou nº de sepultamento..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            {erro && <div className="text-red-600 mb-2">{erro}</div>}

            {loading ? (
              <div className="text-gray-600">Carregando…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-green-900 bg-[#e6f3d7]">
                      <th className="py-2 px-3 rounded-l-lg">Nº sepultamento</th>
                      <th className="py-2 px-3">Nome</th>
                      <th className="py-2 px-3">CPF</th>
                      <th className="py-2 px-3">Data do sepultamento</th>
                      <th className="py-2 px-3">Data do falecimento</th>
                      <th className="py-2 px-3">Túmulo</th>
                      <th className="py-2 px-3 w-56 rounded-r-lg">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50">
                    {filtrados.map((s, idx) => {
                      const id = s.id ?? s.pk ?? idx;
                      const numero = s.numero_sepultamento || "-";
                      const nome = s.nome || s.nome_completo || "-";
                      const cpf = maskCpf(s.cpf_sepultado || s.cpf || "");
                      const dtSep = fmtDate(s.data_sepultamento || s.data || "");
                      const dtFal = fmtDate(s.data_falecimento || "");
                      const tumuloTxt = tumuloLabelFromRow(s);

                      return (
                        <tr key={id} className="border-t border-[#d8e9c0] hover:bg-white">
                          <td className="py-2 px-3">{numero}</td>
                          <td className="py-2 px-3">{nome}</td>
                          <td className="py-2 px-3">{cpf || "-"}</td>
                          <td className="py-2 px-3">{dtSep}</td>
                          <td className="py-2 px-3">{dtFal}</td>
                          <td className="py-2 px-3">{tumuloTxt}</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => abrirRelatorio(s)}
                                className="px-3 py-1 rounded border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100"
                                title="Abrir relatório (PDF)"
                              >
                                Relatório
                              </button>
                              <button
                                onClick={() => {
                                  const realId = s.id ?? s.pk ?? id;
                                  setEditandoId(realId);
                                  setModoFormulario(true);
                                }}
                                className="px-3 py-1 rounded bg-[#f2b705] text-white hover:opacity-90"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => excluir(s.id ?? s.pk ?? id)}
                                className="px-3 py-1 rounded bg-[#e05151] text-white hover:opacity-90"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtrados.length === 0 && (
                      <tr>
                        <td className="py-6 px-3 text-gray-600" colSpan={7}>
                          Nada encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
