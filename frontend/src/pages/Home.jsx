import React from "react";
import "../index.css";

function Home() {
  return (
    <div className="home-container">
      <img src="/logo.png" alt="Logo Sepultados" className="home-logo" />
      <a href="/login" className="home-button">
        Acessar o sistema
      </a>
    </div>
  );
}

export default Home;
