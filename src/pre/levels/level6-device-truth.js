"use strict";
/**
 * LEVEL_6 — Device truth annotation.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §6.6
 * Always has outcome RESOLVED.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.annotateLevel6 = annotateLevel6;
const constants_1 = require("../constants");
function annotateLevel6(input, playlist, lastDelivery, playlistChecksum) {
    void playlist;
    if (lastDelivery === null) {
        const score = constants_1.CONFIDENCE_NO_DELIVERY_LOG;
        return {
            confidence_score: score,
            trace: {
                outcome: 'RESOLVED',
                reason: `L6:CONFIDENCE:${score.toFixed(4)},no_delivery_log`,
                confidence_score: score,
                last_seen_ms_ago: null, // corpus uses null (not -1)
                checksum_match: false,
            },
        };
    }
    const age = input.at - lastDelivery.delivered_at;
    const checksumMatch = lastDelivery.checksum === playlistChecksum;
    let score;
    let deliveryStatus;
    if (age > constants_1.CONFIDENCE_MAX_AGE_MS) {
        score = constants_1.CONFIDENCE_STALE;
        deliveryStatus = 'stale';
    }
    else if (!checksumMatch) {
        score = constants_1.CONFIDENCE_CHECKSUM_MISMATCH;
        deliveryStatus = 'checksum_mismatch';
    }
    else {
        score = constants_1.CONFIDENCE_FULL;
        deliveryStatus = 'fresh_match';
    }
    return {
        confidence_score: score,
        trace: {
            outcome: 'RESOLVED',
            reason: `L6:CONFIDENCE:${score.toFixed(4)},${deliveryStatus}`,
            confidence_score: score,
            last_seen_ms_ago: age,
            checksum_match: checksumMatch,
        },
    };
}
//# sourceMappingURL=level6-device-truth.js.map