/**
 * Emergency trigger — two-page flow, NOT a dialog.
 * Constitutional: emergency trigger requires two full confirmation steps.
 * Using AlertDialog is a code review rejection.
 */
import { useState } from 'react';
import { useMutationGuard } from '../../hooks/useMutationGuard.js';
import { api } from '../../lib/api-client.js';

type EmergencyType = 'VENUE_EMERGENCY' | 'COMPLIANCE' | 'EQUIPMENT_FAILURE' | 'OTHER';

interface Props {
  venueId: string;
  venueName: string;
  screenCount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'select' | 'confirm';

export function EmergencyTriggerFlow({ venueId, venueName, screenCount, onSuccess, onCancel }: Props): JSX.Element {
  const [step, setStep] = useState<Step>('select');
  const [emergencyType, setEmergencyType] = useState<EmergencyType>('VENUE_EMERGENCY');
  const [note, setNote] = useState('');

  const trigger = useMutationGuard(
    (data: { venue_id: string; emergency_type: EmergencyType; note: string }) =>
      api.post('/emergency/trigger', data),
    { onSuccess },
  );

  if (step === 'select') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          Select Emergency Type
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {(['VENUE_EMERGENCY', 'COMPLIANCE', 'EQUIPMENT_FAILURE', 'OTHER'] as EmergencyType[]).map((type) => (
            <label key={type} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem', border: `2px solid ${emergencyType === type ? '#dc2626' : '#e5e7eb'}`,
              borderRadius: '6px', cursor: 'pointer',
            }}>
              <input
                type="radio"
                name="emergency_type"
                value={type}
                checked={emergencyType === type}
                onChange={() => setEmergencyType(type)}
              />
              {type.replace('_', ' ')}
            </label>
          ))}
        </div>

        {emergencyType === 'COMPLIANCE' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Compliance note (required)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the compliance issue..."
              style={{ width: '100%', height: '80px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} style={secondaryButtonStyle}>Cancel</button>
          <button
            onClick={() => setStep('confirm')}
            disabled={emergencyType === 'COMPLIANCE' && note.length < 10}
            style={{ ...primaryButtonStyle, backgroundColor: '#dc2626' }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // Confirmation page — full page, not a dialog
  return (
    <div style={{
      maxWidth: '480px', margin: '0 auto', padding: '2rem',
      backgroundColor: '#fef2f2', minHeight: '400px',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#991b1b', marginBottom: '1rem' }}>
        Confirm Emergency
      </h1>

      <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
        <p><strong>Venue:</strong> {venueName}</p>
        <p><strong>Screens affected:</strong> {screenCount}</p>
        <p><strong>Type:</strong> {emergencyType.replace('_', ' ')}</p>
        {note && <p><strong>Note:</strong> {note}</p>}
      </div>

      <p style={{ color: '#991b1b', marginBottom: '1.5rem' }}>
        This will activate emergency content on <strong>{screenCount} screens</strong> at{' '}
        <strong>{venueName}</strong> immediately. This action is logged and auditable.
      </p>

      {trigger.isError && (
        <div style={{ backgroundColor: '#fee2e2', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
          Error: {String(trigger.error)}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={() => setStep('select')} style={secondaryButtonStyle} disabled={trigger.isPending}>
          ← Back
        </button>
        <button
          onClick={() => trigger.mutate({ venue_id: venueId, emergency_type: emergencyType, note })}
          disabled={trigger.isPending}
          style={{ ...primaryButtonStyle, backgroundColor: '#dc2626', flex: 1 }}
        >
          {trigger.isPending ? 'Triggering...' : 'TRIGGER EMERGENCY'}
        </button>
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem', borderRadius: '6px', border: 'none',
  color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem', borderRadius: '6px',
  border: '1px solid #d1d5db', backgroundColor: '#fff',
  color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
};
