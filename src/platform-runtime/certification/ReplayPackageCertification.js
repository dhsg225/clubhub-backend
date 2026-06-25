'use strict';
/**
 * ReplayPackageCertification
 *
 * RPC-01: replay-package/index.js exists
 * RPC-02: manifest-builder.js uses stableStringify
 * RPC-03: package-verifier.js exports PackageVerifier
 * RPC-04: functional — ManifestBuilder.build() produces manifest_hash
 * RPC-05: functional — ManifestBuilder.verify() returns true for valid manifest
 * RPC-06: functional — ManifestBuilder.verify() returns false for tampered manifest
 * RPC-07: functional — PackageBuilder.buildTopologyPackage() returns package_hash
 * RPC-08: functional — PackageVerifier.verify() valid for untampered package
 * RPC-09: functional — PackageVerifier.verify() invalid for tampered package
 * RPC-10: functional — PackageVerifier.verifyChain() all_valid for empty array
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../replay-package');

class ReplayPackageCertification {
  async run() {
    const checks = [
      this._exists('RPC-01', 'index.js',           'createReplayPackage', 'index.js exists'),
      this._exists('RPC-02', 'manifest-builder.js', 'stableStringify',    'manifest-builder uses stableStringify'),
      this._exists('RPC-03', 'package-verifier.js', 'PackageVerifier',    'package-verifier.js exists'),
      this._manifest_builds(),
      this._manifest_verifies_valid(),
      this._manifest_rejects_tampered(),
      this._builder_topology_package(),
      this._verifier_valid_package(),
      this._verifier_invalid_tampered(),
      this._verifier_chain_empty(),
    ];
    return this._result('ReplayPackageCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _manifest_builds() {
    const id = 'RPC-04'; const desc = 'ManifestBuilder.build() produces manifest_hash';
    try {
      const { ManifestBuilder } = require('../../replay-package/manifest-builder');
      const mb = new ManifestBuilder();
      const m  = mb.build('pkg_1', 'WORKFLOW', { traces: [] }, {});
      if (!m.manifest_hash) return { id, description: desc, status: 'FAIL', detail: 'missing manifest_hash' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _manifest_verifies_valid() {
    const id = 'RPC-05'; const desc = 'ManifestBuilder.verify() true for valid manifest';
    try {
      const { ManifestBuilder } = require('../../replay-package/manifest-builder');
      const mb       = new ManifestBuilder();
      const contents = { traces: [], workflow_id: 'wf1' };
      const manifest = mb.build('pkg_1', 'WORKFLOW', contents, {});
      if (!mb.verify(manifest, contents)) return { id, description: desc, status: 'FAIL', detail: 'valid manifest failed' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _manifest_rejects_tampered() {
    const id = 'RPC-06'; const desc = 'ManifestBuilder.verify() false for tampered manifest';
    try {
      const { ManifestBuilder } = require('../../replay-package/manifest-builder');
      const mb       = new ManifestBuilder();
      const contents = { traces: [], workflow_id: 'wf1' };
      const manifest = mb.build('pkg_1', 'WORKFLOW', contents, {});
      const tampered = { ...manifest, manifest_hash: 'deadbeef' };
      if (mb.verify(tampered, contents)) return { id, description: desc, status: 'FAIL', detail: 'tampered accepted' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _builder_topology_package() {
    const id = 'RPC-07'; const desc = 'PackageBuilder.buildTopologyPackage() returns package_hash';
    try {
      const { PackageBuilder } = require('../../replay-package/package-builder');
      const pb = new PackageBuilder({
        topology:            { snapshot: () => ({ entities: {}, edges: {} }) },
        lifecycleCoordinator:{ snapshot: () => ({ current_state: 'ACTIVE' }) },
      });
      const pkg = pb.buildTopologyPackage();
      if (!pkg.package_hash) return { id, description: desc, status: 'FAIL', detail: 'missing package_hash' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _verifier_valid_package() {
    const id = 'RPC-08'; const desc = 'PackageVerifier.verify() valid for untampered package';
    try {
      const { PackageBuilder }  = require('../../replay-package/package-builder');
      const { PackageVerifier } = require('../../replay-package/package-verifier');
      const pb  = new PackageBuilder({ topology: { snapshot: () => ({}) }, lifecycleCoordinator: { snapshot: () => ({}) } });
      const pkg = pb.buildTopologyPackage();
      const pv  = new PackageVerifier();
      const r   = pv.verify(pkg);
      if (!r.valid) return { id, description: desc, status: 'FAIL', detail: `hash_valid=${r.hash_valid} manifest_valid=${r.manifest_valid}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _verifier_invalid_tampered() {
    const id = 'RPC-09'; const desc = 'PackageVerifier.verify() invalid for tampered package';
    try {
      const { PackageBuilder }  = require('../../replay-package/package-builder');
      const { PackageVerifier } = require('../../replay-package/package-verifier');
      const pb  = new PackageBuilder({ topology: { snapshot: () => ({}) }, lifecycleCoordinator: { snapshot: () => ({}) } });
      const pkg = pb.buildTopologyPackage();
      const tampered = { ...pkg, package_hash: 'bad_hash' };
      const pv  = new PackageVerifier();
      const r   = pv.verify(tampered);
      if (r.valid) return { id, description: desc, status: 'FAIL', detail: 'tampered package accepted' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _verifier_chain_empty() {
    const id = 'RPC-10'; const desc = 'PackageVerifier.verifyChain([]) all_valid';
    try {
      const { PackageVerifier } = require('../../replay-package/package-verifier');
      const pv = new PackageVerifier();
      const r  = pv.verifyChain([]);
      if (!r.all_valid) return { id, description: desc, status: 'FAIL', detail: 'empty chain should be all_valid' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ReplayPackageCertification };
