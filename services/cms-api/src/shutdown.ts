import { emit, base } from '@clubhub/telemetry-sdk';

type CleanupFn = () => Promise<void>;
const cleanupFns: CleanupFn[] = [];

export function registerCleanup(fn: CleanupFn): void {
  cleanupFns.push(fn);
}

export function setupGracefulShutdown(serviceName: string): void {
  const shutdown = async (signal: string): Promise<void> => {
    emit({ ...base('INFO', 'service.shutdown'), service: serviceName, signal } as Parameters<typeof emit>[0]);
    for (const fn of cleanupFns.reverse()) {
      await fn().catch((err: unknown) => {
        emit({ ...base('ERROR', 'service.shutdown_cleanup_error'), service: serviceName, error: String(err) } as Parameters<typeof emit>[0]);
      });
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
