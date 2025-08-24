// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// inicia o refresh proativo e o rescheduler ao abrir a app
import { scheduleProactiveRefresh, attachVisibilityRescheduler } from './auth/authTimer';
scheduleProactiveRefresh();
attachVisibilityRescheduler();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
