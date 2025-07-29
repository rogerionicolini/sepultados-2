import React from 'react'

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-green-100 text-green-900">
      {/* Menu lateral */}
      <aside className="w-64 bg-green-800 text-white flex flex-col shadow-md">
        <div className="text-2xl font-bold p-6 border-b border-green-700">Sepultados.com</div>
        <nav className="flex-1 px-4 py-6 space-y-2 text-sm">
          <a href="#" className="block px-4 py-2 rounded hover:bg-green-700">📋 Relatórios</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-green-700">⚰️ Sepultados</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-green-700">📝 Contratos</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-green-700">💵 Financeiro</a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-green-700">⚙️ Administração</a>
        </nav>
        <div className="p-4 border-t border-green-700">
          <button className="text-sm text-green-200 hover:underline">🔓 Sair</button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="text-3xl font-bold mb-6">📊 Painel de Controle</header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow border border-green-300">
            <h2 className="text-lg font-semibold mb-2">⚰️ Sepultados</h2>
            <p className="text-3xl font-bold text-green-700">324</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow border border-green-300">
            <h2 className="text-lg font-semibold mb-2">📝 Contratos</h2>
            <p className="text-3xl font-bold text-green-700">189</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow border border-green-300">
            <h2 className="text-lg font-semibold mb-2">💵 Receitas</h2>
            <p className="text-3xl font-bold text-green-700">R$ 45.300</p>
          </div>
        </div>
      </main>
    </div>
  );
}
