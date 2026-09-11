---
description: "Fix a failing grouped Dependabot PR: triage the failure, hold back or adopt blocking majors, verify locally, and push a fix branch for review."
mode: agent
---

# Fix a failing Dependabot PR

Fix Dependabot PR **#${input:pr:Dependabot PR number}** so the update can land, and push a
branch the developer will open a PR from.

All data gathering is already scripted. Do not run `gh` by hand, do not read raw CI logs, and
do not diff `package-lock.json`. Your only job is the judgment calls in step 2.

## 1. Triage

```bash
./scripts/dependabot-triage.sh ${input:pr}
```

This prints the dependency change table, `FAILURE_CLASS`, the distilled CI error, and checks
out `deps/${input:pr}-fix`. If it exits non-zero, report the error and stop — do not improvise
around a failed precondition.

If it warns that Dependabot force-pushed a rebase, stop and ask the developer how to reconcile.

## 2. Decide, per blocking dependency

Work only on what is actually blocking. A `minor`/`patch` bump is presumed fine; leave it alone
unless it is named in the failure. For each blocker there are exactly two options:

**Adopt** — take the new version and fix our code. Choose this when the required work is
mechanical: renamed imports/props, changed config keys, updated type signatures, a documented
codemod. Read the package's own migration guide before editing; do not guess at an API.

**Hold back** — keep the version currently on `main`. Choose this when adoption needs
architectural change, when an upstream dependency has not caught up (a peer range that does not
yet include the new major), or when two adopt attempts have failed. Holding back is a normal,
successful outcome — it unblocks every other update in the group, which is the point.

To hold back a dependency:

1. Restore its range in `package.json` to the `from` value in the triage table.
2. Add an `ignore` entry to `.github/dependabot.yml` so it stops re-breaking the weekly group
   PR. Every entry needs a comment stating the blocker and the condition that clears it:

   ```yaml
   ignore:
     # <package>@<version> declares <the peer/API constraint that blocks the new major>.
     # Unblock when <the specific upstream release or migration that clears it>.
     - dependency-name: "@scope/*"
       update-types: ["version-update:semver-major"]
   ```

Never do any of these:

- Add an `overrides` entry to force a dependency past a peer range it does not support. That
  turns an install failure into a runtime failure. Use `overrides` only for genuine transitive
  tree conflicts, matching the existing entries in `package.json`.
- Pass `--force` or `--legacy-peer-deps`.
- Edit `package-lock.json` by hand. Let `npm install` regenerate it.
- Prune, rewrite, or re-review pre-existing `ignore` entries. Auditing accumulated ignores is a
  separate task.

Related deps move together: bump or hold every package in a scope as a set (all `@babel/*`, all
`@mui/*`, all `@testing-library/*`), never one member of a set on its own.

## 3. Verify locally

```bash
./scripts/dependabot-verify.sh
```

This runs install, lockfile CI parity, typecheck, unit tests, build, and e2e, and prints only
the failing step's output. Iterate until it prints `RESULT=PASS`. Use `--quick` while iterating
on typecheck errors, but the final run must be the full gate with no flags.

Two failure modes that are about our code, not the dependency, and should be fixed rather than
treated as a reason to hold back:

- A major UI dependency changes rendered markup, breaking `getByRole` / `getByText` selectors in
  `e2e/` or `*.test.tsx`. Update the selectors.
- A TypeScript major surfaces pre-existing type errors. Fix them if they are small.

If verification cannot pass after a reasonable number of attempts, revert to holding the
dependency back rather than leaving the branch broken.

## 4. Push

Commit with a message naming what was adopted and what was held back and why, then:

```bash
git push -u origin deps/${input:pr}-fix
```

Do **not** open a pull request. The developer opens it themselves, targeting `main` — never the
Dependabot branch, which gets force-pushed on rebase.

## 5. Report

Reply with only:

- One line per blocking dependency: adopted (and what changed) or held back (and the unblock
  condition).
- Any code changes made outside `package.json` / `dependabot.yml`.
- Final `dependabot-verify.sh` result.
- The pushed branch name and a PR-open link:
  `https://github.com/skylerwlewis/rebalancing-calculator/compare/main...deps/${input:pr}-fix?expand=1`
