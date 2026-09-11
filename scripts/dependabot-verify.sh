#!/usr/bin/env bash
#
# dependabot-verify.sh — run the full local gate for a dependency update.
#
# Contract
#   Inputs        --skip-e2e     stop after `npm run build`
#                 --quick        stop after `npm run typecheck`
#   Output        A pass/fail table on stdout. Only FAILING step output is printed
#                 (capped); every step's full log is written to a temp dir whose
#                 path is printed.
#   Preconditions Run from anywhere inside the repo. Node 24 + npm on PATH.
#   Side effects  Rewrites package-lock.json (npm install) and node_modules
#                 (npm ci). Installs the Playwright chromium build. Writes
#                 public/ (gatsby build) and test-results/.
#   Exit          0 if every step passed, 1 otherwise. Fail-fast: remaining steps
#                 are reported as SKIPPED rather than silently omitted.
#
# Steps mirror CI (typecheck, jest, e2e) and add the checks CI does not run on PRs:
# `npm ci` lock validation and an npm audit summary.

set -uo pipefail

SKIP_E2E=0
QUICK=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-e2e) SKIP_E2E=1; shift ;;
    --quick) QUICK=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

LOGDIR="$(mktemp -d "${TMPDIR:-/tmp}/dependabot-verify.XXXXXX")"
declare -a NAMES=() RESULTS=()
FAILED=0

run_step() {
  local name="$1"; shift
  local log="$LOGDIR/${name}.log"

  if [[ $FAILED -eq 1 ]]; then
    NAMES+=("$name"); RESULTS+=("SKIPPED")
    return
  fi

  echo ">>> ${name}: $*" >&2
  local start=$SECONDS
  if "$@" >"$log" 2>&1; then
    NAMES+=("$name"); RESULTS+=("pass ($((SECONDS - start))s)")
  else
    NAMES+=("$name"); RESULTS+=("FAIL ($((SECONDS - start))s)")
    FAILED=1
    FAILED_STEP="$name"
    FAILED_LOG="$log"
  fi
}

# npm install regenerates the lockfile after any package.json edit; npm ci then
# proves the committed lockfile is complete and installable exactly as CI does it.
run_step install npm install
run_step lockfile-ci npm ci
run_step typecheck npm run typecheck

if [[ $QUICK -eq 0 ]]; then
  run_step unit-tests npm test
  run_step build npm run build
  if [[ $SKIP_E2E -eq 0 ]]; then
    # Required whenever @playwright/test changes version.
    run_step playwright-browsers npx playwright install chromium
    run_step e2e npm run test:e2e
  fi
fi

# `npm audit` is advisory: reported, never gating.
AUDIT="$(npm audit --audit-level=high --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s).metadata.vulnerabilities;process.stdout.write(`critical=${v.critical} high=${v.high} moderate=${v.moderate} low=${v.low}`)}catch{process.stdout.write("unavailable")}})')"

echo
echo "## Local gate"
echo
echo "| step | result |"
echo "|---|---|"
for i in "${!NAMES[@]}"; do
  echo "| ${NAMES[$i]} | ${RESULTS[$i]} |"
done
echo
echo "audit (advisory): ${AUDIT}"
echo "full logs: ${LOGDIR}"
echo

if [[ $FAILED -eq 1 ]]; then
  echo "## Failure — ${FAILED_STEP}"
  echo
  echo '```'
  # Prefer the tail for test/build failures; npm resolution errors are also at the end.
  tail -120 "$FAILED_LOG"
  echo '```'
  echo
  echo "RESULT=FAIL step=${FAILED_STEP} log=${FAILED_LOG}"
  exit 1
fi

echo "RESULT=PASS"
