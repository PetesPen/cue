import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { startPwa } from '@/appPwa';
import '../design/tokens.css';
import '@/fonts/fonts.css';
import '@/styles/base.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

startPwa();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
