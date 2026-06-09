import { useConstitutionalState } from '../../stores/constitutionalStore.js';

/**
 * EMERGENCY_FREEZE overlay.
 * Constitutional constraint: always visible above all content.
 * No dismiss button. No timer. WebSocket-driven.
 */
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
          CONSTITUTIONAL FREEZE ACTIVE
        </h1>
        <p style={{ maxWidth: '600px', textAlign: 'center', lineHeight: 1.6 }}>
          The system has detected a data integrity issue and has paused all operations
          to protect content accuracy. Screens are displaying the last verified content.
        </p>
        <p style={{ marginTop: '1rem', color: '#aaa' }}>
          Reason: {reason ?? 'See ConstitutionalFreezeLog'}
        </p>
        <p style={{ marginTop: '2rem', color: '#888', fontSize: '0.875rem' }}>
          Platform administrators have been notified. No action is available here.
        </p>
      </div>
    );
  }

  // READ_ONLY banner
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
      System is in Read-Only mode. All content changes are blocked. {reason ?? ''}
    </div>
  );
}
