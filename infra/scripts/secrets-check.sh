#!/usr/bin/env bash
# Verify all required secrets are present before deployment
# Run this in CI before kubectl apply
#
# Constitutional checks enforced:
# - PLATFORM_ADMIN_TOKEN must be >= 8 chars (EMERGENCY_FREEZE exit requirement)
# - CORPUS_SIGNING_KEY must be present (corpus integrity chain)

set -euo pipefail

ENVIRONMENT="${1:?Usage: secrets-check.sh <environment>}"
NAMESPACE="clubhub-${ENVIRONMENT}"

echo "[secrets-check] Checking secrets in namespace: $NAMESPACE"

REQUIRED_SECRETS=(
  "DATABASE_URL"
  "REDIS_URL"
  "JWT_SECRET"
  "CORPUS_SIGNING_KEY"
  "PLATFORM_ADMIN_TOKEN" # Constitutional: required for EMERGENCY_FREEZE exit (>= 8 chars)
)

MISSING=()
for secret in "${REQUIRED_SECRETS[@]}"; do
  if ! kubectl get secret clubhub-secrets -n "$NAMESPACE" \
      -o jsonpath="{.data.${secret}}" 2>/dev/null \
      | base64 -d \
      | grep -q .; then
    MISSING+=("$secret")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "[secrets-check] MISSING REQUIRED SECRETS:"
  printf "  - %s\n" "${MISSING[@]}"
  echo "[secrets-check] DEPLOY BLOCKED"
  exit 1
fi

# Constitutional check: PLATFORM_ADMIN_TOKEN must be >= 8 chars
# EMERGENCY_FREEZE exit requires human auth token >= 8 chars
TOKEN_LEN=$(kubectl get secret clubhub-secrets -n "$NAMESPACE" \
    -o jsonpath="{.data.PLATFORM_ADMIN_TOKEN}" \
    | base64 -d \
    | tr -d '\n' \
    | wc -c)

if [ "$TOKEN_LEN" -lt 8 ]; then
  echo "[secrets-check] CONSTITUTIONAL VIOLATION: PLATFORM_ADMIN_TOKEN must be >= 8 chars"
  echo "[secrets-check] Current length: ${TOKEN_LEN}"
  echo "[secrets-check] DEPLOY BLOCKED"
  exit 1
fi

echo "[secrets-check] All secrets present and valid."
echo "[secrets-check] Deploy may proceed."
