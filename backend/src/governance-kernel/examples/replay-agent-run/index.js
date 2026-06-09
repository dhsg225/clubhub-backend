'use strict';
/**
 * replay-agent-run/index.js
 *
 * Demonstrates replaying a recorded workflow execution trace.
 * Uses mock deps — no database required.
 *
 * Run: node index.js
 */

// Mock event bus (in-memory)
function createMockEventBus() {
  const handlers = [];
  return {
    subscribe: (pattern, handler) => { handlers.push({ pattern, handler }); return { unsubscribe: () => {} }; },
    emit: (event) => {
      for (const h of handlers) {
        if (event.event_type.startsWith(h.pattern.replace('*', ''))) {
          h.handler(event);
        }
      }
    },
  };
}

// Mock replay hooks
function createMockReplayHooks() {
  let _replayMode = false;
  return {
    enterReplay: (correlationId) => { _replayMode = true; },
    exitReplay:  () => { _replayMode = false; },
    isReplayMode: () => _replayMode,
    assertNotReplay: (op) => { if (_replayMode) throw new Error('REPLAY_ISOLATION_VIOLATION'); },
  };
}

// Mock SDK client
function createMockSDKClient() {
  return {
    isFrozen: async () => false,
    execute:  async (actionType, args) => ({ actionType, result: 'ok' }),
  };
}

const { ReplayClient } = require('../../../governance-sdk/replay-client');

async function main() {
  const eventBus    = createMockEventBus();
  const replayHooks = createMockReplayHooks();
  const sdkClient   = createMockSDKClient();

  // ── 1. Simulate a recorded workflow execution trace ───────────────────────
  const recordedTrace = {
    workflow_id: 'example-workflow',
    status:      'COMPLETED',
    steps: [
      { step_index: 2, action: 'audit.append', status: 'COMPLETED' },
      { step_index: 0, action: 'audit.append', status: 'COMPLETED' },  // out-of-order
      { step_index: 1, action: 'audit.append', status: 'COMPLETED' },  // will be sorted
    ],
  };
  console.log('[run] Simulating live workflow execution trace...');
  console.log('[run] Trace recorded: %d steps', recordedTrace.steps.length);

  // ── 2. Subscribe to replay events ────────────────────────────────────────
  const replayedStepIndices = [];
  eventBus.subscribe('sdk.*', (ev) => {
    console.log('[events]', ev.event_type, JSON.stringify(ev.payload));
    if (ev.event_type === 'sdk.replay.step') {
      replayedStepIndices.push(ev.payload.step_index);
    }
  });

  // ── 3. Replay via ReplayClient ────────────────────────────────────────────
  const replayClient = new ReplayClient({ sdkClient, replayHooks, eventBus });

  console.log('[replay] Entering replay mode, correlation: replay-example-001');
  const result = await replayClient.replay(recordedTrace, 'replay-example-001');
  console.log('[replay] Exited replay mode (isReplayMode=%s)', replayHooks.isReplayMode());

  // ── 4. Verify steps were replayed in step_index order ────────────────────
  const inOrder = replayedStepIndices.every((v, i) => i === 0 || v >= replayedStepIndices[i - 1]);
  if (inOrder && result.replayed_steps === 3) {
    console.log('[verify] %d steps replayed in step_index order ✓', result.replayed_steps);
  } else {
    console.error('[verify] FAIL: step order not deterministic!', replayedStepIndices);
    process.exit(1);
  }

  console.log('[done] Replay agent run example complete');
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
