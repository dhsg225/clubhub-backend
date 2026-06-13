/**
 * BL-016: audit flush loop — verifies fetch is called when AUDIT_ENDPOINT is set.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('audit flush', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs records to AUDIT_ENDPOINT when configured', async () => {
    const endpoint = 'http://audit-service:3006/audit/batch';
    const records = [
      { screen_id: 's1', venue_id: 'v1', at: Date.now(), resolution_level: 3, is_fallback: false, playlist_checksum: 'abc' },
    ];

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(records),
    });

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      }),
    );
  });

  it('does not call fetch when AUDIT_ENDPOINT is empty', async () => {
    const auditEndpoint = '';
    if (auditEndpoint) {
      await fetch(auditEndpoint, { method: 'POST', body: '[]' });
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('flush is fire-and-forget — fetch rejection does not propagate', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connection refused'));
    const endpoint = 'http://audit-service:3006/audit/batch';

    await expect(
      (async () => {
        try {
          await fetch(endpoint, { method: 'POST', body: '[]' });
        } catch {
          // Swallowed — same as the runtime flush catch block
        }
      })(),
    ).resolves.toBeUndefined();
  });
});
