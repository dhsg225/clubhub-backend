import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
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
  { path: '/preview-campaigns', lazy: () => import('./routes/__mockups__/CampaignList.js') },
  {
    element: (
      <RequireAuth requiredRole={ALL_ROLES}>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      { path: '/preview/content/:id', lazy: () => import('./routes/ContentPreview.js') },
      { path: '/preview/playlist/:id', lazy: () => import('./routes/PlaylistPreview.js') },
      { path: '/preview/screen/:screenId', lazy: () => import('./routes/ScreenPreview.js') },
      {
        path: '/preview/layout/:slug',
        lazy: async () => {
          const mod = await import('./routes/ScreenPreview.js');
          return { Component: mod.LayoutPreviewComponent };
        },
      },
    ],
  },
  {
    element: (
      <RequireAuth requiredRole={ALL_ROLES}>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/', lazy: () => import('./routes/FleetDashboard.js') },
      { path: '/fleet', lazy: () => import('./routes/FleetDashboard.js') },
      { path: '/venues', element: <Navigate to="/" replace /> },
      { path: '/venues/:venueId', lazy: () => import('./routes/VenueDashboard.js') },
      { path: '/campaigns', lazy: () => import('./routes/CampaignList.js') },
      { path: '/playlists', lazy: () => import('./routes/PlaylistList.js') },
      { path: '/playlists/new', lazy: () => import('./routes/PlaylistComposer.js') },
      { path: '/playlists/:id', lazy: () => import('./routes/PlaylistComposer.js') },
      { path: '/schedules', lazy: () => import('./routes/ScheduleList.js') },
      { path: '/schedules/new', lazy: () => import('./routes/ScheduleCreator.js') },
      { path: '/content/new', lazy: () => import('./routes/ContentNew.js') },
      { path: '/content/:id/edit', lazy: () => import('./routes/ContentEdit.js') },
      { path: '/content/:id', lazy: () => import('./routes/ContentDetail.js') },
      { path: '/ticker', lazy: () => import('./routes/TickerManager.js') },
      { path: '/layouts', lazy: () => import('./routes/LayoutBuilder.js') },
      {
        path: '/layouts/new',
        lazy: async () => {
          const mod = await import('./routes/LayoutBuilder.js');
          return { Component: mod.LayoutEditor };
        },
      },
      {
        path: '/layouts/:slug/edit',
        lazy: async () => {
          const mod = await import('./routes/LayoutBuilder.js');
          return { Component: mod.LayoutEditor };
        },
      },
      { path: '/templates', lazy: () => import('./routes/TemplateGallery.js') },
      { path: '/templates/author', lazy: () => import('./routes/TemplateAuthor.js') },
      { path: '/audit', lazy: () => import('./routes/AuditLog.js') },
      { path: '/constitutional', lazy: () => import('./routes/ConstitutionalConsole.js') },
      { path: '/widgets', lazy: () => import('./routes/WidgetGallery.js') },
      { path: '/help', lazy: () => import('./routes/HelpCenter.js') },
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
