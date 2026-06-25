'use strict';
/**
 * TopologyConsistencyCertification
 *
 * TCC-01: topology-manager.js exists
 * TCC-02: ENTITY_TYPES has required types
 * TCC-03: functional — register() stores entity
 * TCC-04: functional — getByType() returns correct entities
 * TCC-05: functional — link() creates bidirectional edge
 * TCC-06: functional — getRelated() returns linked entities
 * TCC-07: functional — deregister() removes entity
 * TCC-08: functional — register duplicate id throws
 * TCC-09: functional — snapshot() has entity_count
 * TCC-10: functional — emits registration event
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

class TopologyConsistencyCertification {
  async run() {
    const checks = [
      this._exists('TCC-01', 'topology-manager.js', 'TopologyManager',   'topology-manager.js exists'),
      this._exists('TCC-02', 'topology-manager.js', 'OPERATOR_SESSION',  'ENTITY_TYPES has all types'),
      this._register_stores(),
      this._get_by_type(),
      this._link_bidirectional(),
      this._get_related(),
      this._deregister_removes(),
      this._duplicate_throws(),
      this._snapshot_count(),
      this._emits_event(),
    ];
    return this._result('TopologyConsistencyCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _tm(extra = {}) {
    const { TopologyManager } = require('../topology-manager');
    return new TopologyManager(extra);
  }

  _register_stores() {
    const id = 'TCC-03'; const desc = 'register() stores entity';
    try {
      const tm = this._tm();
      tm.register('rt1', 'RUNTIME', { label: 'test' });
      if (!tm.get('rt1')) return { id, description: desc, status: 'FAIL', detail: 'entity not stored' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _get_by_type() {
    const id = 'TCC-04'; const desc = 'getByType() returns correct entities';
    try {
      const tm = this._tm();
      tm.register('ag1', 'AGENT',   {});
      tm.register('rt1', 'RUNTIME', {});
      const agents = tm.getByType('AGENT');
      if (agents.length !== 1 || agents[0].id !== 'ag1')
        return { id, description: desc, status: 'FAIL', detail: `agents: ${JSON.stringify(agents.map(a=>a.id))}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _link_bidirectional() {
    const id = 'TCC-05'; const desc = 'link() creates bidirectional edge';
    try {
      const tm = this._tm();
      tm.register('a', 'AGENT',    {});
      tm.register('b', 'WORKFLOW', {});
      tm.link('a', 'b');
      const relA = tm.getRelated('a').map(e => e.id);
      const relB = tm.getRelated('b').map(e => e.id);
      if (!relA.includes('b') || !relB.includes('a'))
        return { id, description: desc, status: 'FAIL', detail: 'not bidirectional' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _get_related() {
    const id = 'TCC-06'; const desc = 'getRelated() returns linked entities';
    try {
      const tm = this._tm();
      tm.register('x', 'RUNTIME',  {});
      tm.register('y', 'WORKFLOW', {});
      tm.link('x', 'y');
      const rel = tm.getRelated('x');
      if (!rel.some(e => e.id === 'y'))
        return { id, description: desc, status: 'FAIL', detail: 'related not found' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _deregister_removes() {
    const id = 'TCC-07'; const desc = 'deregister() removes entity';
    try {
      const tm = this._tm();
      tm.register('del1', 'RUNTIME', {});
      const ok = tm.deregister('del1');
      if (!ok || tm.get('del1') !== null)
        return { id, description: desc, status: 'FAIL', detail: 'entity not removed' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _duplicate_throws() {
    const id = 'TCC-08'; const desc = 'register duplicate id throws';
    try {
      const tm = this._tm();
      tm.register('dup', 'RUNTIME', {});
      let threw = false;
      try { tm.register('dup', 'RUNTIME', {}); } catch (_) { threw = true; }
      if (!threw) return { id, description: desc, status: 'FAIL', detail: 'should throw on duplicate' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _snapshot_count() {
    const id = 'TCC-09'; const desc = 'snapshot() has entity_count';
    try {
      const tm   = this._tm();
      tm.register('s1', 'RUNTIME', {});
      const snap = tm.snapshot();
      if (snap.entity_count !== 1)
        return { id, description: desc, status: 'FAIL', detail: `entity_count: ${snap.entity_count}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _emits_event() {
    const id = 'TCC-10'; const desc = 'register emits topology event';
    try {
      const events = [];
      const tm = this._tm({ eventBus: { emit: (t) => events.push(t) } });
      tm.register('ev1', 'RUNTIME', {});
      if (!events.includes('platform.topology.registered'))
        return { id, description: desc, status: 'FAIL', detail: 'event not emitted' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { TopologyConsistencyCertification };
