import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';

interface EntropyStatus {
  unresolved_critical: number;
  unresolved_warning: number;
}

export function EntropyAlertBadge({ venueId }: { venueId: string }): JSX.Element | null {
  const { data } = useQuery({
    queryKey: ['entropy-status', venueId],
    queryFn: () => api.get<EntropyStatus>(`/venues/${venueId}/entropy/status`),
    refetchInterval: 60_000, // refresh every minute
  });

  if (!data || (data.unresolved_critical === 0 && data.unresolved_warning === 0)) return null;

  const isCritical = data.unresolved_critical > 0;

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: '1.25rem', height: '1.25rem',
        backgroundColor: isCritical ? '#dc2626' : '#d97706',
        color: '#fff', borderRadius: '9999px',
        fontSize: '0.75rem', fontWeight: 700, padding: '0 0.25rem',
      }}
      title={`${data.unresolved_critical} critical, ${data.unresolved_warning} warning entropy alerts`}
    >
      {data.unresolved_critical + data.unresolved_warning}
    </span>
  );
}
