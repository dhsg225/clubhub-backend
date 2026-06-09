import { runReplayHarness } from '../src/verification/replay/harness';
import * as path from 'path';

runReplayHarness({
  corpusPath: path.resolve(__dirname, '../corpus'),
  outputPath: path.resolve(__dirname, '../replay-output'),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}).then((report: any) => {
  console.log('\n=== REPLAY REPORT ===');
  console.log('total:', report.total_packets);
  console.log('passed:', report.passed);
  console.log('failed:', report.failed);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (report.results || []) as any[]) {
    const passed = r.status === 'pass' || r.passed === true;
    const label = passed ? 'PASS' : 'FAIL';
    console.log('  [' + label + '] ' + r.packet_id + ' (' + r.packet_class + ')');
    if (!passed) {
      if (r.error_message) console.log('    error:', r.error_message);
      if (r.divergence) {
        console.log('    actual_hash:  ', r.actual_output_hash);
        console.log('    expected_hash:', r.expected_output_hash);
        const divFields = (r.divergence.fields || []).slice(0, 5);
        if (divFields.length) console.log('    diverged:', JSON.stringify(divFields));
      }
    }
  }
  process.exit(report.failed > 0 ? 1 : 0);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}).catch((err: any) => {
  console.error('Harness error:', err.message);
  console.error((err.stack || '').split('\n').slice(0, 8).join('\n'));
  process.exit(1);
});
