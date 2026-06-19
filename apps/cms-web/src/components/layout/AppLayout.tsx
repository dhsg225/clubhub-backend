import { Outlet, NavLink, useParams } from 'react-router-dom';
import { useConstitutionalState } from '../../stores/constitutionalStore.js';
import { useAuthStore } from '../../stores/authStore.js';

export function AppLayout(): JSX.Element {
  const { state } = useConstitutionalState();
  const { role } = useAuthStore();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <nav style={{ width: '240px', borderRight: '1px solid #e5e7eb', padding: '1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>ClubHub TV</span>
          {state !== 'HEALTHY' && (
            <div style={{
              marginTop: '0.5rem', padding: '0.25rem 0.5rem',
              backgroundColor: '#fef3c7', color: '#92400e',
              borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
            }}>
              {state}
            </div>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {(role === 'ENTERPRISE_ADMIN' || role === 'PLATFORM_ADMIN') && (
            <NavLink to="/fleet" style={navLinkStyle}>Fleet</NavLink>
          )}
          <NavLink to="/venues" style={navLinkStyle}>Venues</NavLink>
          <NavLink to="/campaigns" style={navLinkStyle}>Campaigns</NavLink>
          <NavLink to="/playlists" style={navLinkStyle}>Playlists</NavLink>
          <NavLink to="/templates" style={navLinkStyle}>Templates</NavLink>
          {(role === 'AUDITOR' || role === 'ENTERPRISE_ADMIN' || role === 'PLATFORM_ADMIN') && (
            <NavLink to="/audit" style={navLinkStyle}>Audit</NavLink>
          )}
          {role === 'PLATFORM_ADMIN' && (
            <NavLink to="/constitutional" style={{ ...navLinkStyle({ isActive: false }), color: '#dc2626' }}>
              Constitutional
            </NavLink>
          )}
        </nav>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  display: 'block',
  padding: '0.5rem 0.75rem',
  borderRadius: '6px',
  textDecoration: 'none',
  color: isActive ? '#1d4ed8' : '#374151',
  backgroundColor: isActive ? '#eff6ff' : 'transparent',
  fontWeight: isActive ? 600 : 400,
  fontSize: '0.875rem',
});
