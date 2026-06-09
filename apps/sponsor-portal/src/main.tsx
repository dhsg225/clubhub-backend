/**
 * Sponsor Portal Application
 *
 * Allows sponsors to view campaign performance, request content changes,
 * and view compliance reporting for their placements.
 *
 * Constitutional UI constraints (same as cms-web):
 * 1. EMERGENCY_FREEZE overlay renders above all content at z-index 9999
 * 2. No optimistic updates on corpus-modifying mutations
 * 3. PREVIEW: prefix on checksums is never stripped
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
