import React from "react";
import { X, User } from "lucide-react";

export default function UserDrawer({ open, onClose }) {
  return (
    <div
      className={`fixed top-0 right-0 h-full w-64 bg-[#d8e9c0] shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-green-800">
        <h2 className="text-green-900 text-lg font-semibold">Atalhos</h2>
        <button onClick={onClose}>
          <X className="w-5 h-5 text-green-900" />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-200 cursor-pointer text-green-900">
          <User className="w-5 h-5" />
          <span>Dados</span>
        </div>
      </div>
    </div>
  );
}
