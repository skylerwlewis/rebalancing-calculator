# AGENTS.md — rebalancing-calculator

Guidelines for AI agents working in this repo. Focus on non-obvious conventions and gotchas.

**Agents: keep this file current.** When you encounter a pattern, constraint, or gotcha not documented here — or when a conversation surfaces a new convention (a wording standard, a sync rule, a workflow decision) — propose the addition before ending your response. The developer may not think to ask. Gaps in this file become drift in the codebase.

---

## Project Summary

React + TypeScript single-page app built with Vite and deployed to Cloudflare Workers at **https://rebalance.skylerlewis.io**.

A browser-based portfolio rebalancing calculator: the user lists their funds with current balances and target percentages, enters an amount to invest, and the app shows how much to put into each fund so the portfolio moves toward its targets. Everything runs in the browser; there is no backend and no stored user data.

---

## Build & Common Commands

```bash
npm run typecheck       # Run all 3 TypeScript checks (app, node, e2e) via tsc -b
npm run lint            # ESLint (typescript-eslint strict type-checked, eslint.config.mjs)
npm test                # Vitest unit tests (watch mode in a terminal; add `-- --run` for one run)
npm run test:e2e        # Playwright e2e tests (auto-starts the Vite dev server on :5174 if needed)
npm run build           # tsc -b + Vite build → ./build/
npm run dev             # Vite dev server with hot reload
npm run deploy          # Build + wrangler deploy (production)
npm run preview         # Build + wrangler dev (local Worker preview)
```

After any code change, run `npm run typecheck` and `npm run lint` before committing.

---

## Dependency Updates (Dependabot)

`.github/dependabot.yml` groups **every** npm update into a single weekly PR (`patterns: ["*"]`). This is deliberate — CI concurrency is scarce, and one PR means one CI run. The tradeoff is that a single incompatible major blocks every other update in the group, so grouped PRs fail more often than individual ones.

### Two groups, not one

There are two `groups` entries: `all-dependencies` (`applies-to: version-updates`) and `all-security-updates` (`applies-to: security-updates`). **`applies-to` defaults to `version-updates`**, so a single wildcard group only collapses version updates — security updates would still be raised one PR per vulnerable dependency, and they are exempt from `open-pull-requests-limit`. Both groups are required to keep the open-PR count at its floor.

Dependabot cannot merge version updates and security updates into the same PR, so the steady-state maximum is **two** open Dependabot PRs: one grouped version-update PR and one grouped security-update PR. Security updates also fire on transitive dependencies (`axios`, `engine.io`, etc.) that never appear in `package.json` — seeing an unfamiliar package name in a Dependabot PR usually means it is a security update, not a version update.

### Fixing a failing grouped PR

Use the `/dependabot-fix` skill ([`.github/skills/dependabot-fix/SKILL.md`](.github/skills/dependabot-fix/SKILL.md)), invoked as `/dependabot-fix <pr# or URL>`, which drives two scripts:

| Script | Contract |
|---|---|
| [`scripts/dependabot-triage.sh`](scripts/dependabot-triage.sh) `<pr# or URL>` | Prints PR metadata, a semver-classified dependency change table, and the CI report from `ci-failures.mjs`, then a `## Summary` block (`FAILURE_CLASS`, `NEW_FAILURES`, `PREEXISTING_FAILURES`, `UNRESOLVED_CHECKS`, `PENDING_CHECKS`, `MAJOR_BUMPS`). Creates and checks out `deps/<pr#>-fix` off the Dependabot head. |
| [`scripts/dependabot-verify.sh`](scripts/dependabot-verify.sh) | Runs install → `npm ci` lock parity → typecheck → lint → unit tests → build → Playwright browser install → e2e. Prints a pass/fail table and only the failing step's output. |

Shared modules used by triage:

- [`scripts/lib/dep-diff.mjs`](scripts/lib/dep-diff.mjs) classifies version changes in `package.json`.
- [`scripts/lib/ci-failures.mjs`](scripts/lib/ci-failures.mjs) builds the CI picture. It reads the bot result comments, resolves every failing check to its Actions run (including API-created check runs; see *GitHub Workflows*), and extracts each failing Playwright, Vitest, or Jest test with its error. It then checks earlier runs of the same workflow and labels each test **NEW** or **PRE-EXISTING** (intermittent or consistent) relative to the PR's creation date. A pre-existing failure was not caused by the update.

Prerequisites: `gh` (authenticated), Node 24.

### Rules for resolving blocked updates

- Two options only per blocker: **adopt** (take the new version, fix our code) or **hold back** (restore `main`'s range + add a documented `ignore`). Holding back is a success, not a failure — it unblocks the rest of the group.
- A test that triage lists as **PRE-EXISTING** is not a blocker. Don't adopt or hold back anything because of it. Fix it as a separate commit only if it's an intermittent flake you can reproduce locally; otherwise report it and re-run the check.
- Every `ignore` entry in `.github/dependabot.yml` must carry a comment stating the blocker and the condition that clears it.
- **Never** use `overrides` to force a dependency past a peer range it does not support — that converts an install failure into a runtime failure. `overrides` is only for genuine transitive tree conflicts.
- Never use `--force` or `--legacy-peer-deps`. Never hand-edit `package-lock.json`.
- The fix branch PRs into `main`, never into the Dependabot branch — Dependabot force-pushes that branch on rebase. Merging the fix branch to `main` makes Dependabot auto-close its own PR.

Reviewing accumulated `ignore` entries to see whether blockers have cleared is a **separate task**, not part of this flow. Do not prune ignores while fixing a PR.

---

## Architecture

### Single-Page App Only

This is a client-only React single-page app built by Vite — there are no Cloudflare Worker functions or backend routes. `@cloudflare/vite-plugin` writes `build/wrangler.json` during `npm run build`, and `wrangler.toml` serves the build as static assets with `not_found_handling = "single-page-application"`, so client-side routes fall back to `index.html`.

### Deployment

One Cloudflare Workers project (`rebalancing-calculator`) deploys from the `main` branch via `wrangler deploy`. Cloudflare provides a per-commit preview URL for every deployment; the `e2e-preview.yml` workflow runs Playwright against it via the `BASE_URL` env var.

### State and URL Sharing

Input state lives in React Context providers, nested in `App.tsx` in this order:

1. `UrlParamInputProvider` reads the `input` query parameter and decompresses it (lz-string + JSON5) into initial input values.
2. `InputProvider` owns the input state, seeded from the URL.
3. `InputUrlParamProvider` compresses the current input back into the string that `ShareModal` turns into the share link.

Each context object lives in its own `*Context.ts` module, separate from its `*Provider.tsx`, so that provider files export only components (required by the `react-refresh/only-export-components` lint rule).

**The `InputUrlParams` keys are a public contract.** Shared and bookmarked links encode them, so renaming or removing a key breaks existing links. Add new optional keys instead, and keep parsing old ones.

**Money and percentages use big.js (`Big`), never JS `number`.** User-editable fields keep the input string alongside the parsed `Big` value. `isBig()` accepts thousands separators, so strip commas from user input before calling `new Big()` on it.

---

## Fund Grid and Calculation

The app is one page (`src/input/InputView.tsx`). Funds are edited in an MUI X `DataGrid`; the rebalancing math is in `src/calculator/Calculator.ts`.

**`@mui/x-data-grid` is pinned to 6.18.2.** Later versions re-render only the edited row after a cell edit, leaving computed values in sibling rows stale. `e2e/regression.spec.ts` guards this. React 19 and MUI 9 are also held back. Both holds are documented in `.github/dependabot.yml` and are waiting on the `deps/113-datagrid-followup` branch.

**`vite.config.ts` aliases `@mui/icons-material/<Icon>` to its ESM build.** Vite 8 (Rolldown) does not apply CJS interop to the pre-bundled icon files, so without the alias the icons import as plain objects instead of components. Keep it until the app moves to an icons version that no longer needs it.

---

## TypeScript Configuration

Three separate tsconfig files, built together with `tsc -b`:

| File | Used for |
|---|---|
| `tsconfig.app.json` | `src/**` |
| `tsconfig.node.json` | Config files (`vite.config.ts`, `playwright.config.ts`) |
| `e2e/tsconfig.json` | Playwright tests (extends `tsconfig.node.json`, adds DOM lib) |

`tsconfig.json` at the root is a solution file that references all three — it has no `include` of its own. All three use bundler mode with `noEmit`; Vite does the transpiling, so `target` and `lib` affect type checking only.

**TypeScript is pinned to `~6.0.3`.** typescript-eslint (and so `npm run lint`) supports only `typescript <6.1.0`, and TypeScript 7 has no JS API for it to use. The `typescript` entry in `.github/dependabot.yml` holds every release from 6.1.0 on; move to a newer TypeScript only together with a typescript-eslint release that supports it.

---

## Testing

### Unit Tests (Vitest)

- Environment: jsdom (configured in the `test` block of `vite.config.ts`)
- Run with: `vitest` (via `npm test`). In a terminal it starts watch mode; use `npm test -- --run` for a single run. CI and `dependabot-verify.sh` run it without a TTY, so it runs once.
- Test files: `src/**/*.{test,spec}.{ts,tsx}`
- Setup: `src/setupTests.ts` registers the `@testing-library/jest-dom` matchers and cleans up after each test

### E2E Tests (Playwright)

- Chromium only, single Desktop Chrome viewport
- Playwright auto-starts the Vite dev server on `:5174` if no `BASE_URL` is set and no server is already running (see `playwright.config.ts`); no build is needed
- CI workflows set `PLAYWRIGHT_CHANNEL=chrome` and skip `playwright install`; the runner's preinstalled Chrome is the intended browser path in GitHub Actions, while local runs should keep using Playwright's normal browser setup.

**E2E gotchas:**
- **`getByText()` strict mode violations** — `getByText(str)` matches *all* elements whose text content contains `str`. If more than one element matches, Playwright throws a strict mode violation even on `toBeVisible()`. Always use a substring specific enough to match exactly one element. If in doubt, scope the locator to a parent element or use `.first()`.
- **DataGrid cell editing** — Click the cell, press the first character to enter edit mode, wait for the cell's `input`, then call `pressSequentially()` on that input. Typing with `page.keyboard` before the input renders drops characters. DataGrid v6 debounces edits by 200ms, so assert the input value and wait 250ms before committing with Tab or Enter. `e2e/regression.spec.ts` shows the full pattern.
- **Assert sibling rows** — The pinned-DataGrid regression shows up only in rows you did not edit. When testing an edit, also assert a computed value in another row.

---

## Code Style

- **Arrow functions preferred** over function declarations (components, handlers)
- **MUI `sx` prop** for styling new code (not CSS modules, not styled-components)
- **Strict TypeScript** — no `any`
- **Feature folders** in `src/` — each feature has its own directory
- **big.js for all money and percentage math**

---

## GitHub Workflows

### `ci.yml` (triggers on PR)

1. **Typecheck** — runs all 3 `tsc` checks via `tsc -b`
2. **Lint** — runs `npm run lint` (ESLint with `eslint.config.mjs`)
3. **Unit Tests** — runs Vitest with `--run --reporter=verbose --reporter=json --outputFile=test-results/vitest-results.json`, then posts a results table to the Job Summary and a PR comment (marker: `<!-- vitest-test-results -->`)
4. **E2E Tests** — builds the app (`npm run build`), runs Playwright against the Vite dev server that `playwright.config.ts` starts, posts a results table to the Job Summary and a PR comment (marker: `<!-- playwright-ci-results -->`)

### `e2e-preview.yml` (triggers on `check_run: completed`)

Both workflows are thin callers of reusable workflows in [`skylerwlewis/test-actions`](https://github.com/skylerwlewis/test-actions) (`@v1`).

1. Fires when Cloudflare's `Workers Builds: …` check completes successfully. Because the trigger is `check_run`, the Actions run executes in the context of `main` (its `headBranch` is `main`, and its `headSha` is not the PR's), so it **does not appear on the PR's Actions tab**.
2. `find-preview-for-check-run.yml` maps the check's `head_sha` to the open PR, reads the preview URL from the Cloudflare check output (falling back to the bot comment), and creates an `E2E Tests (Preview)` check run on the PR head through the Checks API. Its log prints `Created check run <id>`.
3. `e2e-from-url.yml` runs Playwright with `BASE_URL` set to the preview, upserts the `<!-- playwright-preview-results -->` comment, and completes that check run.

**Finding the logs for a failed preview check:** the PR check links to `/runs/<check-run-id>`, not `/actions/runs/<run-id>`. `GITHUB_TOKEN` cannot set `details_url` because GitHub overrides it (see `test-actions` commit `aca72fb`). Instead, the check output and the `<!-- playwright-preview-results -->` comment carry a `Logs: [workflow run <id>](…)` link, and `external_id` holds the run ID. Both are written when the check is **created**, so the link works even for checks that are still running or were cancelled. `scripts/lib/ci-failures.mjs` uses that link. Only checks created before test-actions v1.3.0 (2026-10-17) lack it. For those, a legacy fallback finds the run whose log contains `Created check run <id>`; it can be removed after 2027-01-15, when 90-day log retention has expired every such run. A newer check without the link is reported as a `test-actions` regression rather than silently searched for. Don't search the Actions tab by name and time.

**PR comment upsert pattern** — All workflow steps that post PR comments use an invisible HTML marker comment (e.g., `<!-- vitest-test-results -->`, `<!-- playwright-ci-results -->`, `<!-- playwright-preview-results -->`) as the first line of the comment body. The step lists existing comments, finds one containing the marker, and updates it — otherwise creates a new one. Any new PR comment step must follow this pattern to avoid duplicate comments on re-runs.

**GitHub Actions supply chain policy** — This repo uses **only `actions/*` first-party actions**. Do not suggest or add third-party actions (e.g., from the marketplace). For any custom workflow logic, use inline scripts via `actions/github-script@v7` instead, which keeps the trust surface minimal.

**Playwright browser setup** — CI workflows intentionally avoid downloading Playwright-managed Chromium. If you touch `.github/workflows/` or `playwright.config.ts`, preserve the split between local Playwright browser behavior and CI's preinstalled Chrome channel.

---

## Other Things to Know

- **No global state library** — Input and calculated state live in React Context providers (see *State and URL Sharing*). No Redux.
- **Node version** — Node 24 required (`engines.node: "^24.13.1"` in `package.json`).
- **Files kept in sync with other repos** — These files are byte-identical copies of the same files in other repos that use this tooling: `scripts/dependabot-triage.sh`, `scripts/dependabot-verify.sh`, `scripts/lib/*.mjs`, `.github/skills/dependabot-fix/SKILL.md`, `eslint.config.mjs`, and `e2e/tsconfig.json`. The first block of `.github/dependabot.yml` (through the shared `eslint` / `typescript` holds) is shared too. Change every copy together, never just one.
