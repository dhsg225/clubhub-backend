import React, { useState, useRef } from 'react';
import { PromoSlideRenderer } from '@clubhub/shared';
import type { PromoSlideData } from '@clubhub/shared';
import { createContent, uploadAsset } from '../api';

export function CreateTab() {
  const [form, setForm] = useState<PromoSlideData>({ headline: '', subheadline: '', image: '' });
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(field: keyof PromoSlideData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus({ type: 'info', msg: 'Uploading image...' });
    try {
      const { url } = await uploadAsset(file);
      set('image', url);
      setStatus({ type: 'success', msg: 'Image uploaded.' });
    } catch (err: unknown) {
      setStatus({ type: 'error', msg: `Upload failed: ${(err as Error).message}` });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.headline.trim()) {
      setStatus({ type: 'error', msg: 'Headline is required.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await createContent('promo_slide', form);
      setStatus({ type: 'success', msg: 'Content saved. Go to Playlist to publish it.' });
      setForm({ headline: '', subheadline: '', image: '' });
    } catch (err: unknown) {
      setStatus({ type: 'error', msg: `Save failed: ${(err as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="layout-2col">
      {/* Form */}
      <div>
        <div className="card">
          <h2>New Promo Slide</h2>

          {status && <div className={`status-bar ${status.type}`}>{status.msg}</div>}

          <div className="form-group">
            <label>Headline *</label>
            <input
              type="text"
              value={form.headline}
              onChange={(e) => set('headline', e.target.value)}
              placeholder="e.g. Happy Hour Every Friday"
            />
          </div>

          <div className="form-group">
            <label>Sub-headline</label>
            <input
              type="text"
              value={form.subheadline ?? ''}
              onChange={(e) => set('subheadline', e.target.value)}
              placeholder="e.g. 5pm – 9pm, all drinks 50% off"
            />
          </div>

          <div className="form-group">
            <label>Image</label>
            <input
              type="text"
              value={form.image ?? ''}
              onChange={(e) => set('image', e.target.value)}
              placeholder="https://... or upload below"
            />
            {form.image && (
              <div className="image-preview">
                <img src={form.image} alt="preview" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <label className="file-upload-btn" onClick={() => fileRef.current?.click()}>
                {uploading ? 'Uploading…' : '↑ Upload image'}
              </label>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Content'}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div>
        <div className="preview-box">
          <div className="preview-label">Preview (1920×1080 scaled)</div>
          <div className="preview-viewport">
            <PromoSlideRenderer data={form} preview />
          </div>
        </div>
      </div>
    </div>
  );
}
