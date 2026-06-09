import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ConstitutionalStateOverlay } from './components/constitutional/ConstitutionalStateOverlay.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
    mutations: { retry: 0 },
  },
});

const router = createBrowserRouter([
  { path: '/', lazy: () => import('./routes/SponsorDashboard.js') },
  { path: '/campaigns/:campaignId', lazy: () => import('./routes/CampaignDetail.js') },
  { path: '/reports', lazy: () => import('./routes/ComplianceReports.js') },
]);

export function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ConstitutionalStateOverlay />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
