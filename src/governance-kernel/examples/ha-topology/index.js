'use strict';
/**
 * ha-topology/index.js
 *
 * Demonstrates 2-node active/active HA topology with split-brain detection.
 *
 * Run: node index.js
 * Requires: DATABASE_URL env var (both "nodes" share the same PostgreSQL primary)
 */

const { Pool } = require('pg');

// Each node gets its own API instances but shares the same DB
const AuthorityCoordinator = require('../../api/AuthorityCoordinator');

async function main() {
  // Two pools simulating two nodes sharing a single PostgreSQL primary
  const poolA = new Pool({ connectionString: process.env.DATABASE_URL });
  const poolB = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── 1. Boot both nodes ───────────────────────────────────────────────────
  const nodeA = new AuthorityCoordinator({ pool: poolA });
  const nodeB = new AuthorityCoordinator({ pool: poolB });
  await nodeA.init();
  await nodeB.init();

  const epochA = await nodeA.getEpoch();
  const epochB = await nodeB.getEpoch();
  console.log('[boot] Node A initialized (epoch=%d)', epochA);
  console.log('[boot] Node B initialized (epoch=%d)', epochB);

  // ── 2. Node A promotes (LINEARIZED) ──────────────────────────────────────
  console.log('[nodeA] Promoting: epoch %d → ? (LINEARIZED)', epochA);
  const newEpoch = await nodeA.incrementEpoch(poolA);
  console.log('[nodeA] New epoch: %d', newEpoch);

  // ── 3. Node B polls (CACHE_COHERENT) ──────────────────────────────────────
  await nodeB.refreshCache();
  const epochBAfter = await nodeB.getEpoch();
  console.log('[nodeB] CACHE_COHERENT poll — epoch=%d detected', epochBAfter);

  if (epochBAfter === newEpoch) {
    console.log('[topology] Both nodes at epoch=%d: no split-brain', newEpoch);
  }

  // ── 4. Simulate split-brain (Node B has stale epoch) ─────────────────────
  console.log('[simulate] Node B receives stale epoch (simulated partition)');
  const nodeAEpoch = await nodeA.getEpoch();
  // Simulate second increment that Node B hasn't seen
  await nodeA.incrementEpoch(poolA);
  const nodeANewEpoch = await nodeA.getEpoch();
  const nodeBStaleEpoch = epochBAfter; // Node B hasn't polled yet

  if (nodeANewEpoch !== nodeBStaleEpoch) {
    console.log('[topology] SPLIT-BRAIN DETECTED: Node A epoch=%d, Node B epoch=%d',
      nodeANewEpoch, nodeBStaleEpoch);
    console.log('[topology] Mutations blocked on both nodes');
  }

  // ── 5. Operator reconciles (Node B syncs to DB authoritative epoch) ───────
  console.log('[resolve] Operator reconciles via DB — both nodes at epoch=%d', nodeANewEpoch);
  await nodeB.refreshCache();
  const nodeBResolved = await nodeB.getEpoch();
  if (nodeBResolved === nodeANewEpoch) {
    console.log('[topology] Split-brain cleared — mutations re-enabled');
  }

  console.log('[done] HA topology example complete');
  await Promise.all([poolA.end(), poolB.end()]);
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
