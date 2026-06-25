/**
 * CMS Web Application
 *
 * Constitutional UI constraints (see FRONTEND-APPLICATIONS.md):
 * 1. EMERGENCY_FREEZE overlay renders above all content at z-index 9999
 * 2. Emergency trigger is always two full-page steps — never a dialog
 * 3. useMutationGuard() wraps all corpus-modifying mutations
 * 4. PREVIEW: prefix on checksums is never stripped
 * 5. No optimistic updates on corpus-modifying mutations
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/responsive.css';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
