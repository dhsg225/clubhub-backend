/**
 * EMERGENCY_FREEZE overlay — sponsor portal variant.
 * Same constitutional guarantee as cms-web: unconditional rendering at z-index 9999.
 */

import { create } from 'zustand';
import type { ConstitutionalState } from '@clubhub/constitutional-types';

interface ConstitutionalStore {
  state: ConstitutionalState;
  reason: string | null;
  setConstitutionalState: (state: ConstitutionalState, reason: string | null) => void;
}

const useConstitutionalStore = create<ConstitutionalStore>((set) => ({
  state: 'HEALTHY',
  reason: null,
  setConstitutionalState: (state, reason) => set({ state, reason }),
}));

export function useConstitutionalState(): Pick<ConstitutionalStore, 'state' | 'reason'> {
  return useConstitutionalStore((s) => ({ state: s.state, reason: s.reason }));
}

export function ConstitutionalStateOverlay(): JSX.Element | null {
  const { state, reason } = useConstitutionalState();

  if (state !== 'EMERGENCY_FREEZE' && state !== 'READ_ONLY') return null;

  if (state === 'EMERGENCY_FREEZE') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: '#1a0000',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          padding: '2rem',
        }}
        role="alert"
        aria-live="assertive"
      >
        <h1 style={{ fontSize: '2rem', color: '#ff4444', marginBottom: '1rem' }}>
          SYSTEM FREEZE ACTIVE
        </h1>
        <p style={{ maxWidth: '600px', textAlign: 'center', lineHeight: 1.6 }}>
          The platform has temporarily paused operations. Sponsor reports and campaign data
          remain available. No changes can be submitted until the freeze is lifted.
        </p>
        <p style={{ marginTop: '1rem', color: '#aaa' }}>
          Reason: {reason ?? 'Platform integrity check in progress'}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        backgroundColor: '#7c4a00',
        color: '#fff',
        padding: '0.75rem 1.5rem',
        textAlign: 'center',
      }}
      role="status"
    >
      Platform is in Read-Only mode. Submissions are temporarily blocked. {reason ?? ''}
    </div>
  );
}
