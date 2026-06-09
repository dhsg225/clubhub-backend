'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class OperatorAccountabilityCertification {
  get name() { return 'OperatorAccountabilityCertification'; }
  async run() {
    const caveats = [];
    // audit-ledger hash chain
    const ledgerPath = path.join(SRC, 'governance-kernel/core/audit-ledger.js');
    if (!fs.existsSync(ledgerPath)) {
      caveats.push({ severity: 'FAIL', check: 'audit_ledger', detail: 'audit-ledger.js missing' });
    } else {
      const src = fs.readFileSync(ledgerPath, 'utf8');
      if (!src.includes('verifyIntegrity'))        caveats.push({ severity: 'FAIL', check: 'ledger_integrity', detail: 'verifyIntegrity() missing' });
      if (!src.includes('appendEntryLinearized'))  caveats.push({ severity: 'FAIL', check: 'ledger_linearized', detail: 'appendEntryLinearized() missing' });
      if (!src.includes('MAX_LEDGER_ENTRIES'))     caveats.push({ severity: 'FAIL', check: 'ledger_bound', detail: 'MAX_LEDGER_ENTRIES missing' });
    }
    // session-authority JTI revocation
    const sessPath = path.join(SRC, 'governance-kernel/core/session-authority.js');
    if (!fs.existsSync(sessPath)) {
      caveats.push({ severity: 'FAIL', check: 'session_authority', detail: 'session-authority.js missing' });
    } else {
      const src = fs.readFileSync(sessPath, 'utf8');
      if (!src.includes('revokeToken'))          caveats.push({ severity: 'FAIL', check: 'revoke_token', detail: 'revokeToken() missing' });
      if (!src.includes('isRevoked'))            caveats.push({ severity: 'FAIL', check: 'is_revoked', detail: 'isRevoked() missing' });
      if (!src.includes('rotateSigningKey'))      caveats.push({ severity: 'CONDITIONAL', check: 'key_rotation', detail: 'rotateSigningKey() missing' });
    }
    // operator authority HMAC + roles
    const oaPath = path.join(SRC, 'governance-kernel/api/OperatorAuthority.js');
    if (!fs.existsSync(oaPath)) {
      caveats.push({ severity: 'CONDITIONAL', check: 'operator_auth_api', detail: 'OperatorAuthority.js missing' });
    } else {
      const src = fs.readFileSync(oaPath, 'utf8');
      if (!src.includes('timingSafeEqual'))  caveats.push({ severity: 'FAIL', check: 'timing_safe', detail: 'timingSafeEqual missing — timing attack vector' });
      if (!src.includes('ADMIN') || !src.includes('OPERATOR') || !src.includes('VIEWER')) {
        caveats.push({ severity: 'FAIL', check: 'roles', detail: 'ADMIN/OPERATOR/VIEWER roles missing' });
      }
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = OperatorAccountabilityCertification;
