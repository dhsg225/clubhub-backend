"use strict";
/**
 * INV-10: Output Completeness
 *
 * Every field defined in the PRE_Output type must be present in the output.
 * No field may be undefined or absent. Fields that have no applicable value
 * must be null (not missing). This ensures the output is a complete, stable
 * record that downstream consumers can rely on unconditionally.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.10
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §3 (Output Schema)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
/** All required top-level fields in PRE_Output */
const REQUIRED_OUTPUT_FIELDS = [
    'screen_id',
    'resolved_at',
    'resolution_level',
    'is_fallback',
    'confidence_score',
    'playlist',
    'content_mix',
    'reason_trace',
    'playlist_checksum',
    'version',
    'output_schema_version',
];
/** Required fields in content_mix */
const REQUIRED_CONTENT_MIX_FIELDS = [
    'campaign_pct',
    'sponsor_pct',
    'override_pct',
    'fallback_pct',
    'system_pct',
];
/** Required fields in reason_trace */
const REQUIRED_REASON_TRACE_FIELDS = [
    'level_0_emergency',
    'level_1_operational',
    'level_2_scheduled',
    'level_3_campaign',
    'level_4_sponsorship',
    'level_5_structural',
    'level_6_device_truth',
];
/** Required fields in each playlist item */
const REQUIRED_PLAYLIST_ITEM_FIELDS = [
    'content_id',
    'duration_ms',
    'weight',
    'source',
    'sponsored',
];
(0, index_1.registerInvariant)({
    id: 'INV-10',
    description: 'All PRE_Output fields present; no absent fields; null used for N/A, not absent',
    severity: 'CONSTITUTIONAL_BREACH',
    assert(output, _input) {
        const out = output;
        // 1. Top-level fields
        const missingTopLevel = REQUIRED_OUTPUT_FIELDS.filter(field => !(field in out));
        if (missingTopLevel.length > 0) {
            return {
                invariantId: 'INV-10',
                passed: false,
                severity: 'CONSTITUTIONAL_BREACH',
                message: `Output completeness violation: missing top-level fields: [${missingTopLevel.join(', ')}]`,
                detail: { missing: missingTopLevel },
            };
        }
        // 2. content_mix fields
        const mix = out['content_mix'];
        if (mix && typeof mix === 'object') {
            const missingMix = REQUIRED_CONTENT_MIX_FIELDS.filter(f => !(f in mix));
            if (missingMix.length > 0) {
                return {
                    invariantId: 'INV-10',
                    passed: false,
                    severity: 'CONSTITUTIONAL_BREACH',
                    message: `Output completeness violation: missing content_mix fields: [${missingMix.join(', ')}]`,
                    detail: { missing: missingMix },
                };
            }
        }
        else {
            return {
                invariantId: 'INV-10',
                passed: false,
                severity: 'CONSTITUTIONAL_BREACH',
                message: 'content_mix is missing or not an object',
            };
        }
        // 3. reason_trace fields — all must be present (null is OK, absent is not)
        const trace = out['reason_trace'];
        if (trace && typeof trace === 'object') {
            const missingTrace = REQUIRED_REASON_TRACE_FIELDS.filter(f => !(f in trace));
            if (missingTrace.length > 0) {
                return {
                    invariantId: 'INV-10',
                    passed: false,
                    severity: 'CONSTITUTIONAL_BREACH',
                    message: `Output completeness violation: missing reason_trace fields: [${missingTrace.join(', ')}]`,
                    detail: { missing: missingTrace },
                };
            }
        }
        else {
            return {
                invariantId: 'INV-10',
                passed: false,
                severity: 'CONSTITUTIONAL_BREACH',
                message: 'reason_trace is missing or not an object',
            };
        }
        // 4. playlist item fields
        const playlist = out['playlist'];
        if (Array.isArray(playlist)) {
            for (let i = 0; i < playlist.length; i++) {
                const item = playlist[i];
                if (!item || typeof item !== 'object') {
                    return {
                        invariantId: 'INV-10',
                        passed: false,
                        severity: 'CONSTITUTIONAL_BREACH',
                        message: `playlist[${i}] is not an object`,
                    };
                }
                const missingItem = REQUIRED_PLAYLIST_ITEM_FIELDS.filter(f => !(f in item));
                if (missingItem.length > 0) {
                    return {
                        invariantId: 'INV-10',
                        passed: false,
                        severity: 'CONSTITUTIONAL_BREACH',
                        message: `playlist[${i}] missing fields: [${missingItem.join(', ')}]`,
                        detail: { index: i, missing: missingItem, content_id: item['content_id'] },
                    };
                }
            }
        }
        // 5. confidence_score must be in [0, 1]
        const cs = out['confidence_score'];
        if (typeof cs !== 'number' || cs < 0 || cs > 1) {
            return {
                invariantId: 'INV-10',
                passed: false,
                severity: 'CONSTITUTIONAL_BREACH',
                message: `confidence_score=${cs} is out of range [0, 1]`,
            };
        }
        return {
            invariantId: 'INV-10',
            passed: true,
            severity: 'CONSTITUTIONAL_BREACH',
            message: `Output completeness holds: all required fields present in output, content_mix, reason_trace, and all ${output.playlist.length} playlist items`,
        };
    },
});
//# sourceMappingURL=inv10-output-completeness.js.map