import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useConstitutionalState } from '../../stores/constitutionalStore.js';
import { useAuthStore } from '../../stores/authStore.js';

/* ── Collapsible nav tree item ─────────────────────────────────────── */

function NavTree({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children?: { to: string; label: string }[];
}): JSX.Element {
  const location = useLocation();
  const hasChildren = children && children.length > 0;

  // Auto-expand if current route matches the parent or any child
  const isParentActive = location.pathname === to || location.pathname.startsWith(to + '/');
  const isChildActive = children?.some(
    (c) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'),
  ) ?? false;

  const [open, setOpen] = useState(isParentActive || isChildActive);

  if (!hasChildren) {
    return <NavLink to={to} style={navLinkStyle}>{label}</NavLink>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '20px', height: '20px', padding: 0, border: 'none', background: 'none',
            cursor: 'pointer', color: '#9ca3af', fontSize: '0.6rem', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        >
          {open ? '▾' : '▸'}
        </button>
        <NavLink to={to} style={(props) => ({ ...navLinkStyle(props), flex: 1 })}>{label}</NavLink>
      </div>
      {open && (
        <div style={{ paddingLeft: '20px' }}>
          {children.map((child) => (
            <NavLink key={child.to} to={child.to} style={subLinkStyle}>
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main layout ───────────────────────────────────────────────────── */

export function AppLayout(): JSX.Element {
  const { state } = useConstitutionalState();
  const { role } = useAuthStore();
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={navOpen ? 'cms-layout cms-nav-open' : 'cms-layout'} style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Hamburger — hidden on desktop via responsive.css */}
      <button
        type="button"
        className="cms-hamburger"
        aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
        onClick={() => setNavOpen((o) => !o)}
      >
        {navOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar — collapsible */}
      <nav
        className="cms-sidebar"
        style={{
          width: sidebarCollapsed ? '48px' : '240px',
          borderRight: '1px solid #e5e7eb',
          padding: sidebarCollapsed ? '0.75rem 0.25rem' : '1rem',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Collapse / expand toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          marginBottom: sidebarCollapsed ? '0.5rem' : '2rem',
        }}>
          {!sidebarCollapsed && (
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>ClubHub TV</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: '#6b7280', fontSize: sidebarCollapsed ? '1rem' : '0.85rem',
              padding: '0.25rem', borderRadius: '4px', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {sidebarCollapsed ? '☰' : '◀'}
          </button>
        </div>

        {!sidebarCollapsed && state !== 'HEALTHY' && (
          <div style={{
            marginBottom: '1rem', padding: '0.25rem 0.5rem',
            backgroundColor: '#fef3c7', color: '#92400e',
            borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
          }}>
            {state}
          </div>
        )}

        {/* Nav links — hidden when collapsed */}
        {!sidebarCollapsed && (
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* ── Author — Russian doll: outermost → innermost ─── */}
          <div style={sectionBlock('#eff6ff')}>
            <div style={sectionLabelStyle}>Author</div>
            <NavTree to="/schedules" label="Schedules" children={[
              { to: '/schedules/new', label: 'New Schedule' },
            ]} />
            <NavTree to="/playlists" label="Playlists" children={[
              { to: '/playlists/new', label: 'New Playlist' },
            ]} />
            <NavTree to="/campaigns" label="Campaigns" children={[
              { to: '/content/new', label: 'New Card' },
            ]} />
          </div>

          {/* ── Content System — structural building blocks ──── */}
          <div style={sectionBlock('#f0fdf4')}>
            <div style={sectionLabelStyle}>Content System</div>
            <NavTree to="/layouts" label="Layouts" children={[
              { to: '/layouts/new', label: 'New Layout' },
            ]} />
            {role === 'PLATFORM_ADMIN' ? (
              <NavTree to="/templates" label="Templates" children={[
                { to: '/templates/author', label: 'Template Author' },
              ]} />
            ) : (
              <NavLink to="/templates" style={navLinkStyle}>Templates</NavLink>
            )}
            <NavLink to="/ticker" style={navLinkStyle}>Ticker</NavLink>
            <NavLink to="/widgets" style={navLinkStyle}>Widgets</NavLink>
          </div>

          {/* ── Operations — fleet, venues, system ──────────── */}
          <div style={sectionBlock('#f5f3ff')}>
            <div style={sectionLabelStyle}>Operations</div>
            {(role === 'ENTERPRISE_ADMIN' || role === 'PLATFORM_ADMIN') && (
              <NavLink to="/fleet" style={navLinkStyle}>Fleet</NavLink>
            )}
            <NavLink to="/venues" style={navLinkStyle}>Venues</NavLink>
            {(role === 'AUDITOR' || role === 'ENTERPRISE_ADMIN' || role === 'PLATFORM_ADMIN') && (
              <NavLink to="/audit" style={navLinkStyle}>Audit</NavLink>
            )}
            {role === 'PLATFORM_ADMIN' && (
              <NavLink to="/constitutional" style={{ ...navLinkStyle({ isActive: false }), color: '#dc2626' }}>
                Constitutional
              </NavLink>
            )}
          </div>

          {/* ── Help ──────────────────────────────────────────── */}
          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0.5rem 0' }} />
          <NavLink to="/help" style={navLinkStyle}>Help</NavLink>
        </nav>
        )}
      </nav>

      {/* Main content */}
      <main className="cms-main" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────── */

const sectionBlock = (tint: string): React.CSSProperties => ({
  backgroundColor: tint,
  borderRadius: '8px',
  padding: '0.35rem 0.25rem 0.5rem',
  marginBottom: '0.35rem',
});

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0.4rem 0.75rem 0.15rem',
};

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

const subLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  display: 'block',
  padding: '0.3rem 0.75rem',
  borderRadius: '5px',
  textDecoration: 'none',
  color: isActive ? '#1d4ed8' : '#6b7280',
  backgroundColor: isActive ? '#eff6ff' : 'transparent',
  fontWeight: isActive ? 600 : 400,
  fontSize: '0.78rem',
});
