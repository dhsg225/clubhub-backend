# Replay Package Specification

## Package Types

| Type         | Contents                                           |
|--------------|-----------------------------------------------------|
| WORKFLOW     | traces[], topology_snap, workflow_id               |
| INCIDENT     | traces[], incident metadata                        |
| DEPLOYMENT   | traces[], deployment metadata                      |
| AI_DECISION  | decision entries[], chain_valid, policies[]        |
| TOPOLOGY     | topology_snap, lifecycle_snap                      |

## Package Structure

```json
{
  "package_id":   "pkg_workflow_1",
  "type":         "WORKFLOW",
  "package_hash": "sha256(contents)",
  "manifest": {
    "package_id":      "pkg_workflow_1",
    "type":            "WORKFLOW",
    "created_at":      1700000000000,
    "contents_keys":   ["topology_snap", "traces", "workflow_id"],
    "manifest_hash":   "sha256(manifest_body)"
  },
  "contents": {
    "workflow_id":  "wf_deploy_001",
    "traces":       [...],
    "topology_snap":{ ... }
  }
}
```

## Tamper Verification

```
PackageVerifier.verify(pkg)
    │
    ├── hash_valid:     sha256(pkg.contents) === pkg.package_hash
    ├── manifest_valid: sha256(manifest_body) === manifest.manifest_hash
    └── Returns: { valid, hash_valid, manifest_valid, package_id, type }
```

Both the content hash and manifest hash must match. A tampered package fails at least one check.

## Self-Contained Packages

Each package includes a topology snapshot at export time — it is self-contained for forensic replay without live platform access. The `package_hash` uses `stableStringify` (sorted keys) for deterministic hashing.

## Replay Instructions

A package is replay-ready when:
1. `PackageVerifier.verify()` returns `valid: true`
2. Chain entries in AI_DECISION packages pass `verifyChain()`
3. Topology snapshot epoch matches trace lineage_ts range
