# CERTIFICATION_FLOW.md
# Certification Flow Diagram

```
certifyRuntime() / certifyUI() / GovernanceCertificationRunner.run()
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Static source analysis (fs.readFileSync)        │
│  No runtime dependencies                        │
│  No DB required                                  │
└─────────────────────────────────────────────────┘
       │
       ├──► Runner 1.run() ──► checks[] ──► { PASS | FAIL | WARN }
       ├──► Runner 2.run() ──► checks[]
       ├──► ...
       └──► Runner N.run() ──► checks[]
                 │
                 ▼
       Aggregate: pass_count, fail_count, warn_count
                 │
       ┌─────────┴──────────┐
       ▼                     ▼
  fail_count > 0        fail_count == 0
  overall: FAIL         warn_count > 0 ──► CONDITIONAL
                        warn_count == 0 ──► PASS
```

## Current certification totals

```
Kernel:      9 runners,  ~45 checks,  HA_PRODUCTION CONDITIONAL (8/9 PASS)
Operator UI: 3 runners,  27 checks,   PASS
OTA Runtime: 5 runners,  39 checks,   PASS
A4 Docs:     4 runners,  ~34 checks,  target PASS
─────────────────────────────────────────────────
Platform:    21 runners, ~145 checks
```
