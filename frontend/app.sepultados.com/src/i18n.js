import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  fallbackLng: "pt",
  lng: "pt",
  resources: {
    pt: {
      translation: {
        login: "Entrar",
        logout: "Sair",
        cemeteries: "Cemitérios",
        graves: "Túmulos",
        buried: "Sepultados",
        contracts: "Contratos",
        exhumations: "Exumações",
        transfers: "Translados",
        receipts: "Receitas",
        audit: "Auditoria",
        import: "Importações",
        reports: "Relatórios",
      },
    },
    en: {
      translation: {
        login: "Login",
        logout: "Logout",
        cemeteries: "Cemeteries",
        graves: "Graves",
        buried: "Buried",
        contracts: "Contracts",
        exhumations: "Exhumations",
        transfers: "Transfers",
        receipts: "Receipts",
        audit: "Audit",
        import: "Imports",
        reports: "Reports",
      },
    },
    es: {
      translation: {
        login: "Iniciar sesión",
        logout: "Cerrar sesión",
        cemeteries: "Cementerios",
        graves: "Tumbas",
        buried: "Sepultados",
        contracts: "Contratos",
        exhumations: "Exhumaciones",
        transfers: "Traslados",
        receipts: "Recibos",
        audit: "Auditoría",
        import: "Importaciones",
        reports: "Informes",
      },
    },
    it: {
      translation: {
        login: "Accedi",
        logout: "Esci",
        cemeteries: "Cimiteri",
        graves: "Tombe",
        buried: "Sepolti",
        contracts: "Contratti",
        exhumations: "Esumazioni",
        transfers: "Trasferimenti",
        receipts: "Ricevute",
        audit: "Audit",
        import: "Importazioni",
        reports: "Report",
      },
    },
    fr: {
      translation: {
        login: "Connexion",
        logout: "Déconnexion",
        cemeteries: "Cimetières",
        graves: "Tombes",
        buried: "Enterrés",
        contracts: "Contrats",
        exhumations: "Exhumations",
        transfers: "Transferts",
        receipts: "Reçus",
        audit: "Audit",
        import: "Importations",
        reports: "Rapports",
      },
    },
  },
});

export default i18n;
