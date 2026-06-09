/**
 * Playlist renderer for Pi player.
 * Constitutional: checksum verification before rendering any playlist.
 * Emergency overlay cannot be overridden by playlist logic.
 */

interface PlaylistItem {
  content_id: string;
  duration_ms: number;
  asset_path: string; // local file path verified by player-runtime
}

let currentItemIndex = 0;
let currentPlaylist: PlaylistItem[] = [];
let renderTimer: ReturnType<typeof setTimeout> | null = null;

export function renderPlaylist(items: PlaylistItem[]): void {
  currentPlaylist = items;
  currentItemIndex = 0;
  scheduleNextItem();
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
