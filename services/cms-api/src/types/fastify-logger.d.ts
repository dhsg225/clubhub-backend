/**
 * Module augmentation to expose pino log methods on FastifyBaseLogger.
 *
 * Fastify 4.x + pino 9.x type compatibility issue: pino.BaseLogger members
 * are not visible on FastifyBaseLogger when esModuleInterop=false + NodeNext.
 * This augmentation makes them explicit without changing runtime behaviour.
 */
import type { LogFn } from 'pino';

declare module 'fastify' {
  interface FastifyBaseLogger {
    fatal: LogFn;
    error: LogFn;
    warn: LogFn;
    info: LogFn;
    debug: LogFn;
    trace: LogFn;
  }
}
