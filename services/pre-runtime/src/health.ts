export interface HealthStatus {
  readonly service: 'pre-runtime';
  readonly ts: number;
  readonly corpus_version: string | null;
  readonly last_resolve_at: number | null;
  readonly ws_clients_connected: number;
  readonly audit_queue_depth: number;
}

export function buildHealthStatus(params: {
  corpusVersion: string | null;
  lastResolveAt: number | null;
  wsClientsConnected: number;
  auditQueueDepth: number;
}): HealthStatus {
  return {
    service: 'pre-runtime',
    ts: Date.now(),
    corpus_version: params.corpusVersion,
    last_resolve_at: params.lastResolveAt,
    ws_clients_connected: params.wsClientsConnected,
    audit_queue_depth: params.auditQueueDepth,
  };
}
