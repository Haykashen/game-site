import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { legacyRoutePath } from './lib/routing';

const legacyPath = legacyRoutePath(window.location.hash);
if (legacyPath) window.history.replaceState(window.history.state, '', legacyPath);

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root was not found in the document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
