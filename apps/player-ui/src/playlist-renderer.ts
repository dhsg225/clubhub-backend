/**
 * Playlist renderer for Pi player.
 * Constitutional: emergency overlay cannot be overridden by playlist logic.
 *
 * Rendering modes (D-012):
 *   Static asset  — item has asset_path → plays image or video file
 *   Data-driven   — item has template_type (no asset_path) → stub renderer
 *                   Replace stub with production renderer per template type.
 */

import { renderTemplateStub } from './template-stubs.js';

interface PlaylistItem {
  content_id: string;
  duration_ms: number;
  asset_path?: string;
  template_type?: string;
  data?: Record<string, unknown>;
  weight?: number;
  source?: number;
  sponsored?: boolean;
}

let currentItemIndex = 0;
let currentPlaylist: PlaylistItem[] = [];
let renderTimer: ReturnType<typeof setTimeout> | null = null;

export function renderPlaylist(items: PlaylistItem[]): void {
  currentPlaylist = items;
  currentItemIndex = 0;
  scheduleNextItem();
}

export function showWaiting(): void {
  const container = document.getElementById('content-container');
  if (!container) return;
  container.innerHTML = '';
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#444;font-family:sans-serif;font-size:1.5rem;letter-spacing:0.02em;';
  el.textContent = 'Waiting for content…';
  container.appendChild(el);
}

function scheduleNextItem(): void {
  if (renderTimer) clearTimeout(renderTimer);
  if (currentPlaylist.length === 0) return;

  const item = currentPlaylist[currentItemIndex % currentPlaylist.length];
  if (!item) return;

  displayItem(item);
  renderTimer = setTimeout(() => {
    currentItemIndex = (currentItemIndex + 1) % currentPlaylist.length;
    scheduleNextItem();
  }, item.duration_ms);
}

function displayItem(item: PlaylistItem): void {
  const container = document.getElementById('content-container');
  if (!container) return;

  container.innerHTML = '';

  // Data-driven template — route to stub (replace stub with production renderer)
  if (item.template_type && !item.asset_path) {
    renderTemplateStub(container, item.template_type, item.data ?? {}, item.content_id);
    return;
  }

  if (!item.asset_path) return;

  if (item.asset_path.endsWith('.mp4') || item.asset_path.endsWith('.webm')) {
    const video = document.createElement('video');
    video.src = item.asset_path;
    video.autoplay = true;
    video.muted = true;
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    container.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = item.asset_path;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    container.appendChild(img);
  }
}
