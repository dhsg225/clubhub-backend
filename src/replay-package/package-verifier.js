'use strict';
const { ManifestBuilder, sha256, stableStringify } = require('./manifest-builder');

class PackageVerifier {
  constructor() {
    this._manifest = new ManifestBuilder();
  }

  verify(pkg) {
    if (!pkg || !pkg.manifest || !pkg.contents) return { valid: false, reason: 'missing manifest or contents' };
    const hash_valid     = sha256(pkg.contents) === pkg.package_hash;
    const manifest_valid = this._manifest.verify(pkg.manifest, pkg.contents);
    return {
      valid:          hash_valid && manifest_valid,
      hash_valid,
      manifest_valid,
      package_id:     pkg.package_id,
      type:           pkg.type,
    };
  }

  verifyChain(packages) {
    const results = packages.map(p => this.verify(p));
    const all_valid = results.every(r => r.valid);
    return { all_valid, results };
  }
}

module.exports = { PackageVerifier };
