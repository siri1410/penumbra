import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { isElectron } from './lib/bridge.js';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No root element');

if (!isElectron) {
  // Browser dev mode: paint a dark page so the translucent panel reads correctly.
  document.body.style.background =
    'radial-gradient(circle at 30% 20%, #2a2440 0%, #0c0c12 60%)';
  document.body.style.padding = '24px';
  document.body.style.minHeight = '100vh';
  document.getElementById('root')!.style.maxWidth = '480px';
  document.getElementById('root')!.style.height = '640px';
  document.getElementById('root')!.style.margin = '0 auto';
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
