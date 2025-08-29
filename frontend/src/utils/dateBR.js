// dateBR.js
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DT   = /^\d{4}-\d{2}-\d{2}T/;
const BR_DATE  = /^\d{2}\/\d{2}\/\d{4}$/;

function parseIsoLocal(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // validação para evitar datas inválidas (ex.: 31/02)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

export function parseToDate(s) {
  if (!s) return null;
  if (s instanceof Date) return s;

  if (ISO_DT.test(s)) {                    // ISO com hora -> OK usar Date nativo
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (ISO_DATE.test(s)) {                  // ISO só com dia -> parse local
    return parseIsoLocal(s);
  }
  if (BR_DATE.test(s)) {                   // dd/mm/aaaa
    const [dd, mm, yyyy] = s.split("/");
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);                   // fallback
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatBR(s) {
  const d = parseToDate(s);
  return d ? new Intl.DateTimeFormat("pt-BR").format(d) : "";
}

export function formatBRDateTime(s) {
  const d = parseToDate(s);
  return d
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d)
    : "";
}

export function toInputValue(s) {          // -> "yyyy-mm-dd" para <input type="date">
  const d = parseToDate(s);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fromInputValue(value) {    // "yyyy-mm-dd" -> "dd/mm/yyyy"
  if (!value) return "";
  const [yyyy, mm, dd] = value.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

export function toApiDate(s) {             // qualquer entrada -> "yyyy-mm-dd" (seguro p/ API)
  const d = parseToDate(s);
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
