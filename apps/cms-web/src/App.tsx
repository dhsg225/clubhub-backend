import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ConstitutionalStateOverlay } from './components/constitutional/ConstitutionalStateOverlay.js';
import { WebSocketConstitutionalSync } from './components/constitutional/WebSocketConstitutionalSync.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { RequireAuth } from './components/auth/RequireAuth.js';
import type { UserRole } from './stores/authStore.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 }, // never retry mutations — constitutional safety
  },
});

const ALL_ROLES: UserRole[] = [
  'PLATFORM_ADMIN',
  'ENTERPRISE_ADMIN',
  'REGIONAL_MANAGER',
  'VENUE_OPERATOR',
  'SPONSOR_STAKEHOLDER',
  'AUDITOR',
];

const router = createBrowserRouter([
  { path: '/login', lazy: () => import('./routes/LoginPage.js') },
  { path: '/preview', lazy: () => import('./routes/__mockups__/FleetDashboard.mockup.js') },
  {
    element: (
      <RequireAuth requiredRole={ALL_ROLES}>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/', lazy: () => import('./routes/FleetDashboard.js') },
      { path: '/venues/:venueId', lazy: () => import('./routes/VenueDashboard.js') },
      { path: '/campaigns', lazy: () => import('./routes/CampaignList.js') },
      { path: '/constitutional', lazy: () => import('./routes/ConstitutionalConsole.js') },
    ],
  },
]);

export function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      {/* WebSocketConstitutionalSync drives constitutional state from server — mount at root */}
      <WebSocketConstitutionalSync />
      {/* ConstitutionalStateOverlay renders at z-index 9999 — unconditional */}
      <ConstitutionalStateOverlay />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
