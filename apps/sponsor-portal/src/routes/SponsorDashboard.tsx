/**
 * Sponsor Dashboard — login stub + content upload form.
 * BL-037: Two tabs: "Text / News Item" (→ ticker_items via POST /sponsor/ticker)
 *          and "Sponsor Banner" (→ content table via POST /sponsor/card).
 * BL-042: Sponsor Banner tab supports direct-to-Bunny file upload.
 *         Flow: POST /media/upload-token → PUT to Bunny → POST /sponsor/card with media_url.
 */
import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';

// Relative base — in dev the Vite proxy forwards /sponsor and /media to localhost:4000;
// in production the sponsor portal is served from the same origin as the backend.
const API_BASE = '';

type Tab = 'ticker' | 'card';
type SponsorTier = 'Platinum' | 'Gold' | 'Silver';

interface UploadTokenResponse {
  upload_url: string;
  auth_header: { AccessKey: string };
  cdn_url: string;
  cdn_base_url: string;
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((payload as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function Component(): JSX.Element {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [tab, setTab] = useState<Tab>('ticker');

  // Ticker tab state
  const [tickerText, setTickerText] = useState('');
  const [tickerScreenId, setTickerScreenId] = useState('');

  // Card tab state
  const [sponsorName, setSponsorName] = useState('');
  const [tagline, setTagline] = useState('');
  const [tier, setTier] = useState<SponsorTier>('Gold');

  // File upload state (BL-042)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tickerMutation = useMutation({
    mutationFn: () =>
      postJson(`${API_BASE}/sponsor/ticker`, { text: tickerText, screen_id: tickerScreenId }),
    onSuccess: () => {
      setTickerText('');
      setTickerScreenId('');
    },
  });

  const cardMutation = useMutation({
    mutationFn: async () => {
      let mediaUrl: string | undefined;

      // If a file is selected, upload it via the Bunny flow
      if (selectedFile) {
        setUploadProgress('Requesting upload token…');
        setUploadError(null);

        // Step 1: Get upload token
        const token = await postJson<UploadTokenResponse>(
          `${API_BASE}/media/upload-token`,
          { filename: selectedFile.name },
        );

        // Step 2: PUT file directly to Bunny
        setUploadProgress('Uploading file…');
        const putRes = await fetch(token.upload_url, {
          method: 'PUT',
          headers: {
            'AccessKey': token.auth_header.AccessKey,
            'Content-Type': selectedFile.type || 'application/octet-stream',
          },
          body: selectedFile,
        });

        if (!putRes.ok) {
          throw new Error(`File upload failed (HTTP ${putRes.status})`);
        }

        mediaUrl = token.cdn_url;
        setUploadProgress('Registering card…');
      }

      // Step 3: Create the card
      return postJson(`${API_BASE}/sponsor/card`, {
        sponsor_name: sponsorName,
        tagline,
        tier,
        ...(mediaUrl ? { media_url: mediaUrl } : {}),
      });
    },
    onSuccess: () => {
      setSponsorName('');
      setTagline('');
      setTier('Gold');
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setUploadProgress(null);
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err) => {
      setUploadProgress(null);
      setUploadError(err instanceof Error ? err.message : String(err));
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(null);

    // Generate preview for images
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    if (file && file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    }
  }

  function clearFile(): void {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (!loggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: '360px', padding: '2rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>ClubHub Sponsor Portal</h1>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#6b7280' }}>Sign in to submit content.</p>
          {loginError && (
            <div role="alert" style={errorStyle}>{loginError}</div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              autoComplete="username"
            />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!username.trim() || !password.trim()) {
                setLoginError('Username and password are required.');
                return;
              }
              setLoginError('');
              setLoggedIn(true);
            }}
            style={{ width: '100%', ...submitBtnStyle }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const isCardSubmitting = cardMutation.isPending;
  const canSubmitCard = !isCardSubmitting && sponsorName.trim().length > 0;

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Submit Content</h1>
        <button
          type="button"
          onClick={() => { setLoggedIn(false); setUsername(''); setPassword(''); }}
          style={{ fontSize: '0.8rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}>
        {(['ticker', 'card'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t ? 700 : 400, fontSize: '0.875rem',
              color: tab === t ? '#1d4ed8' : '#6b7280',
              borderBottom: tab === t ? '2px solid #1d4ed8' : '2px solid transparent',
              marginBottom: '-2px', fontFamily: 'system-ui, sans-serif',
            }}
          >
            {t === 'ticker' ? 'Text / News Item' : 'Sponsor Banner'}
          </button>
        ))}
      </div>

      {/* ── Ticker tab ──────────────────────────────────────────────────── */}
      {tab === 'ticker' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Text <span style={{ fontWeight: 400, color: '#9ca3af' }}>(max 280 characters)</span></label>
            <textarea
              value={tickerText}
              onChange={(e) => setTickerText(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Enter news item or announcement text…"
              style={{ ...inputStyle, resize: 'vertical', minHeight: '5rem' }}
            />
            <span style={{ fontSize: '0.7rem', color: tickerText.length > 260 ? '#dc2626' : '#9ca3af' }}>
              {tickerText.length}/280
            </span>
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Screen ID</label>
            <input
              type="text"
              value={tickerScreenId}
              onChange={(e) => setTickerScreenId(e.target.value)}
              placeholder="Screen UUID"
              style={inputStyle}
            />
          </div>
          {tickerMutation.isError && (
            <div role="alert" style={errorStyle}>{(tickerMutation.error as Error).message}</div>
          )}
          {tickerMutation.isSuccess && (
            <div style={successStyle}>Ticker item submitted successfully.</div>
          )}
          <button
            type="button"
            onClick={() => tickerMutation.mutate()}
            disabled={tickerMutation.isPending || !tickerText.trim() || !tickerScreenId.trim()}
            style={{
              ...submitBtnStyle,
              opacity: tickerMutation.isPending || !tickerText.trim() || !tickerScreenId.trim() ? 0.6 : 1,
              cursor: tickerMutation.isPending || !tickerText.trim() || !tickerScreenId.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {tickerMutation.isPending ? 'Submitting…' : 'Submit ticker item'}
          </button>
        </div>
      )}

      {/* ── Sponsor Banner tab ──────────────────────────────────────────── */}
      {tab === 'card' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Sponsor name <span style={{ fontWeight: 400, color: '#9ca3af' }}>(max 40 characters)</span></label>
            <input
              type="text"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Acme Corp"
              style={inputStyle}
            />
            <span style={{ fontSize: '0.7rem', color: sponsorName.length > 35 ? '#dc2626' : '#9ca3af' }}>
              {sponsorName.length}/40
            </span>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Tagline <span style={{ fontWeight: 400, color: '#9ca3af' }}>(max 80 characters)</span></label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={80}
              placeholder="e.g. Proud sponsor of live sport"
              style={inputStyle}
            />
            <span style={{ fontSize: '0.7rem', color: tagline.length > 70 ? '#dc2626' : '#9ca3af' }}>
              {tagline.length}/80
            </span>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as SponsorTier)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="Platinum">Platinum</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
            </select>
          </div>

          {/* ── File upload (BL-042) ─────────────────────────────────────── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Banner image or video <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4"
              onChange={handleFileChange}
              style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}
            />
            {selectedFile && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#374151' }}>
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={clearFile}
                    style={{ fontSize: '0.72rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Remove
                  </button>
                </div>
                {/* Preview thumbnail for images */}
                {filePreviewUrl && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <img
                      src={filePreviewUrl}
                      alt="Preview"
                      style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '6px', border: '1px solid #e5e7eb', objectFit: 'contain' }}
                    />
                  </div>
                )}
                {/* Video indicator (no inline preview) */}
                {selectedFile.type.startsWith('video/') && (
                  <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f3f4f6', borderRadius: '5px', fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Video selected — preview will appear after upload.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upload progress */}
          {uploadProgress && (
            <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '5px', fontSize: '0.8rem', color: '#1e40af', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #1e40af', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              {uploadProgress}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Upload error */}
          {uploadError && (
            <div role="alert" style={errorStyle}>{uploadError}</div>
          )}

          {/* Card mutation error (non-upload) */}
          {cardMutation.isError && !uploadError && (
            <div role="alert" style={errorStyle}>{(cardMutation.error as Error).message}</div>
          )}
          {cardMutation.isSuccess && (
            <div style={successStyle}>Sponsor banner submitted successfully.</div>
          )}
          <button
            type="button"
            onClick={() => cardMutation.mutate()}
            disabled={!canSubmitCard}
            style={{
              ...submitBtnStyle,
              opacity: canSubmitCard ? 1 : 0.6,
              cursor: canSubmitCard ? 'pointer' : 'not-allowed',
            }}
          >
            {isCardSubmitting ? 'Uploading…' : 'Submit sponsor banner'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Shared style constants ─────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.45rem 0.6rem',
  border: '1px solid #d1d5db',
  borderRadius: '5px',
  fontSize: '0.875rem',
  fontFamily: 'system-ui, sans-serif',
  color: '#111827',
  backgroundColor: '#fff',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.3rem',
};

const errorStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem',
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '5px',
  color: '#991b1b',
  fontSize: '0.8rem',
  marginBottom: '1rem',
};

const successStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem',
  backgroundColor: '#f0fdf4',
  border: '1px solid #86efac',
  borderRadius: '5px',
  color: '#166534',
  fontSize: '0.8rem',
  marginBottom: '1rem',
};

const submitBtnStyle: React.CSSProperties = {
  padding: '0.65rem 1.25rem',
  backgroundColor: '#1d4ed8',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};
