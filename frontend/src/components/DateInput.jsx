import React from "react";
import { toInputValue, fromInputValue, toApiDate } from "@/utils/dateBR";

/**
 * <DateInput />
 * - value pode ser dd/mm/aaaa, ISO yyyy-mm-dd ou Date
 * - emit: "iso" (default) | "br" | "date"
 *   -> controla o que o onChange vai receber
 */
export default function DateInput({ value, onChange, emit = "iso", ...rest }) {
  const v = toInputValue(value); // o HTML precisa de yyyy-mm-dd

  function handleChange(e) {
    const raw = e.target.value; // yyyy-mm-dd (ou "")
    let out = raw;
    if (emit === "br") out = raw ? fromInputValue(raw) : "";
    else if (emit === "date") out = raw ? new Date(raw) : null;
    else if (emit === "iso") out = raw || ""; // já está em ISO
    onChange?.(out);
  }

  return <input type="date" value={v} onChange={handleChange} {...rest} />;
}

// helper opcional para enviar para API se ela exigir ISO
DateInput.toApi = toApiDate;
