const BASE = 'http://localhost:4000';

// ─── Content ────────────────────────────────────────────────────────────────

export async function createContent(template_type: string, data: object) {
  const res = await fetch(`${BASE}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_type, data }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listContent() {
  const res = await fetch(`${BASE}/content`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteContent(id: string) {
  const res = await fetch(`${BASE}/content/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Manifest ───────────────────────────────────────────────────────────────

export async function getManifest(screen_id = 'screen-1') {
  const res = await fetch(`${BASE}/manifest?screen_id=${screen_id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Schedules ──────────────────────────────────────────────────────────────

export async function createSchedule(data: object) {
  const res = await fetch(`${BASE}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listSchedules(params: { content_id?: string; venue_id?: string; screen_id?: string } = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null)
    ) as Record<string, string>
  ).toString();
  const res = await fetch(`${BASE}/schedules${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteSchedule(id: string) {
  const res = await fetch(`${BASE}/schedules/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export async function uploadAsset(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/asset/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Legacy (kept for backward compat — no longer used by default UI) ───────

export async function generatePlaylist(screen_id: string, content_ids: string[], duration: number) {
  const res = await fetch(`${BASE}/playlist/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screen_id, content_ids, duration }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
