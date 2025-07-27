import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

function Navbar() {
  const { t } = useTranslation();

  return (
    <aside className="w-64 h-screen fixed top-0 left-0 bg-green-900 text-white flex flex-col shadow-lg z-50">
      <div className="text-xl font-bold text-center py-5 border-b border-green-700">
        Sepultados.com
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <div>
          <h2 className="text-sm uppercase text-green-200 mb-2">Módulos de Gestão</h2>
          <ul className="space-y-1 text-sm">
            <li><Link to="/cemiterios" className="block hover:bg-green-800 p-2 rounded">{t("Cemitérios")}</Link></li>
            <li><Link to="/quadras" className="block hover:bg-green-800 p-2 rounded">{t("Quadras")}</Link></li>
            <li><Link to="/tumulos" className="block hover:bg-green-800 p-2 rounded">{t("Túmulos")}</Link></li>
            <li><Link to="/sepultados" className="block hover:bg-green-800 p-2 rounded">{t("Sepultados")}</Link></li>
            <li><Link to="/contratos" className="block hover:bg-green-800 p-2 rounded">{t("Contratos de Concessão")}</Link></li>
            <li><Link to="/exumacoes" className="block hover:bg-green-800 p-2 rounded">{t("Exumações")}</Link></li>
            <li><Link to="/translados" className="block hover:bg-green-800 p-2 rounded">{t("Traslados")}</Link></li>
            <li><Link to="/receitas" className="block hover:bg-green-800 p-2 rounded">{t("Receitas")}</Link></li>
            <li><Link to="/auditoria" className="block hover:bg-green-800 p-2 rounded">{t("Registros de Auditoria")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm uppercase text-green-200 mt-6 mb-2">Importações por Planilha</h2>
          <ul className="space-y-1 text-sm">
            <li><Link to="/importar-quadras" className="block hover:bg-green-800 p-2 rounded">{t("Importar Quadras")}</Link></li>
            <li><Link to="/importar-tumulos" className="block hover:bg-green-800 p-2 rounded">{t("Importar Túmulos")}</Link></li>
            <li><Link to="/importar-sepultados" className="block hover:bg-green-800 p-2 rounded">{t("Importar Sepultados")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm uppercase text-green-200 mt-6 mb-2">Relatórios</h2>
          <ul className="space-y-1 text-sm">
            <li><Link to="/relatorio-sepultados" className="block hover:bg-green-800 p-2 rounded">{t("Relatório de Sepultados")}</Link></li>
            <li><Link to="/relatorio-exumacoes" className="block hover:bg-green-800 p-2 rounded">{t("Relatório de Exumações")}</Link></li>
            <li><Link to="/relatorio-translados" className="block hover:bg-green-800 p-2 rounded">{t("Relatório de Translados")}</Link></li>
            <li><Link to="/relatorio-contratos" className="block hover:bg-green-800 p-2 rounded">{t("Relatório de Contratos")}</Link></li>
            <li><Link to="/relatorio-receitas" className="block hover:bg-green-800 p-2 rounded">{t("Relatório de Receitas")}</Link></li>
            <li><Link to="/relatorio-tumulos" className="block hover:bg-green-800 p-2 rounded">{t("Relatório de Túmulos")}</Link></li>
          </ul>
        </div>
      </nav>

      <div className="border-t border-green-700 p-4">
        <Link
          to="/login"
          className="block w-full text-center bg-green-800 hover:bg-green-700 py-2 rounded text-sm"
        >
          Sair
        </Link>
      </div>
    </aside>
  );
}

export default Navbar;
