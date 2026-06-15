'use strict';
const crypto = require('node:crypto');

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function sha256(obj) {
  return crypto.createHash('sha256').update(stableStringify(obj)).digest('hex');
}

class ManifestBuilder {
  build(packageId, type, contents, meta = {}) {
    const body = {
      package_id:   packageId,
      type,
      created_at:   Date.now(),
      contents_keys: Object.keys(contents).sort(),
      meta,
    };
    const manifest_hash = sha256(body);
    return { ...body, manifest_hash };
  }

  verify(manifest, contents) {
    const expected = this.build(manifest.package_id, manifest.type, contents, manifest.meta);
    return expected.manifest_hash === manifest.manifest_hash;
  }
}

module.exports = { ManifestBuilder, sha256, stableStringify };
