---
name: dependabot-fix
description: "Fix a failing grouped Dependabot PR: triage the failure, separate pre-existing flakes from update-caused failures, hold back or adopt blocking majors, verify locally, and push a fix branch for review."
argument-hint: "<Dependabot PR number or URL>"
disable-model-invocation: true
---

# Fix a failing Dependabot PR

Fix the Dependabot PR given after the command (a PR number or URL) so the update can land, and push a branch the developer will open a PR from. Below, `<pr>` means that PR's number. If no PR was given, ask for it before doing anything else.

All data gathering is already scripted. Do not run `gh` by hand, do not read raw CI logs, and do not diff `package-lock.json`. Your only job is the judgment calls in step 2. If an error excerpt is too short to decide, grep the `Full log:` path the triage printed instead of re-fetching.

## 1. Triage

```bash
./scripts/dependabot-triage.sh <pr>
```

This prints the dependency change table, then the CI picture: the bot result comments, every check with where its logs live, each failing test with its error excerpt, and a per-test **History** verdict. It checks out `deps/<pr>-fix`. If it exits non-zero, report the error and stop — do not improvise around a failed precondition.

If it warns that Dependabot force-pushed a rebase, stop and ask the developer how to reconcile.

Read the `## Summary` block first. It decides which branch of step 2 applies:

| Summary says | Meaning | Go to |
|---|---|---|
| `PENDING_CHECKS` is non-empty | Some checks are still running (the preview E2E runs last, after the Cloudflare build), so the CI picture is incomplete | Stop. Report the pending checks with their run links and ask the developer to re-run triage once they finish |
| `FAILURE_CLASS: none` | Nothing failed on the PR head | Step 3 |
| A failing test is listed in `NEW_FAILURES`, or the class is `dependency-conflict` / `typecheck` / `lint` / `build` | Plausibly caused by this update | Step 2a |
| Every failing test is in `PREEXISTING_FAILURES` | The same test failed in earlier runs **before this PR existed**, so the update did not cause it | Step 2b |
| `FAILURE_CLASS: unknown` | Triage could not classify the failure | Inspect the printed excerpt or `Full log:`; don't treat an unclassified failure as pre-existing |
| `UNRESOLVED_CHECKS` is non-empty | Logs could not be located (e.g. an external Cloudflare build) | Open the link printed under that check; the Cloudflare line under *Result comments* shows deploy status |

## 2a. Decide, per blocking dependency

Work only on what is actually blocking. A `minor`/`patch` bump is presumed fine; leave it alone unless it is named in the failure. For each blocker there are exactly two options:

**Adopt** — take the new version and fix our code. Choose this when the required work is mechanical: renamed imports/props, changed config keys, updated type signatures, a documented codemod. Read the package's own migration guide before editing; do not guess at an API.

**Hold back** — keep the version currently on `main`. Choose this when adoption needs architectural change, when an upstream dependency has not caught up (a peer range that does not yet include the new major), or when two adopt attempts have failed. Holding back is a normal, successful outcome — it unblocks every other update in the group, which is the point.

To hold back a dependency:

1. Restore its range in `package.json` to the `from` value in the triage table.
2. Add an `ignore` entry to `.github/dependabot.yml` so it stops re-breaking the weekly group PR. Every entry needs a comment stating the blocker and the condition that clears it:

   ```yaml
   ignore:
     # <package>@<version> declares <the peer/API constraint that blocks the new major>.
     # Unblock when <the specific upstream release or migration that clears it>.
     - dependency-name: "@scope/*"
       update-types: ["version-update:semver-major"]
   ```

Never do any of these:

- Add an `overrides` entry to force a dependency past a peer range it does not support. That turns an install failure into a runtime failure. Use `overrides` only for genuine transitive tree conflicts, matching the existing entries in `package.json`.
- Pass `--force` or `--legacy-peer-deps`.
- Edit `package-lock.json` by hand. Let `npm install` regenerate it.
- Prune, rewrite, or re-review pre-existing `ignore` entries. Auditing accumulated ignores is a separate task.

Related deps move together: bump or hold every package in a scope as a set (all `@babel/*`, all `@mui/*`, all `@testing-library/*`), never one member of a set on its own.

## 2b. Pre-existing failures are not blockers

A test in `PREEXISTING_FAILURES` is not a reason to adopt or hold back anything. Leave the dependency changes as-is and handle the test by its verdict:

- **PRE-EXISTING, INTERMITTENT** (flake): find the root cause from the error excerpt and the difference between the environment where it fails and where it passes (e.g. it fails only in the *Preview* E2E run but passes in the *CI Build* one on the same commit). If the fix is test-only:
  1. Reproduce the failure locally by simulating that condition. For example, delay requests with `page.route` to mimic a slow remote preview. A local pass without reproducing the condition proves nothing about a flake.
  2. Apply the fix and show it passes under the same simulated condition, using `--repeat-each` to check it stays stable.
  3. Commit it separately on the fix branch.

  If you can't reproduce it or the fix is not test-only, don't change code. Report the evidence from the History table and recommend re-running the check.
- **PRE-EXISTING, CONSISTENT**: `main` was already broken. Report it; do not fix it on this branch.

Before diagnosing an E2E flake, check the existing E2E specs, `playwright.config.ts`, and the AGENTS.md *E2E gotchas* section (where present) for known causes and app-specific setup and timing assumptions.

## 3. Verify locally

```bash
./scripts/dependabot-verify.sh
```

This runs install, lockfile CI parity, typecheck, lint, unit tests, build, and e2e, and prints only the failing step's output. Iterate until it prints `RESULT=PASS`. Use `--quick` while iterating on typecheck errors, but the final run must be the full gate with no flags.

Two failure modes that are about our code, not the dependency, and should be fixed rather than treated as a reason to hold back:

- A major UI dependency changes rendered markup, breaking `getByRole` / `getByText` selectors in `e2e/` or `*.test.tsx`. Update the selectors.
- A TypeScript major surfaces pre-existing type errors. Fix them if they are small.
- An ESLint plugin or typescript-eslint update adds or tightens rules. Fix the new violations if they are small; do not loosen `eslint.config.mjs` to get past them.

If verification cannot pass after a reasonable number of attempts, revert to holding the dependency back rather than leaving the branch broken.

## 4. Push

Commit with a message naming what was adopted and what was held back and why, then:

```bash
git push -u origin deps/<pr>-fix
```

Do **not** open a pull request. The developer opens it themselves, targeting `main` — never the Dependabot branch, which gets force-pushed on rebase.

## 5. Report

Reply with only:

- One line per blocking dependency: adopted (and what changed) or held back (and the unblock condition).
- One line per pre-existing failure: the test, its History verdict with the earlier-failure count, and whether it was fixed (with the reproduction used) or left for a re-run.
- Any code changes made outside `package.json` / `dependabot.yml`.
- Final `dependabot-verify.sh` result.
- The pushed branch name and a PR-open link, with `<owner>/<repo>` taken from the triage report's title line: `https://github.com/<owner>/<repo>/compare/main...deps/<pr>-fix?expand=1`
