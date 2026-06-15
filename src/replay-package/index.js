'use strict';
const { PackageBuilder, PACKAGE_TYPES } = require('./package-builder');
const { PackageVerifier }               = require('./package-verifier');
const { ManifestBuilder, sha256, stableStringify } = require('./manifest-builder');

function createReplayPackage(deps = {}) {
  return {
    builder:  new PackageBuilder(deps),
    verifier: new PackageVerifier(),
  };
}

module.exports = { createReplayPackage, PackageBuilder, PackageVerifier, ManifestBuilder, PACKAGE_TYPES, sha256 };
