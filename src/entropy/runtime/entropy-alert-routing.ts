/**
 * Entropy alert routing — advisory signals only.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §11
 *
 * Advisory only — never triggers auto-correction.
 */

export type AlertHandler = (alert: EntropyAlert) => void;

export interface EntropyAlert {
  venue_id: string;
  metric_id: string;
  advisory_tier: number;
  label: string;
  score: number;
  threshold_crossed: boolean;
  emitted_at: number;
}

export class EntropyAlertRouter {
  private handlers: AlertHandler[] = [];

  register(handler: AlertHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Route an entropy result to registered handlers.
   * Does NOT auto-correct — advisory signals only.
   */
  route(venueId: string, result: import('./venue-entropy-job').VenueEntropyResult): void {
    const report = result.report;
    const computedAt = result.computed_at;

    // Emit an alert for the composite venue score
    const alert: EntropyAlert = {
      venue_id: venueId,
      metric_id: 'composite',
      advisory_tier: report.advisory_tier,
      label: report.label,
      score: report.composite,
      threshold_crossed: report.advisory_tier >= 2,
      emitted_at: computedAt,
    };

    for (const handler of this.handlers) {
      try {
        handler(alert);
      } catch {
        // Handler failure must not propagate — advisory only
      }
    }
  }
}
