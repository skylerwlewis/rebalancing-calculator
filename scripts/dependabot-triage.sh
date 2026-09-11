#!/usr/bin/env bash
#
# dependabot-triage.sh — turn a failing Dependabot PR into a decision-ready report.
#
# Contract
#   Inputs        $1  Dependabot PR number (required)
#                 --repo <owner/name>   default: derived from the `origin` remote
#                 --no-branch           report only; do not create/checkout a branch
#   Output        Markdown report on stdout:
#                   1. PR metadata
#                   2. package.json dependency change table with semver bump class
#                   3. FAILURE CLASS + the distilled CI error (not the raw log)
#                   4. Fix-branch state and next steps
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
    *) PR="$1"; shift ;;
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
echo "## CI failures"
echo

checks="$(gh pr checks "$PR" --repo "$REPO" --json name,state,link 2>/dev/null || echo '[]')"
run_ids="$(node -e '
  const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const ids = new Set();
  for (const c of d) {
    if (!/fail|cancel|timed/i.test(c.state ?? "")) continue;
    const m = String(c.link ?? "").match(/\/actions\/runs\/(\d+)/);
    if (m) ids.add(m[1]);
  }
  process.stdout.write([...ids].join("\n"));
' <<<"$checks")"

if [[ -z "$run_ids" ]]; then
  echo "_No failing checks reported. If the PR has not been built yet, there is nothing to distill._"
  echo
  FAILURE_CLASS="none"
else
  FAILURE_CLASS="unknown"
  while read -r run_id; do
    [[ -n "$run_id" ]] || continue
    raw="$WORKDIR/run-${run_id}.log"
    gh run view "$run_id" --repo "$REPO" --log-failed > "$raw" 2>/dev/null || true

    # Strip `job \t step \t <ISO timestamp> ` prefixes, then collapse the duplicate
    # blocks `--log-failed` emits for grouped steps.
    clean="$WORKDIR/run-${run_id}.clean.log"
    sed -E 's/^.*[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+Z ?//' "$raw" \
      | awk 'NF==0 || !seen[$0]++' > "$clean"

    if   grep -q 'ERESOLVE'                   "$clean"; then class="dependency-conflict"
    elif grep -qE 'error TS[0-9]+'            "$clean"; then class="typecheck"
    elif grep -qE '^(FAIL |Tests: .*failed)'  "$clean"; then class="unit-test"
    elif grep -qiE 'failed to compile|ERROR #' "$clean"; then class="build"
    else class="unknown"
    fi
    [[ "$FAILURE_CLASS" == "unknown" || "$FAILURE_CLASS" == "none" ]] && FAILURE_CLASS="$class"

    echo "### Run ${run_id} — \`${class}\`"
    echo
    echo "Log: https://github.com/${REPO}/actions/runs/${run_id}"
    echo

    if [[ "$class" == "dependency-conflict" ]]; then
      echo "The install step failed, so no tests ran. Key edges:"
      echo
      echo '```'
      grep -E 'While resolving:|^Found:|npm error (While resolving|Found|Could not resolve|Conflicting)|Could not resolve dependency|peer .*@|Conflicting peer dependency' "$clean" \
        | sed -E 's/^npm error ?//' | head -20
      echo '```'
    else
      echo '```'
      start="$(grep -nE '^(npm error|##\[error\]|error TS|.* error TS[0-9]+|FAIL |Error:|●)' "$clean" | head -1 | cut -d: -f1 || true)"
      start="${start:-1}"
      [[ "$start" -gt 3 ]] && start=$((start - 3))
      sed -n "${start},$((start + 79))p" "$clean" | grep -v '^##\[error\]Process completed'
      echo '```'
    fi
    echo
  done <<<"$run_ids"
fi

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
echo "- MAJOR_BUMPS: ${MAJORS:-none}"
echo "- FULL_LOGS: ${WORKDIR}"
echo
echo "Next: apply fixes, then run \`scripts/dependabot-verify.sh\`."
