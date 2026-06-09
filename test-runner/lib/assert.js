export class AssertionError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AssertionError';
    this.code = options.code || 'GENERIC_ASSERTION_FAILURE';
    this.metrics = options.metrics || {};
    this.expected = options.expected;
    this.actual = options.actual;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      expected: this.expected,
      actual: this.actual,
      metrics: this.metrics,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export const assert = {
  that(condition, label, options = {}) {
    if (!condition) {
      throw new AssertionError(`Failed: ${label}`, {
        code: options.code || 'TRUTHY_FAILURE',
        metrics: options.metrics
      });
    }
  },

  truthy(value, label, options = {}) {
    if (!value) {
      throw new AssertionError(`Expected truthy value for: ${label}`, {
        code: options.code || 'TRUTHY_FAILURE',
        actual: value,
        expected: 'truthy'
      });
    }
  },

  equal(actual, expected, label, options = {}) {
    if (actual !== expected) {
      throw new AssertionError(`Equality failure: ${label}`, {
        code: options.code || 'EQUALITY_FAILURE',
        actual,
        expected
      });
    }
  },

  async eventually(fn, { timeout = 30000, interval = 1000, label = 'eventually', code = 'TIMEOUT' } = {}) {
    const start = Date.now();
    let lastError = null;
    while (Date.now() - start < timeout) {
      try {
        if (await fn()) return;
      } catch (e) {
        lastError = e;
      }
      await new Promise(r => setTimeout(r, interval));
    }
    throw new AssertionError(`Timeout: ${label} (after ${timeout}ms)`, {
      code,
      metrics: { duration: Date.now() - start, timeout },
      actual: lastError?.message || 'Condition never met'
    });
  },

  metric(name, value) {
    return {
      toBeLessThan(threshold, label, options = {}) {
        if (value >= threshold) {
          throw new AssertionError(
            `Metric out of bounds: ${label ?? name} (expected < ${threshold}, got ${value})`,
            {
              code: options.code || 'METRIC_THRESHOLD_EXCEEDED',
              metrics: { [name]: value },
              expected: `< ${threshold}`,
              actual: value
            }
          );
        }
      },
      toBeGreaterThan(threshold, label, options = {}) {
        if (value <= threshold) {
          throw new AssertionError(
            `Metric out of bounds: ${label ?? name} (expected > ${threshold}, got ${value})`,
            {
              code: options.code || 'METRIC_THRESHOLD_VIOLATED',
              metrics: { [name]: value },
              expected: `> ${threshold}`,
              actual: value
            }
          );
        }
      }
    };
  }
};
