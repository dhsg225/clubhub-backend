'use strict';
/**
 * platform-health.js — deployment health check probe.
 * Returns structured health report for orchestrators (K8s, Docker).
 */

class PlatformHealthCheck {
  constructor({ platformRuntime } = {}) {
    this._runtime = platformRuntime ?? null;
  }

  check() {
    if (!this._runtime) return { status: 'UNKNOWN', reason: 'platform_runtime_not_configured' };
    const snap     = this._runtime.health.snapshot();
    const lifecycle= this._runtime.lifecycle.getState();
    const ok       = snap.overall === 'HEALTHY' && lifecycle === 'ACTIVE';
    return {
      status:    ok ? 'HEALTHY' : snap.overall,
      lifecycle,
      health:    snap,
      checked_at:Date.now(),
    };
  }

  isReady()  {
    const c = this.check();
    return c.status === 'HEALTHY' && c.lifecycle === 'ACTIVE';
  }

  isAlive()  {
    const c = this.check();
    return c.lifecycle !== 'TERMINATED';
  }
}

module.exports = { PlatformHealthCheck };
