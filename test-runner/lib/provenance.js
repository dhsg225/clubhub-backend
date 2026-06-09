/**
 * ProvenanceTracker — causal-chain + mutation-chain reconstruction for breaches.
 * Extended to include mutation provenance: originating mutation, impacted domains,
 * last legal transition, mutation chain in window.
 * Output: reports/failure-provenance.json
 */
export class ProvenanceTracker {
  constructor() { this._breaches = []; }

  /**
   * Record a threshold breach with full causal and mutation context.
   * @param {object} p
   *   threshold_key, value, threshold, operator, suite
   *   events        — MetricsCollector.events
   *   marks         — MetricsCollector.marks Map
   *   chaosTimeline — MetricsCollector.chaosTimeline
   *   mutationLog   — getMutationLog() array (optional)
   */
  recordBreach(p) {
    const { threshold_key, value, threshold, operator, suite,
            events, marks, chaosTimeline, mutationLog = [] } = p;

    const causal    = this._buildCausalChain(threshold_key, events, marks, chaosTimeline);
    const mutChain  = this._buildMutationChain(marks, mutationLog);

    this._breaches.push({
      threshold_key,
      value,
      threshold,
      operator,
      suite,
      chaos_trigger:          causal.chaos_trigger,
      first_offending_event:  causal.first_offending,
      contributing_events:    causal.contributing,
      impacted_screens:       causal.impacted_screens,
      causal_chain:           causal.chain,
      mutation_provenance: {
        originating_mutation:  mutChain.originating,
        impacted_domains:      mutChain.impacted_domains,
        last_legal_transition: mutChain.last_legal,
        first_illegal_transition: mutChain.first_illegal,
        mutation_chain:        mutChain.chain,
      },
    });
  }

  _buildCausalChain(threshold_key, events, marks, chaosTimeline) {
    let chaos_trigger = null, markTs = 0;
    for (const [name, ts] of marks) { if (ts > markTs) { chaos_trigger = name; markTs = ts; } }

    const windowStart  = markTs || 0;
    const windowEvents = events.filter(e => (e.internal_ts ?? 0) >= windowStart);

    let contributing = [];
    if (threshold_key.includes('poll_success_rate') || threshold_key.includes('p95_latency')) {
      contributing = windowEvents.filter(e => e.event === 'poll.success' || e.event === 'poll.failure').slice(-20);
    } else if (threshold_key.includes('desync')) {
      contributing = windowEvents.filter(e => e.event === 'poll.success').slice(-20);
    } else if (threshold_key.includes('recovery')) {
      contributing = windowEvents.filter(e => e.event === 'poll.failure' || e.event === 'poll.success').slice(-30);
    } else {
      contributing = windowEvents.slice(-20);
    }

    const impacted_screens = [...new Set(contributing.map(e => e.screen).filter(Boolean))];
    const first_offending  = contributing.find(e => e.event === 'poll.failure') ?? contributing[0] ?? null;
    const timelineInWindow = chaosTimeline.filter(c => !markTs || new Date(c.ts).getTime() >= windowStart);

    const chain = [
      ...timelineInWindow.map(c => ({ ...c, _chain_type: 'chaos_event' })),
      ...(first_offending ? [{ ...first_offending, _chain_type: 'first_offending' }] : []),
    ].sort((a, b) => {
      const ta = a.ts ? new Date(a.ts).getTime() : (a.internal_ts ?? 0);
      const tb = b.ts ? new Date(b.ts).getTime() : (b.internal_ts ?? 0);
      return ta - tb;
    });

    return { chain, first_offending, contributing, impacted_screens, chaos_trigger };
  }

  _buildMutationChain(marks, mutationLog) {
    if (!mutationLog.length) {
      return { originating: null, impacted_domains: [], last_legal: null, first_illegal: null, chain: [] };
    }

    // Window: after the most recent chaos mark
    let markTs = 0;
    for (const [, ts] of marks) { if (ts > markTs) markTs = ts; }

    const window = markTs
      ? mutationLog.filter(m => m.ts >= markTs)
      : mutationLog.slice(-30);

    const originating     = window[0] ?? null;
    const impacted_domains = [...new Set(window.map(m => m.domain))];
    const transitions      = window.filter(m => m.operation === 'TRANSITION');
    const last_legal       = transitions.at(-1) ?? null;
    // first_illegal: mutations with no matching hash (indicates skipped applyMutation)
    // In practice, all recorded mutations are legal; violations throw before recording.
    const first_illegal    = null;

    return { originating, impacted_domains, last_legal, first_illegal, chain: window };
  }

  hasBreaches() { return this._breaches.length > 0; }

  getReport() {
    return {
      generated_at: new Date().toISOString(),
      breach_count: this._breaches.length,
      breaches:     this._breaches,
    };
  }
}
