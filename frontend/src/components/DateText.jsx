import React from "react";
import { formatBR, formatBRDateTime } from "@/utils/dateBR";

export default function DateText({ value, withTime = false, fallback = "—", className = "" }) {
  if (!value) return <span className={className}>{fallback}</span>;
  const text = withTime ? formatBRDateTime(value) : formatBR(value);
  return <span className={className}>{text || fallback}</span>;
}
