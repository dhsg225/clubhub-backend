import React from 'react';
import { ConstitutionalMutationBlockedError } from '../../lib/api-client.js';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    const error = this.state.error;

    if (error instanceof ConstitutionalMutationBlockedError) {
      return (
        <div role="alert" style={{ padding: '1rem', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px' }}>
          <strong>Operation not available</strong>
          <p style={{ marginTop: '0.5rem', color: '#92400e' }}>
            {error.reason === 'SYSTEM_READ_ONLY'
              ? 'The system is in Read-Only mode. Content changes are temporarily unavailable.'
              : 'The system is in Constitutional Freeze. All operations are suspended.'}
          </p>
        </div>
      );
    }

    return this.props.fallback ?? (
      <div role="alert" style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
        <strong>Something went wrong</strong>
        <p style={{ marginTop: '0.5rem', color: '#991b1b', fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {error?.message}
        </p>
      </div>
    );
  }
}
