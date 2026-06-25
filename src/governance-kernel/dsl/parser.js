'use strict';
/**
 * Governance DSL Parser
 *
 * Parses domain governance declarations:
 *
 *   domain "deployments" {
 *     freeze_on incident.severity >= HIGH
 *     require lineage.strict
 *     require replayable
 *     require authority.db_authoritative
 *     resource_ceiling nodes 1000
 *     resource_ceiling incidents 500
 *     allow operator ADMIN
 *     deny operator VIEWER
 *     policy rollout_promotion
 *   }
 */
const TOKEN_TYPES = Object.freeze({
  KEYWORD: 'KEYWORD', STRING: 'STRING', IDENT: 'IDENT',
  DOT_IDENT: 'DOT_IDENT', OPERATOR: 'OPERATOR', NUMBER: 'NUMBER',
  LBRACE: 'LBRACE', RBRACE: 'RBRACE', EOF: 'EOF',
});
const KEYWORDS = new Set(['domain','freeze_on','require','resource_ceiling','allow','deny','policy']);
const TWO_OPS  = new Set(['>=','<=','!=','==']);
const ONE_OPS  = new Set(['>','<']);

function tokenize(src) {
  const tokens = []; let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    if (src[i] === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src[i] === '"') {
      let s = ''; i++;
      while (i < src.length && src[i] !== '"') { s += src[i]; i++; }
      i++;
      tokens.push({ type: TOKEN_TYPES.STRING, value: s }); continue;
    }
    if (src[i] === '{') { tokens.push({ type: TOKEN_TYPES.LBRACE }); i++; continue; }
    if (src[i] === '}') { tokens.push({ type: TOKEN_TYPES.RBRACE }); i++; continue; }
    const two = src.slice(i, i + 2);
    if (TWO_OPS.has(two)) { tokens.push({ type: TOKEN_TYPES.OPERATOR, value: two }); i += 2; continue; }
    if (ONE_OPS.has(src[i])) { tokens.push({ type: TOKEN_TYPES.OPERATOR, value: src[i] }); i++; continue; }
    if (/[0-9]/.test(src[i])) {
      let n = '';
      while (i < src.length && /[0-9]/.test(src[i])) { n += src[i]; i++; }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseInt(n, 10) }); continue;
    }
    if (/[a-zA-Z_]/.test(src[i])) {
      let id = '';
      while (i < src.length && /[a-zA-Z0-9_.]/.test(src[i])) { id += src[i]; i++; }
      const type = KEYWORDS.has(id) ? TOKEN_TYPES.KEYWORD
                 : id.includes('.') ? TOKEN_TYPES.DOT_IDENT : TOKEN_TYPES.IDENT;
      tokens.push({ type, value: id }); continue;
    }
    i++;
  }
  tokens.push({ type: TOKEN_TYPES.EOF });
  return tokens;
}

function parse(src) {
  const tokens = tokenize(src);
  let pos = 0;
  const domains = [];
  function peek()    { return tokens[pos]; }
  function consume() { return tokens[pos++]; }
  function expect(type) {
    const t = consume();
    if (t.type !== type) throw new Error(`Parse error: expected ${type}, got ${t.type} at pos ${pos}`);
    return t;
  }
  function parseStatement() {
    const t = peek();
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'freeze_on') {
      consume();
      const subject  = consume().value;
      const operator = consume().value;
      const value    = consume().value;
      return { type: 'freeze_on', subject, operator, value };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'require') {
      consume(); return { type: 'require', requirement: consume().value };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'resource_ceiling') {
      consume();
      const resource = consume().value;
      const limit    = consume().value;
      return { type: 'resource_ceiling', resource, limit };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && (t.value === 'allow' || t.value === 'deny')) {
      const action = consume().value;
      const target = consume().value;
      return { type: 'permission', action, target };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'policy') {
      consume(); return { type: 'policy_ref', name: consume().value };
    }
    consume(); return null;
  }
  while (pos < tokens.length - 1) {
    const t = peek();
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'domain') {
      consume();
      const name = expect(TOKEN_TYPES.STRING).value;
      expect(TOKEN_TYPES.LBRACE);
      const statements = [];
      while (peek().type !== TOKEN_TYPES.RBRACE && peek().type !== TOKEN_TYPES.EOF) {
        const s = parseStatement();
        if (s) statements.push(s);
      }
      expect(TOKEN_TYPES.RBRACE);
      domains.push({ type: 'domain', name, statements });
    } else { pos++; }
  }
  return { type: 'program', domains };
}

module.exports = { parse, tokenize, TOKEN_TYPES };
