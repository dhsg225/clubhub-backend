import fs from 'node:fs';
import path from 'node:path';

export class Reporter {
  constructor(options = {}) {
    this.ci = options.ci ?? false;
    this.runId = options.runId || new Date().toISOString().replace(/[:.]/g, '-');
    this.suiteName = '';
    this.tests = [];
    this.startTime = Date.now();
    this.reportsDir = options.reportsDir || path.resolve(process.cwd(), 'reports');
    this.metrics = null; // Set by runner
  }

  begin(suiteName) {
    this.suiteName = suiteName;
    if (!this.ci) {
      console.log(`\nStarting Suite: ${suiteName}`);
      console.log('='.repeat(40));
    }
  }

  test(name) {
    const t = { name, status: 'running', startTime: Date.now() };
    this.tests.push(t);

    return {
      pass: (metrics = {}) => {
        t.status = 'passed';
        t.duration = Date.now() - t.startTime;
        t.metrics = metrics;
        if (!this.ci) console.log(`✅ ${name} (${t.duration}ms)`);
      },
      fail: (err) => {
        t.status = 'failed';
        t.duration = Date.now() - t.startTime;
        t.error = err.message;
        t.code = err.code || 'UNKNOWN_ERROR';
        t.metrics = err.metrics || {};
        t.stack = err.stack;
        if (!this.ci) console.log(`❌ ${name} (${t.duration}ms)\n   [${t.code}] ${err.message}`);
      },
      skip: (reason) => {
        t.status = 'skipped';
        t.reason = reason;
        if (!this.ci) console.log(`⏭️ ${name} (skipped: ${reason})`);
      }
    };
  }

  async finish(globalMetricsSummary = {}) {
    const passed = this.tests.filter(t => t.status === 'passed').length;
    const failed = this.tests.filter(t => t.status === 'failed').length;
    const skipped = this.tests.filter(t => t.status === 'skipped').length;
    const total = this.tests.length;
    const duration = Date.now() - this.startTime;

    const report = {
      run_id: this.runId,
      suite: this.suiteName,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      summary: {
        total,
        passed,
        failed,
        skipped,
        status: failed === 0 ? 'PASS' : 'FAIL'
      },
      metrics: globalMetricsSummary,
      tests: this.tests.map(t => ({
        name: t.name,
        status: t.status,
        duration_ms: t.duration,
        error: t.error,
        code: t.code,
        metrics: t.metrics,
        reason: t.reason
      }))
    };

    // Save JSON reports
    this._saveJsonReport(report);

    // Print Human Readable Summary
    this._printHumanSummary(report);

    return failed === 0;
  }

  _saveJsonReport(report) {
    try {
      const historyDir = path.join(this.reportsDir, 'history');
      if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

      const filename = `${this.runId}-${this.suiteName.replace(/\s+/g, '_').toLowerCase()}.json`;
      const historyPath = path.join(historyDir, filename);
      const latestPath = path.join(this.reportsDir, 'latest.json');

      const json = JSON.stringify(report, null, 2);
      fs.writeFileSync(historyPath, json);
      fs.writeFileSync(latestPath, json);
    } catch (err) {
      console.error(`Failed to save JSON report: ${err.message}`);
    }
  }

  _printHumanSummary(report) {
    const { summary, metrics } = report;
    
    console.log('\n' + '='.repeat(40));
    console.log(`TEST SUITE: ${report.suite}`);
    console.log(`RUN ID: ${report.run_id}`);
    console.log(`DURATION: ${report.duration_ms}ms`);
    
    if (metrics && Object.keys(metrics).length > 0) {
      console.log('\nGLOBAL METRICS:');
      console.log(`- Poll Success Rate: ${metrics.poll_success_rate?.toFixed(2)}%`);
      console.log(`- P95 Latency: ${metrics.p95_latency_ms?.toFixed(2)}ms`);
      console.log(`- Max Offline Streak: ${metrics.max_offline_streak}`);
      console.log(`- Desync Count: ${metrics.desync_count}`);
      console.log(`- RECOVERY SCORE: ${metrics.recovery_score}/100`);
    }

    console.log('\nRESULT SUMMARY:');
    console.log(`- TOTAL TESTS: ${summary.total}`);
    console.log(`- PASSED: ${summary.passed}`);
    console.log(`- FAILED: ${summary.failed}`);
    console.log(`- SKIPPED: ${summary.skipped}`);

    if (summary.failed > 0) {
      console.log('\nFAILURES:');
      for (const t of this.tests.filter(t => t.status === 'failed')) {
        console.log(`- ${t.name}: [${t.code}] ${t.error}`);
        if (Object.keys(t.metrics).length > 0) {
          console.log(`  Test Metrics: ${JSON.stringify(t.metrics)}`);
        }
      }
    }

    console.log(`\nOVERALL STATUS: ${summary.status}`);
    console.log('='.repeat(40) + '\n');
  }
}
