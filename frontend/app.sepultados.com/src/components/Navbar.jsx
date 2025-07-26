import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

function Navbar() {
  const { t } = useTranslation();

  return (
    <nav className="bg-green-900 text-white w-full p-4 mb-6">
      <ul className="flex flex-wrap gap-3 text-sm font-semibold">
        <li><Link to="/cemiterios">{t("Cemitérios")}</Link></li>
        <li><Link to="/quadras">{t("Quadras")}</Link></li>
        <li><Link to="/tumulos">{t("Túmulos")}</Link></li>
        <li><Link to="/sepultados">{t("Sepultados")}</Link></li>
        <li><Link to="/contratos">{t("Contratos de Concessão")}</Link></li>
        <li><Link to="/exumacoes">{t("Exumações")}</Link></li>
        <li><Link to="/translados">{t("Traslados")}</Link></li>
        <li><Link to="/receitas">{t("Receitas")}</Link></li>
        <li><Link to="/auditoria">{t("Registros de Auditoria")}</Link></li>
        <li><Link to="/importar-quadras">{t("Importar Quadras")}</Link></li>
        <li><Link to="/importar-tumulos">{t("Importar Túmulos")}</Link></li>
        <li><Link to="/importar-sepultados">{t("Importar Sepultados")}</Link></li>
        <li><Link to="/relatorio-sepultados">{t("Relatório de Sepultados")}</Link></li>
        <li><Link to="/relatorio-exumacoes">{t("Relatório de Exumações")}</Link></li>
        <li><Link to="/relatorio-translados">{t("Relatório de Translados")}</Link></li>
        <li><Link to="/relatorio-contratos">{t("Relatório de Contratos")}</Link></li>
        <li><Link to="/relatorio-receitas">{t("Relatório de Receitas")}</Link></li>
        <li><Link to="/relatorio-tumulos">{t("Relatório de Túmulos")}</Link></li>
      </ul>
    </nav>
  );
}

export default Navbar;
