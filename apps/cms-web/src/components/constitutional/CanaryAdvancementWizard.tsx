/**
 * Canary stage advancement — two-step, requires typed human approval token >=8 chars.
 * Constitutional: no skip-to-any-stage. Sequential only.
 * Human approval token: no autocomplete, no spellcheck, no copy-paste suppression.
 */
import { useState } from 'react';
import { useMutationGuard } from '../../hooks/useMutationGuard.js';
import { api } from '../../lib/api-client.js';
import type { CanaryStage } from '@clubhub/constitutional-types';
import { CANARY_STAGE_ORDER } from '@clubhub/constitutional-types';

interface GateData {
  parity_ratio: number;
  class3_count: number;
  class4_count: number;
  invocation_count: number;
  can_advance: boolean;
  block_reason: string | null;
}

interface Props {
  currentStage: CanaryStage;
  enterpriseId: string;
  gateData: GateData;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CanaryAdvancementWizard({
  currentStage, enterpriseId, gateData, onSuccess, onCancel
}: Props): JSX.Element | null {
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'review' | 'authorize'>('review');

  const currentIndex = CANARY_STAGE_ORDER.indexOf(currentStage);
  const nextStage = CANARY_STAGE_ORDER[currentIndex + 1];

  if (!nextStage) return null; // AUTHORITATIVE — no further stages

  const advance = useMutationGuard(
    (data: { enterprise_id: string; from_stage: CanaryStage; to_stage: CanaryStage; human_approval_token: string }) =>
      api.post('/canary/advance', data),
    { onSuccess },
  );

  const tokenValid = token.trim().length >= 8;

  if (step === 'review') {
    return (
      <div style={{ maxWidth: '520px', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
          Canary Advancement: {currentStage} → {nextStage}
        </h2>

        <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.25rem 0', color: '#6b7280' }}>Parity ratio (24h)</td>
                <td style={{ fontWeight: 600, color: gateData.parity_ratio >= 0.999 ? '#16a34a' : '#dc2626' }}>
                  {(gateData.parity_ratio * 100).toFixed(3)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', color: '#6b7280' }}>CLASS_3 divergences</td>
                <td style={{ fontWeight: 600, color: gateData.class3_count === 0 ? '#16a34a' : '#dc2626' }}>
                  {gateData.class3_count}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', color: '#6b7280' }}>CLASS_4 divergences</td>
                <td style={{ fontWeight: 600, color: gateData.class4_count === 0 ? '#16a34a' : '#dc2626' }}>
                  {gateData.class4_count}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', color: '#6b7280' }}>Invocations</td>
                <td style={{ fontWeight: 600, color: gateData.invocation_count >= 1000 ? '#16a34a' : '#d97706' }}>
                  {gateData.invocation_count.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {!gateData.can_advance && (
          <div style={{ backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', color: '#991b1b' }}>
            Gate not met: {gateData.block_reason}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={secondaryButtonStyle}>Cancel</button>
          <button
            onClick={() => setStep('authorize')}
            disabled={!gateData.can_advance}
            style={primaryButtonStyle}
          >
            Proceed to Authorization →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '520px', padding: '1.5rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
        Enter Authorization Token
      </h2>
      <p style={{ color: '#374151', marginBottom: '1rem', fontSize: '0.875rem' }}>
        Canary advancement to <strong>{nextStage}</strong> requires your constitutional authorization token.
        This token is logged with this advancement event.
      </p>
      <input
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Enter authorization token (min 8 characters)"
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%', padding: '0.75rem', border: `2px solid ${tokenValid ? '#16a34a' : '#d1d5db'}`,
          borderRadius: '6px', fontFamily: 'monospace', marginBottom: '1rem',
        }}
      />
      {token.length > 0 && token.length < 8 && (
        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '1rem' }}>
          Token must be at least 8 characters ({token.length}/8)
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={() => setStep('review')} style={secondaryButtonStyle}>← Back</button>
        <button
          onClick={() => advance.mutate({
            enterprise_id: enterpriseId,
            from_stage: currentStage,
            to_stage: nextStage,
            human_approval_token: token,
          })}
          disabled={!tokenValid || advance.isPending}
          style={primaryButtonStyle}
        >
          {advance.isPending ? 'Advancing...' : `Advance to ${nextStage}`}
        </button>
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem', borderRadius: '6px', border: 'none',
  backgroundColor: '#1d4ed8', color: '#fff',
  fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
};
const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem', borderRadius: '6px',
  border: '1px solid #d1d5db', backgroundColor: '#fff',
  color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
};
