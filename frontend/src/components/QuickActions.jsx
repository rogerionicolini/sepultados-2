import React from "react";
import { useNavigate } from "react-router-dom";

const Btn = ({ children, to }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                 bg-[#e6f3d7] text-green-900 border border-[#bcd2a7] shadow
                 hover:bg-[#d9ebc2] transition"
      title={typeof children === "string" ? children : "Atalho"}
    >
      <span className="text-xl leading-none">＋</span>
      <span className="font-semibold">{children}</span>
    </button>
  );
};

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Btn to="/sepultados?novo=1">Sepultamento</Btn>
      <Btn to="/exumacoes?novo=1">Exumação</Btn>
      <Btn to="/traslados?novo=1">Translado</Btn>
      <Btn to="/contratos?novo=1">Contrato</Btn>
    </div>
  );
}
