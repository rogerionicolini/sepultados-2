/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fundo: '#e3efcc',
        verde: {
          DEFAULT: '#224c15',
          claro: '#5f8c3f',
          escuro: '#1d3e11',
        },
      },
    },
  },
  plugins: [],
};
