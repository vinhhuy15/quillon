import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/inter';
import './styles.css';

// Development only: lets scripts/screenshots.mjs drive the same module instances the app uses.
if (import.meta.env.DEV) {
  void Promise.all([import('./state/store'), import('./actions'), import('./layout'), import('@quillon/doc-model'), import('@quillon/figure-core')]).then(
    ([store, actions, layout, doc, figure]) => Object.assign(window, { __quillon: { store, actions, layout, doc, figure } }),
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
