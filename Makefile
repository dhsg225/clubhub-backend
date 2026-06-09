##############################################################################
#  ClubHub TV — Developer Simulation + Operations Makefile
#
#  All simulation commands live here. Run 'make help' to see them all.
#
#  Quick start:
#    make sim-start            start backend + postgres + 5 fake Pi screens
#    make sim-start SCREENS=20 start with 20 screens
#    make seed                 populate DB with test content + schedules
#    make sim-logs             stream all logs through the pretty formatter
#    make fleet-status         current status of all simulated screens
#
#  Failure scenarios (run while sim is running in another terminal):
#    make fail-backend         restart backend, watch screens recover
#    make fail-db              restart postgres, watch pool recovery
#    make outage-start         pause backend (screens timeout, use cache)
#    make outage-end           resume backend
#    make churn                rapid content create/delete (version tracking)
#    make flood                simultaneous reboot of all screens (jitter test)
##############################################################################

COMPOSE_FILE      := docker-compose.dev-sim.yml
COMPOSE_PROD      := docker-compose.production.yml
BACKEND           := http://localhost:4000
MGMT_API          := http://localhost:3100
DB_HOST           := localhost
DB_PORT           := 5433
DB_USER           := clubhub
DB_PASS           := clubhub
DB_NAME           := clubhub
SCRIPTS           := simulator/scripts
BACKUP_DIR        := backups

# Overridable defaults
SCREENS      ?= 5
REBOOT_PROB  ?= 0.005
SCREEN       ?= sim-screen-01

.PHONY: help
help:
	@echo ""
	@echo "ClubHub TV — Local Simulation Commands"
	@echo "======================================="
	@echo ""
	@echo "Lifecycle:"
	@echo "  make sim-start [SCREENS=N]     Start full stack (postgres + backend + Pi fleet)"
	@echo "  make sim-stop                  Stop all containers"
	@echo "  make sim-restart               Restart all containers"
	@echo "  make sim-rebuild               Rebuild images and restart"
	@echo "  make sim-status                Show Docker Compose service status"
	@echo "  make sim-down-volumes          Stop + remove all data volumes (full reset)"
	@echo ""
	@echo "Observation:"
	@echo "  make sim-logs                  Stream logs through pretty formatter"
	@echo "  make sim-logs-raw              Stream raw JSON logs"
	@echo "  make watch                     Watch only manifest changes"
	@echo "  make watch-failures            Watch only failures + fleet stats"
	@echo "  make watch-screen [SCREEN=id]  Watch single screen"
	@echo "  make fleet-status              Current status of all screens"
	@echo "  make health                    Backend health check"
	@echo "  make manifest [SCREEN=id]      Fetch manifest for a screen"
	@echo "  make manifest-all              Fetch manifests for first 5 screens"
	@echo "  make backend-logs              Stream backend container logs"
	@echo "  make db-logs                   Stream postgres container logs"
	@echo ""
	@echo "Content:"
	@echo "  make seed [SCREENS=N]          Seed DB with test content and schedules"
	@echo "  make seed-reset [SCREENS=N]    Delete sim content then re-seed"
	@echo "  make content-list              List all content with lifecycle status"
	@echo "  make schedules-list            List all schedules"
	@echo "  make screens-list              List all registered screens"
	@echo ""
	@echo "Failure scenarios:"
	@echo "  make fail-backend              Restart backend (30s recovery expected)"
	@echo "  make fail-db                   Restart postgres (60s recovery expected)"
	@echo "  make outage-start              Pause backend (polls timeout, screens cache)"
	@echo "  make outage-end                Resume backend"
	@echo "  make outage-30                 30s outage then auto-recover"
	@echo "  make outage-60                 60s outage then auto-recover"
	@echo "  make clear-caches              Clear manifest_cache (force cold recompute)"
	@echo "  make delete-content            Delete all content (system fallback test)"
	@echo "  make churn                     5-cycle create/delete (version tracking)"
	@echo "  make churn-hard                20-cycle stress test"
	@echo "  make flood                     Simultaneous reboot all screens (jitter test)"
	@echo "  make offline-screen [SCREEN=id] Force one screen offline for 30s"
	@echo "  make reboot-screen [SCREEN=id] Simulate single screen reboot"
	@echo ""
	@echo "Database:"
	@echo "  make db-shell                  psql into simulation postgres"
	@echo "  make db-cache                  Show manifest_cache table"
	@echo "  make db-screens                Show screens table"
	@echo "  make db-schedules              Show schedules table"
	@echo "  make db-reset                  Drop and recreate all tables (destructive)"
	@echo "  make db-migrate                Apply pending migrations"
	@echo ""
	@echo "Testing:"
	@echo "  make validate-contracts        Enforce contract vs code/config (run first)"
	@echo "  make test-basic                Run basic functionality tests"
	@echo "  make test-chaos                Run chaos/resilience tests"
	@echo "  make test-stress               Run performance/stress tests"
	@echo "  make test-all                  Run all tests"
	@echo "  make test-ci                   Run all tests in CI mode (summary only)"
	@echo ""
	@echo "Production:"
	@echo "  make prod-start                Start production stack (requires .env.production)"
	@echo "  make prod-stop                 Stop production stack"
	@echo "  make prod-logs                 Stream production backend logs"
	@echo "  make prod-status               Show production container health"
	@echo "  make prod-update               Pull latest code + rebuild backend only"
	@echo ""
	@echo "Operations:"
	@echo "  make bootstrap                 First-run setup (venue + screen + validation)"
	@echo "  make health-full               Detailed readiness check (/health/ready)"
	@echo "  make backup                    Backup dev-sim database to backups/"
	@echo "  make backup-prod               Backup production database to backups/"
	@echo "  make restore BACKUP=<file>     Restore database from backup file"
	@echo "  make pi-appliance              Run Pi appliance mode simulator (single screen)"
	@echo "  make ops-check                 Show screen health summary"
	@echo ""
	@echo "Variables:"
	@echo "  SCREENS=N         Number of simulated screens (default: $(SCREENS))"
	@echo "  SCREEN=id         Target screen for single-screen commands (default: $(SCREEN))"
	@echo "  REBOOT_PROB=N     Reboot probability per poll, 0.0–1.0 (default: $(REBOOT_PROB))"
	@echo "  BACKUP=file       Backup filename for restore target"
	@echo ""

# ── Lifecycle ────────────────────────────────────────────────────────────────

.PHONY: sim-start
sim-start:
	SCREENS=$(SCREENS) REBOOT_PROB=$(REBOOT_PROB) \
	  docker compose -f $(COMPOSE_FILE) up -d --build
	@echo ""
	@echo "Simulation started with $(SCREENS) screens."
	@echo "  Logs:   make sim-logs"
	@echo "  Status: make fleet-status"
	@echo "  Seed:   make seed"

.PHONY: sim-stop
sim-stop:
	docker compose -f $(COMPOSE_FILE) down

.PHONY: sim-restart
sim-restart:
	docker compose -f $(COMPOSE_FILE) restart

.PHONY: sim-rebuild
sim-rebuild:
	SCREENS=$(SCREENS) REBOOT_PROB=$(REBOOT_PROB) \
	  docker compose -f $(COMPOSE_FILE) up -d --build --force-recreate

.PHONY: sim-status
sim-status:
	docker compose -f $(COMPOSE_FILE) ps

.PHONY: sim-down-volumes
sim-down-volumes:
	@echo "WARNING: This will delete all simulation data (postgres volume + uploads)."
	@read -p "Continue? [y/N] " CONFIRM && [ "$$CONFIRM" = "y" ]
	docker compose -f $(COMPOSE_FILE) down -v

# ── Observation ───────────────────────────────────────────────────────────────

.PHONY: sim-logs
sim-logs:
	docker compose -f $(COMPOSE_FILE) logs -f fake-pi-fleet | node simulator/watch.js

.PHONY: sim-logs-raw
sim-logs-raw:
	docker compose -f $(COMPOSE_FILE) logs -f fake-pi-fleet

.PHONY: watch
watch:
	docker compose -f $(COMPOSE_FILE) logs -f fake-pi-fleet | node simulator/watch.js --only-changes

.PHONY: watch-failures
watch-failures:
	docker compose -f $(COMPOSE_FILE) logs -f fake-pi-fleet | node simulator/watch.js --only-failures

.PHONY: watch-screen
watch-screen:
	docker compose -f $(COMPOSE_FILE) logs -f fake-pi-fleet | node simulator/watch.js --screen $(SCREEN)

.PHONY: backend-logs
backend-logs:
	docker compose -f $(COMPOSE_FILE) logs -f backend

.PHONY: db-logs
db-logs:
	docker compose -f $(COMPOSE_FILE) logs -f postgres

.PHONY: fleet-status
fleet-status:
	@python3 $(SCRIPTS)/fleet-status.py $(MGMT_API)

.PHONY: health
health:
	@curl -sf $(BACKEND)/health | python3 -m json.tool

.PHONY: manifest
manifest:
	@python3 $(SCRIPTS)/manifest-check.py $(BACKEND) $(SCREEN)

.PHONY: manifest-all
manifest-all:
	@for i in 01 02 03 04 05; do \
	  echo "=== sim-screen-$$i ==="; \
	  python3 $(SCRIPTS)/manifest-check.py $(BACKEND) sim-screen-$$i; \
	  echo ""; \
	done

# ── Content ───────────────────────────────────────────────────────────────────

.PHONY: seed
seed:
	BACKEND_URL=$(BACKEND) SCREEN_COUNT=$(SCREENS) node simulator/seed.js

.PHONY: seed-reset
seed-reset:
	BACKEND_URL=$(BACKEND) SCREEN_COUNT=$(SCREENS) node simulator/seed.js --reset

.PHONY: content-list
content-list:
	@python3 $(SCRIPTS)/content-list.py $(BACKEND)

.PHONY: schedules-list
schedules-list:
	@python3 $(SCRIPTS)/schedules-list.py $(BACKEND)

.PHONY: screens-list
screens-list:
	@python3 $(SCRIPTS)/screens-list.py $(BACKEND)

# ── Failure scenarios ─────────────────────────────────────────────────────────

.PHONY: fail-backend
fail-backend:
	COMPOSE_FILE=$(COMPOSE_FILE) BACKEND_URL=$(BACKEND) \
	  ./simulator/scenarios/restart-backend.sh

.PHONY: fail-db
fail-db:
	COMPOSE_FILE=$(COMPOSE_FILE) \
	  ./simulator/scenarios/restart-db.sh

.PHONY: outage-start
outage-start:
	COMPOSE_FILE=$(COMPOSE_FILE) ./simulator/scenarios/outage.sh start

.PHONY: outage-end
outage-end:
	COMPOSE_FILE=$(COMPOSE_FILE) ./simulator/scenarios/outage.sh end

.PHONY: outage-30
outage-30:
	COMPOSE_FILE=$(COMPOSE_FILE) ./simulator/scenarios/outage.sh 30

.PHONY: outage-60
outage-60:
	COMPOSE_FILE=$(COMPOSE_FILE) ./simulator/scenarios/outage.sh 60

.PHONY: clear-caches
clear-caches:
	DB_HOST=$(DB_HOST) DB_PORT=$(DB_PORT) ./simulator/scenarios/clear-caches.sh

.PHONY: delete-content
delete-content:
	BACKEND_URL=$(BACKEND) ./simulator/scenarios/delete-all-content.sh

.PHONY: churn
churn:
	BACKEND_URL=$(BACKEND) SCREEN_ID=$(SCREEN) ./simulator/scenarios/content-churn.sh 5

.PHONY: churn-hard
churn-hard:
	BACKEND_URL=$(BACKEND) SCREEN_ID=$(SCREEN) ./simulator/scenarios/content-churn.sh 20 1

.PHONY: flood
flood:
	BACKEND_URL=$(BACKEND) MGMT_URL=$(MGMT_API) ./simulator/scenarios/flood-test.sh

.PHONY: offline-screen
offline-screen:
	@curl -sf -X POST $(MGMT_API)/offline/$(SCREEN) \
	  -H "Content-Type: application/json" -d '{"durationMs":30000}' \
	  | python3 -m json.tool

.PHONY: reboot-screen
reboot-screen:
	@curl -sf -X POST $(MGMT_API)/reboot/$(SCREEN) | python3 -m json.tool

# ── Database ──────────────────────────────────────────────────────────────────

.PHONY: db-shell
db-shell:
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME)

.PHONY: db-cache
db-cache:
	@PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -c "SELECT screen_id, version, checksum, computed_at, valid_until FROM manifest_cache ORDER BY computed_at DESC;"

.PHONY: db-screens
db-screens:
	@PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -c "SELECT id, venue_id, screen_group, last_seen_at FROM screens ORDER BY venue_id, id;"

.PHONY: db-schedules
db-schedules:
	@PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -c "SELECT id, content_id, screen_id, venue_id, priority, is_fallback, time_of_day_start, time_of_day_end FROM schedules ORDER BY priority DESC;"

.PHONY: db-reset
db-reset:
	@echo "WARNING: This will destroy all data in $(DB_NAME)."
	@read -p "Continue? [y/N] " CONFIRM && [ "$$CONFIRM" = "y" ]
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $(DB_USER);"
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -f backend/db/init.sql
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -f backend/db/migrate_001.sql
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -f backend/db/migrate_002.sql
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -f backend/db/migrate_003.sql
	@echo "Database reset complete."

.PHONY: db-migrate
db-migrate:
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -f backend/db/migrate_001.sql
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -f backend/db/migrate_002.sql
	PGPASSWORD=$(DB_PASS) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) \
	  -f backend/db/migrate_003.sql
	@echo "Migrations applied."
 
# ── Testing ───────────────────────────────────────────────────────────────────

.PHONY: test-clean
test-clean:
	rm -rf reports/*

.PHONY: test-basic
test-basic:
	node test-runner/runner.js --suite=basic --deterministic

.PHONY: test-chaos
test-chaos:
	node test-runner/runner.js --suite=chaos --deterministic

.PHONY: test-stress
test-stress:
	node test-runner/runner.js --suite=stress --deterministic

.PHONY: test-all
test-all:
	node test-runner/runner.js --suite=all --deterministic

.PHONY: test-ci
test-ci:
	node test-runner/runner.js --suite=all --ci --deterministic --seed=12345

# Contract enforcement — must pass before any chaos/CI tests are meaningful.
# Validates that CLUBHUB_SYSTEM_CONTRACTS.md is the single source of truth:
#   - §3.2 threshold values match test-config/thresholds.json
#   - All thresholds.json keys are enforced in test-runner/runner.js
#   - No hardcoded threshold values in test runner source
# Exit 0 = clean. Exit 1 = deploy blocker. Exit 2 = validator error.
.PHONY: validate-contracts
validate-contracts:
	node test-runner/contracts/validate-contracts.js

# CI variant: emits structured JSON only (no ANSI/human output).
.PHONY: validate-contracts-ci
validate-contracts-ci:
	node test-runner/contracts/validate-contracts.js --ci

# ── Production lifecycle ───────────────────────────────────────────────────────

.PHONY: prod-start
prod-start:
	@test -f .env.production || (echo "Error: .env.production not found. Copy from .env.production.example and fill in values." && exit 1)
	docker compose -f $(COMPOSE_PROD) --env-file .env.production up -d
	@echo ""
	@echo "Production stack started."
	@echo "  Health: make health-full BACKEND=https://\$$DOMAIN/api"
	@echo "  Logs:   make prod-logs"

.PHONY: prod-stop
prod-stop:
	docker compose -f $(COMPOSE_PROD) down

.PHONY: prod-logs
prod-logs:
	docker compose -f $(COMPOSE_PROD) logs -f backend

.PHONY: prod-status
prod-status:
	docker compose -f $(COMPOSE_PROD) ps

.PHONY: prod-update
prod-update:
	git pull origin main
	docker compose -f $(COMPOSE_PROD) build backend
	docker compose -f $(COMPOSE_PROD) up -d --no-deps backend
	@echo "Backend updated. Verify: make health-full"

# ── Operations ────────────────────────────────────────────────────────────────

.PHONY: bootstrap
bootstrap:
	@BACKEND_URL=$(BACKEND) node scripts/bootstrap.js

.PHONY: health-full
health-full:
	@curl -sf $(BACKEND)/health/ready | python3 -m json.tool

.PHONY: ops-check
ops-check:
	@python3 $(SCRIPTS)/ops-check.py $(BACKEND)

# ── Backup & Restore ──────────────────────────────────────────────────────────

.PHONY: backup
backup:
	@mkdir -p $(BACKUP_DIR)
	DB_HOST=$(DB_HOST) DB_PORT=$(DB_PORT) DB_USER=$(DB_USER) DB_PASS=$(DB_PASS) \
	  DB_NAME=$(DB_NAME) BACKUP_DIR=$(BACKUP_DIR) \
	  ./scripts/backup.sh

.PHONY: backup-prod
backup-prod:
	@mkdir -p $(BACKUP_DIR)
	USE_DOCKER=true CONTAINER_NAME=clubhub_player-postgres-1 \
	  BACKUP_DIR=$(BACKUP_DIR) \
	  ./scripts/backup.sh

.PHONY: restore
restore:
	@test -n "$(BACKUP)" || (echo "Usage: make restore BACKUP=<filename>" && exit 1)
	DB_HOST=$(DB_HOST) DB_PORT=$(DB_PORT) DB_USER=$(DB_USER) DB_PASS=$(DB_PASS) \
	  DB_NAME=$(DB_NAME) \
	  ./scripts/restore.sh $(BACKUP_DIR)/$(BACKUP)

# ── Pi appliance mode ─────────────────────────────────────────────────────────

.PHONY: pi-appliance
pi-appliance:
	BACKEND_URL=$(BACKEND) node simulator/pi-appliance.js

.PHONY: pi-appliance-screen
pi-appliance-screen:
	BACKEND_URL=$(BACKEND) SCREEN_ID=$(SCREEN) node simulator/pi-appliance.js

# ── Soak environment ──────────────────────────────────────────────────────────

SOAK_SCREENS  ?= 5
SOAK_DURATION ?= 0
SOAK_PORT     ?= 3200
REPORT_DIR    := soak-reports

.PHONY: soak-start
soak-start:
	@mkdir -p $(REPORT_DIR)
	BACKEND_URL=$(BACKEND) SCREEN_COUNT=$(SOAK_SCREENS) \
	  SOAK_DURATION=$(SOAK_DURATION) STATUS_PORT=$(SOAK_PORT) \
	  REPORT_DIR=$(REPORT_DIR) \
	  node simulator/soak.js

.PHONY: soak-start-bg
soak-start-bg:
	@mkdir -p $(REPORT_DIR)
	BACKEND_URL=$(BACKEND) SCREEN_COUNT=$(SOAK_SCREENS) \
	  SOAK_DURATION=$(SOAK_DURATION) STATUS_PORT=$(SOAK_PORT) \
	  REPORT_DIR=$(REPORT_DIR) \
	  node simulator/soak.js &
	@echo "Soak running in background on port $(SOAK_PORT)"
	@echo "  Status:    make soak-status"
	@echo "  Dashboard: make fleet-dashboard-soak"
	@echo "  Report:    make soak-report"

.PHONY: soak-status
soak-status:
	@curl -sf http://localhost:$(SOAK_PORT)/status | python3 -m json.tool

.PHONY: soak-stop
soak-stop:
	@curl -sf -X POST http://localhost:$(SOAK_PORT)/fault/clear > /dev/null || true
	@pkill -f 'node simulator/soak.js' || echo "Soak not running"

.PHONY: soak-report
soak-report:
	@REPORT_DIR=$(REPORT_DIR) node simulator/soak-report.js $(REPORT)

.PHONY: soak-report-live
soak-report-live:
	@curl -sf http://localhost:$(SOAK_PORT)/report | python3 -m json.tool

.PHONY: soak-fault
soak-fault:
	@test -n "$(FAULT)" || (echo "Usage: make soak-fault FAULT=slow  or  FAULT=offline  etc." && exit 1)
	@curl -sf -X POST http://localhost:$(SOAK_PORT)/fault \
	  -H "Content-Type: application/json" \
	  -d '{"type":"$(FAULT)"}' | python3 -m json.tool

.PHONY: soak-fault-clear
soak-fault-clear:
	@curl -sf -X POST http://localhost:$(SOAK_PORT)/fault/clear | python3 -m json.tool

.PHONY: soak-ota
soak-ota:
	@curl -sf -X POST http://localhost:$(SOAK_PORT)/ota \
	  -H "Content-Type: application/json" \
	  -d '{"version":"$(VERSION:-1.1.0)","pct":$(PCT:-50)}' | python3 -m json.tool

# ── Fleet dashboard ───────────────────────────────────────────────────────────

.PHONY: fleet-dashboard
fleet-dashboard:
	@STATUS_URL=http://localhost:$(STATUS_PORT) node simulator/fleet-dashboard.js

.PHONY: fleet-dashboard-soak
fleet-dashboard-soak:
	@STATUS_URL=http://localhost:$(SOAK_PORT) node simulator/fleet-dashboard.js

# ── Media failure testing ─────────────────────────────────────────────────────

.PHONY: test-media
test-media:
	BACKEND_URL=$(BACKEND) node simulator/media-sim.js

# ── Help additions ────────────────────────────────────────────────────────────

.PHONY: soak-help
soak-help:
	@echo ""
	@echo "Soak Environment Commands"
	@echo "========================="
	@echo "  make soak-start [SOAK_SCREENS=5] [SOAK_DURATION=3600]"
	@echo "                                     Start foreground soak (Ctrl+C for report)"
	@echo "  make soak-start-bg                 Start background soak"
	@echo "  make soak-status                   Show soak JSON status"
	@echo "  make soak-stop                     Stop background soak + generate report"
	@echo "  make soak-report                   Print latest report"
	@echo "  make soak-report-live              Print live report from running soak"
	@echo "  make soak-fault FAULT=slow         Inject: slow|offline|dns_fail|packet_loss|captive_portal"
	@echo "  make soak-fault-clear              Clear all faults"
	@echo "  make soak-ota VERSION=1.1.0 PCT=50 Trigger OTA rollout"
	@echo ""
	@echo "  make fleet-dashboard               Terminal dashboard (sim fleet on :3100)"
	@echo "  make fleet-dashboard-soak          Terminal dashboard (soak on :3200)"
	@echo ""
	@echo "  make test-media                    Run media failure tests"
	@echo ""
	@echo "Variables:"
	@echo "  SOAK_SCREENS=N   Screens in soak (default: 5)"
	@echo "  SOAK_DURATION=N  Seconds to run, 0=infinite (default: 0)"
	@echo "  SOAK_PORT=N      Soak management API port (default: 3200)"
	@echo "  FAULT=type       Fault type for soak-fault"
	@echo "  REPORT=file      Specific report file for soak-report"
	@echo ""
