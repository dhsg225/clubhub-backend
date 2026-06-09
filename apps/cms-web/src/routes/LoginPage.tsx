/**
 * LoginPage — mock authentication for Phase 1.
 * Real auth (BL-012) will replace this with proper token-based auth.
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';

export function Component(): JSX.Element {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/';

  function signIn(): void {
    setAuth({
      principalId: 'dev-admin',
      role: 'PLATFORM_ADMIN',
      enterpriseId: null,
      venueId: null,
    });
    navigate(from, { replace: true });
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f9fafb',
    }}>
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '2rem',
        width: '320px',
      }}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 600 }}>ClubHub TV</h1>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>Operator Console</p>
        <button
          onClick={signIn}
          style={{
            width: '100%',
            padding: '0.625rem',
            backgroundColor: '#1d4ed8',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign in as Platform Admin (dev)
        </button>
        <p style={{ margin: '1rem 0 0', fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>
          Mock auth — real login coming in BL-012
        </p>
      </div>
    </div>
  );
}
