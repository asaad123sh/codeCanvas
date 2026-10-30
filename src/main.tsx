import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useBuilderStore } from './store/builderStore';
import './styles/index.css';

// Expose the store for debugging / automated testing in dev builds.
if (import.meta.env.DEV) {
  (window as any).__builder = useBuilderStore;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);