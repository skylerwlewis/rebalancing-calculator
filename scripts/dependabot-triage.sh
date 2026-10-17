#!/usr/bin/env bash
#
# dependabot-triage.sh — turn a failing Dependabot PR into a decision-ready report.
#
# Contract
#   Inputs        $1  Dependabot PR number or PR URL (required)
#                 --repo <owner/name>   default: derived from the `origin` remote
#                 --no-branch           report only; do not create/checkout a branch
#   Output        Markdown report on stdout:
#                   1. PR metadata
#                   2. package.json dependency change table with semver bump class
#                   3. CI failures (scripts/lib/ci-failures.mjs): bot result
#                      comments, every check and where its logs live, each
#                      failing test with its error, and per-test failure history
#                      (NEW vs PRE-EXISTING relative to this PR)
#                   4. Fix-branch state and a Summary block of key=value lines
#   Preconditions `gh` authenticated, `node` on PATH, clean git working tree.
#   Side effects  Fetches base + PR head refs. Unless --no-branch, creates and
#                 checks out `deps/<pr>-fix` off the PR head (idempotent: an
#                 existing branch is reused and any divergence is reported).
#
# Full CI logs are written to a temp dir and their paths printed, so the agent can
# grep for more detail without re-running `gh`.

set -euo pipefail

PR=""
REPO=""
MAKE_BRANCH=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --no-branch) MAKE_BRANCH=0; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) PR="${1%/}"; PR="${PR##*/}"; shift ;;
  esac
done

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "$PR" ]] || die "PR number required. usage: $0 <pr-number> [--repo owner/name] [--no-branch]"
command -v gh >/dev/null || die "gh CLI not found. Install with: brew install gh"
command -v node >/dev/null || die "node not found (required for dep-diff)."
gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolved from the cwd, not the script location, so the scripts keep working across
# branch switches (the fix branch may not contain scripts/ yet).
REPO_ROOT="$(git rev-parse --show-toplevel)" || die "not inside a git repository"
cd "$REPO_ROOT"

if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)" \
    || die "could not determine repo; pass --repo owner/name"
fi

if [[ $MAKE_BRANCH -eq 1 && -n "$(git status --porcelain)" ]]; then
  die "working tree is dirty. Commit or stash before triaging (branch checkout would fail)."
fi

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/dependabot-triage-${PR}.XXXXXX")"

# ---------------------------------------------------------------- PR metadata
meta="$(gh pr view "$PR" --repo "$REPO" \
  --json number,title,state,headRefName,baseRefName,mergeable,isDraft)" \
  || die "could not read PR #$PR from $REPO"

get() { node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(String(d[process.argv[1]]??""))' "$1" <<<"$meta"; }

TITLE="$(get title)"
STATE="$(get state)"
HEAD_REF="$(get headRefName)"
BASE_REF="$(get baseRefName)"
MERGEABLE="$(get mergeable)"
FIX_BRANCH="deps/${PR}-fix"

echo "# Dependabot triage — ${REPO} #${PR}"
echo
echo "**${TITLE}**"
echo
echo "| field | value |"
echo "|---|---|"
echo "| state | ${STATE} |"
echo "| mergeable | ${MERGEABLE} |"
echo "| head | \`${HEAD_REF}\` |"
echo "| base | \`${BASE_REF}\` |"
echo "| fix branch | \`${FIX_BRANCH}\` |"
echo "| url | https://github.com/${REPO}/pull/${PR} |"
echo

git fetch --quiet origin \
  "refs/heads/${BASE_REF}:refs/remotes/origin/${BASE_REF}" \
  "refs/heads/${HEAD_REF}:refs/remotes/origin/${HEAD_REF}" \
  || die "could not fetch ${BASE_REF} / ${HEAD_REF} from origin"

# --------------------------------------------------- package.json change table
git show "origin/${BASE_REF}:package.json" > "$WORKDIR/base.json"
git show "origin/${HEAD_REF}:package.json" > "$WORKDIR/head.json"

echo "## Dependency changes"
echo
DEPDIFF="$(node "$SCRIPT_DIR/lib/dep-diff.mjs" "$WORKDIR/base.json" "$WORKDIR/head.json")"
echo "$DEPDIFF" | grep -v '^MAJORS='
MAJORS="$(echo "$DEPDIFF" | sed -n 's/^MAJORS=//p')"
echo

# ------------------------------------------------------------- CI failure info
# Reads result comments, resolves every failing check (including API-created check
# runs that have no /actions/runs/ link) to its workflow run, extracts each failing
# test, and checks whether the same tests failed in earlier runs before this PR.
CI_REPORT="$(node "$SCRIPT_DIR/lib/ci-failures.mjs" --repo "$REPO" --pr "$PR" --workdir "$WORKDIR")" \
  || die "ci-failures.mjs failed; partial logs in $WORKDIR"
echo "$CI_REPORT" | grep -vE '^(FAILURE_CLASS|FAILED_TESTS|NEW_FAILURES|PREEXISTING_FAILURES|UNRESOLVED_CHECKS|PENDING_CHECKS)='
trailer() { echo "$CI_REPORT" | sed -n "s/^$1=//p"; }
FAILURE_CLASS="$(trailer FAILURE_CLASS)"
FAILED_TESTS="$(trailer FAILED_TESTS)"
NEW_FAILURES="$(trailer NEW_FAILURES)"
PREEXISTING_FAILURES="$(trailer PREEXISTING_FAILURES)"
UNRESOLVED_CHECKS="$(trailer UNRESOLVED_CHECKS)"
PENDING_CHECKS="$(trailer PENDING_CHECKS)"

# ------------------------------------------------------------------ fix branch
echo "## Fix branch"
echo
if [[ $MAKE_BRANCH -eq 1 ]]; then
  if git show-ref --verify --quiet "refs/heads/${FIX_BRANCH}"; then
    git switch --quiet "$FIX_BRANCH"
    behind="$(git rev-list --count "HEAD..origin/${HEAD_REF}")"
    echo "Reused existing \`${FIX_BRANCH}\` (checked out)."
    if [[ "$behind" -gt 0 ]]; then
      echo
      echo "WARNING: \`origin/${HEAD_REF}\` has ${behind} commit(s) not on this branch —"
      echo "Dependabot likely force-pushed a rebase. Reconcile before continuing."
    fi
  else
    git switch --quiet -c "$FIX_BRANCH" "origin/${HEAD_REF}"
    echo "Created \`${FIX_BRANCH}\` from \`origin/${HEAD_REF}\` (checked out)."
  fi
else
  echo "_Skipped (--no-branch)._"
fi
echo

# ----------------------------------------------------------------- next steps
echo "## Summary"
echo
echo "- FAILURE_CLASS: ${FAILURE_CLASS}"
echo "- FAILED_TESTS: ${FAILED_TESTS:-0}"
echo "- NEW_FAILURES: ${NEW_FAILURES:-none}"
echo "- PREEXISTING_FAILURES: ${PREEXISTING_FAILURES:-none}"
echo "- UNRESOLVED_CHECKS: ${UNRESOLVED_CHECKS:-none}"
echo "- PENDING_CHECKS: ${PENDING_CHECKS:-none}"
echo "- MAJOR_BUMPS: ${MAJORS:-none}"
echo "- FULL_LOGS: ${WORKDIR}"
echo
echo "Next: apply fixes, then run \`scripts/dependabot-verify.sh\`."
