import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { storageKeyMap } from './lib/storage';

const params = new URLSearchParams(window.location.search);

if (params.get('reset') === '1') {
  Object.values(storageKeyMap).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore browser storage errors.
    }
  });

  params.delete('reset');
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.Fragment>
    <App />
  </React.Fragment>
);
