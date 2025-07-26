import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import Navbar from "./components/Navbar";

// Importar as páginas (ainda vamos criar cada uma)
import Login from "./pages/Login";
import Cemiterios from "./pages/Cemiterios";
import Quadras from "./pages/Quadras";
import Tumulos from "./pages/Tumulos";
import Sepultados from "./pages/Sepultados";
import Contratos from "./pages/Contratos";
import Exumacoes from "./pages/Exumacoes";
import Translados from "./pages/Translados";
import Receitas from "./pages/Receitas";
import Auditoria from "./pages/Auditoria";
import ImportarQuadras from "./pages/ImportarQuadras";
import ImportarTumulos from "./pages/ImportarTumulos";
import ImportarSepultados from "./pages/ImportarSepultados";
import RelatorioSepultados from "./pages/RelatorioSepultados";
import RelatorioExumacoes from "./pages/RelatorioExumacoes";
import RelatorioTranslados from "./pages/RelatorioTranslados";
import RelatorioContratos from "./pages/RelatorioContratos";
import RelatorioReceitas from "./pages/RelatorioReceitas";
import RelatorioTumulos from "./pages/RelatorioTumulos";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/cemiterios" element={<Cemiterios />} />
          <Route path="/quadras" element={<Quadras />} />
          <Route path="/tumulos" element={<Tumulos />} />
          <Route path="/sepultados" element={<Sepultados />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/exumacoes" element={<Exumacoes />} />
          <Route path="/translados" element={<Translados />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/importar-quadras" element={<ImportarQuadras />} />
          <Route path="/importar-tumulos" element={<ImportarTumulos />} />
          <Route path="/importar-sepultados" element={<ImportarSepultados />} />
          <Route path="/relatorio-sepultados" element={<RelatorioSepultados />} />
          <Route path="/relatorio-exumacoes" element={<RelatorioExumacoes />} />
          <Route path="/relatorio-translados" element={<RelatorioTranslados />} />
          <Route path="/relatorio-contratos" element={<RelatorioContratos />} />
          <Route path="/relatorio-receitas" element={<RelatorioReceitas />} />
          <Route path="/relatorio-tumulos" element={<RelatorioTumulos />} />
        </Routes>
      </Router>
    </I18nextProvider>
  );
}

export default App;
