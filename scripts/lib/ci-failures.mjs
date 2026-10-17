#!/usr/bin/env node
/**
 * ci-failures.mjs — explain why a PR's checks failed, and whether the failures are new.
 *
 * Contract
 *   Inputs        --repo <owner/name>   (required)
 *                 --pr <number>         (required)
 *                 --workdir <dir>       (required) raw + cleaned logs are written here
 *                 --history-days <n>    default 90; window for the flake-history lookup
 *   Output        Markdown on stdout, in this order:
 *                   1. Result comments: one line per bot results comment on the PR
 *                      (marker comments such as <!-- playwright-preview-results -->)
 *                   2. Checks: every check on the PR head and where its logs live
 *                   3. Failures: per failing check, the resolved Actions run, the
 *                      failure class, and each failing Playwright, Vitest, or Jest
 *                      test with its error excerpt
 *                   4. History: per failing test, how often it failed in earlier runs
 *                      of the same workflow, and whether any failures predate the PR
 *                 Trailer lines (machine-readable, always printed last):
 *                   FAILURE_CLASS=<none|dependency-conflict|typecheck|lint|unit-test|e2e|build|unknown>
 *                   FAILED_TESTS=<count>
 *                   NEW_FAILURES=<test ids, "; "-separated>
 *                   PREEXISTING_FAILURES=<test ids, "; "-separated>
 *                   UNRESOLVED_CHECKS=<check names whose logs could not be located>
 *                   PENDING_CHECKS=<check names still running; the CI picture is incomplete>
 *   Preconditions `gh` on PATH and authenticated.
 *   Side effects  Writes log files under --workdir. Read-only against GitHub.
 *
 * Why this exists: some checks are not created by a workflow run directly. The preview
 * E2E check is created through the Checks API by skylerwlewis/test-actions
 * (find-preview-for-check-run.yml), so its link is /runs/<check-run-id> rather than
 * /actions/runs/<run-id>, and GITHUB_TOKEN cannot set details_url to fix that. Since
 * test-actions v1.3.0 the check's output and external_id carry the run link from creation,
 * which is the primary path. Older checks fall back to a legacy log search for the run that
 * logged "Created check run <id>" (verified, not a time guess); see LINKED_CHECKS_SINCE.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ------------------------------------------------------------------ args / gh helpers

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const REPO = args.repo;
const PR = args.pr;
const WORKDIR = args.workdir;
const HISTORY_DAYS = Number(args["history-days"] ?? 90);
const HISTORY_MAX_RUNS = 15;

if (!REPO || !PR || !WORKDIR) {
  console.error("usage: ci-failures.mjs --repo owner/name --pr <n> --workdir <dir> [--history-days 90]");
  process.exit(2);
}
mkdirSync(WORKDIR, { recursive: true });

/** Run gh and surface command failures instead of turning them into empty reports. */
const gh = (ghArgs, { tolerateExit = false } = {}) => {
  const r = spawnSync("gh", ghArgs, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  if (r.error) {
    throw new Error(`ci-failures: could not start gh: ${r.error.message}`);
  }
  if (r.status !== 0 && !(tolerateExit && r.stdout)) {
    throw new Error(`ci-failures: gh ${ghArgs.join(" ")} failed: ${r.stderr.trim() || `exit ${r.status}`}`);
  }
  return r.stdout;
};
const ghJson = (ghArgs, opts) => {
  const out = gh(ghArgs, opts);
  try {
    return JSON.parse(out);
  } catch (err) {
    throw new Error(`ci-failures: gh ${ghArgs.join(" ")} returned invalid JSON: ${err.message}`);
  }
};

const SERVER = "https://github.com";
const runUrl = (id) => `${SERVER}/${REPO}/actions/runs/${id}`;
const day = (iso) => String(iso).slice(0, 10);

/** Strip `job \t step \t <timestamp> ` prefixes from `gh run view --log[-failed]` output. */
const cleanLog = (raw) =>
  raw
    .split("\n")
    .map((l) => l.replace(/^[^\t]*\t[^\t]*\t/, "").replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/, ""))
    .join("\n");

const logCache = new Map();
/** Cleaned failed-step log for a run, cached on disk under the workdir. */
const failedLog = (runId) => {
  if (logCache.has(runId)) return logCache.get(runId);
  const cleanPath = join(WORKDIR, `run-${runId}.clean.log`);
  let text = "";
  if (existsSync(cleanPath)) {
    text = readFileSync(cleanPath, "utf8");
  } else {
    const raw = gh(["run", "view", String(runId), "--repo", REPO, "--log-failed"]);
    writeFileSync(join(WORKDIR, `run-${runId}.log`), raw);
    text = cleanLog(raw);
    writeFileSync(cleanPath, text);
  }
  logCache.set(runId, text);
  return text;
};

// ------------------------------------------------------------------ PR + comments

const pr = ghJson(["pr", "view", PR, "--repo", REPO, "--json", "createdAt,headRefOid"]);
if (!pr) {
  console.error(`ci-failures: could not read PR #${PR} from ${REPO}`);
  process.exit(1);
}

const comments = ghJson(["api", "--paginate", `repos/${REPO}/issues/${PR}/comments?per_page=100`]);
if (!Array.isArray(comments)) {
  throw new Error("ci-failures: expected the PR comments response to be a JSON array");
}

console.log("## Result comments");
console.log("");
const resultLines = [];
const seenMarkers = new Map();
for (const c of comments) {
  const marker = c.body?.match(/^<!--\s*([\w-]+)\s*-->/)?.[1];
  if (marker) seenMarkers.set(marker, c);
}
for (const [marker, c] of seenMarkers) {
  const heading = c.body.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? "(no heading)";
  const counts = [...c.body.matchAll(/^\|\s*(?:\S+\s+)?\**([A-Za-z]+)\**\s*\|\s*\**(\d+)\**\s*\|$/gm)]
    .map((m) => `${m[1]} ${m[2]}`)
    .join(" · ");
  // The shared reporter marks ✅ whenever failed === 0, including when no tests ran at all.
  const zeroRan = /\bTotal 0\b/.test(counts) ? " — ⚠️ zero tests ran (install/build likely failed first)" : "";
  const logsRun = c.body.match(/^Logs:.*\/actions\/runs\/(\d+)/m)?.[1];
  const logs = logsRun ? ` — logs: [run ${logsRun}](${runUrl(logsRun)})` : "";
  resultLines.push(`- \`${marker}\` — ${heading}${counts ? ` — ${counts}` : ""}${zeroRan}${logs} (updated ${c.updated_at})`);
}
for (const c of comments) {
  if (!/cloudflare/i.test(c.user?.login ?? "")) continue;
  const failed = /Build failed|Deployment failed/.test(c.body);
  resultLines.push(
    `- Cloudflare deployment — ${failed ? "❌ build/deployment failed" : "✅ deployed"} (updated ${c.updated_at})`,
  );
}
console.log(resultLines.length ? resultLines.join("\n") : "_No bot result comments on this PR._");
console.log("");

// ------------------------------------------------------------------ checks

const checks = (() => {
  try {
    return ghJson(["pr", "checks", PR, "--repo", REPO, "--json", "name,bucket,link,workflow,startedAt"], {
      tolerateExit: true,
    });
  } catch (err) {
    // A PR whose checks have not registered yet is an empty picture, not an error.
    if (/no checks reported/.test(err.message)) return [];
    throw err;
  }
})();
if (!Array.isArray(checks)) {
  throw new Error("ci-failures: expected the PR checks response to be a JSON array");
}

// test-actions v1.3.0 (v1 moved here on 2026-10-17) writes the workflow run link into every
// preview check's output + external_id when the check is created. Only checks created before
// that carry no link and need the legacy log search below.
// Remove the legacy log search after 2027-01-15: Actions logs are kept 90 days, so every
// pre-v1.3.0 run's log will have expired and the search can no longer succeed.
const LINKED_CHECKS_SINCE = "2026-10-17T15:00:00Z";

/**
 * Map a check's link to where its logs live.
 * `legacySearch` allows the slow pre-v1.3.0 fallback (downloads candidate run logs); it is
 * only worth paying for checks we actually need to diagnose.
 */
const resolveCheck = (check, { legacySearch = true } = {}) => {
  const link = String(check.link ?? "");
  const actions = link.match(/\/actions\/runs\/(\d+)/);
  if (actions) return { runId: actions[1], how: "link" };

  const checkRun = link.match(/github\.com\/[^/]+\/[^/]+\/runs\/(\d+)/);
  if (!checkRun) return { runId: null, how: "external (no GitHub logs)" };

  const id = checkRun[1];
  const cr = ghJson(["api", `repos/${REPO}/check-runs/${id}`]);
  if (!cr) return { runId: null, how: `check run ${id} unreadable` };
  const output = [cr.output?.title, cr.output?.summary].filter(Boolean).join(" — ");

  const viaDetails = String(cr.details_url ?? "").match(/\/actions\/runs\/(\d+)/);
  if (viaDetails) return { runId: viaDetails[1], how: `check run ${id} details_url`, output };

  // Primary path for API-created checks: test-actions writes
  // "Logs: [workflow run <id>](…/actions/runs/<id>)" into the output and the run id into
  // external_id, because GITHUB_TOKEN cannot set details_url.
  const viaOutput = `${cr.output?.summary ?? ""}\n${cr.output?.text ?? ""}`.match(/\/actions\/runs\/(\d+)/);
  if (viaOutput) return { runId: viaOutput[1], how: `check run ${id} output link`, output };
  if (/^\d+$/.test(cr.external_id ?? "")) {
    return { runId: cr.external_id, how: `check run ${id} external_id`, output };
  }

  const startedIso = cr.started_at ?? check.startedAt;
  if (startedIso >= LINKED_CHECKS_SINCE) {
    return {
      runId: null,
      how:
        `check run ${id} has no run link in output or external_id, but every check created since ` +
        `test-actions v1.3.0 should. The test-actions contract may have regressed`,
      output,
    };
  }
  if (!legacySearch) return { runId: null, how: `check run ${id} predates run links (legacy)`, output };

  // Legacy (pre-v1.3.0) check: find the run whose log says it created this check. The time
  // window only narrows the candidates; the log line is what verifies the match.
  const started = new Date(startedIso).getTime();
  const from = new Date(started - 30 * 60_000).toISOString();
  const to = new Date(started + 5 * 60_000).toISOString();
  const runResponse = ghJson(["api", `repos/${REPO}/actions/runs?created=${from}..${to}&per_page=100`]);
  if (!Array.isArray(runResponse.workflow_runs)) {
    throw new Error("ci-failures: expected the workflow runs response to include a workflow_runs array");
  }
  const runs = runResponse.workflow_runs.filter((r) => r.event === "check_run");
  runs.sort(
    (a, b) =>
      (b.name === cr.name) - (a.name === cr.name) ||
      Math.abs(new Date(a.created_at) - started) - Math.abs(new Date(b.created_at) - started),
  );
  for (const run of runs.slice(0, 8)) {
    const log = gh(["run", "view", String(run.id), "--repo", REPO, "--log"]);
    if (new RegExp(`Created check run ${id}\\b`).test(log)) {
      return { runId: String(run.id), how: `check run ${id} → legacy log search "Created check run ${id}" (verified)`, output };
    }
  }
  return { runId: null, how: `check run ${id}: legacy log search found no run in ${from}..${to} that created it`, output };
};

console.log("## Checks");
console.log("");
console.log("| check | result | logs |");
console.log("|---|---|---|");
const failing = [];
const pending = [];
for (const c of checks) {
  const bad = c.bucket === "fail" || c.bucket === "cancel";
  const waiting = c.bucket === "pending";
  // Pending checks resolve cheaply (run links are written at creation), so a still-running
  // preview E2E points at its live run instead of looking like "nothing failed".
  const res = bad ? resolveCheck(c) : waiting ? resolveCheck(c, { legacySearch: false }) : null;
  if (bad) failing.push({ check: c, ...res });
  if (waiting) pending.push(c.name);
  const where = res?.runId ? `[run ${res.runId}](${runUrl(res.runId)})` : res ? res.how : c.link || "—";
  const result = bad ? `❌ ${c.bucket}` : waiting ? "⏳ pending" : c.bucket;
  console.log(`| ${c.name} | ${result} | ${where} |`);
}
if (checks.length === 0) console.log("| _none reported_ | | |");
console.log("");
if (pending.length) {
  console.log(`⚠️ ${pending.length} check(s) still pending — the CI picture is incomplete.`);
  console.log("");
}

// ------------------------------------------------------------------ failure parsing

const classify = (log) => {
  if (/ERESOLVE/.test(log)) return "dependency-conflict";
  if (/error TS\d+/.test(log)) return "typecheck";
  if (/^\s*\d+:\d+\s+error\s/m.test(log)) return "lint";
  if (/^\s+\d+\) \[[^\]]+\] › /m.test(log)) return "e2e";
  if (
    /^\s*● /m.test(log) ||
    /^Tests: .*failed/m.test(log) ||
    /^\s*FAIL\b/m.test(log) ||
    /^\s*(?:Test Files|Tests)\s+\d+\s+failed/m.test(log)
  ) return "unit-test";
  if (/failed to compile|ERROR #/i.test(log)) return "build";
  return "unknown";
};

const isPlaywrightHeader = (l) => /^\s+\d+\) \[[^\]]+\] › /.test(l);

/** Playwright's final list-reporter summary: `  1) [chromium] › file:line:col › title ───`. */
const parsePlaywright = (log) => {
  const lines = log.split("\n");
  const tests = new Map();
  lines.forEach((line, i) => {
    const m = line.match(/^\s+\d+\) \[[^\]]+\] › (\S+?):\d+:\d+ › (.+?)\s*─*\s*$/);
    if (!m) return;
    const excerpt = [];
    for (let j = i + 1; j < lines.length && excerpt.length < 25; j++) {
      const l = lines[j];
      if (isPlaywrightHeader(l) || /^\s+Retry #\d/.test(l) || /^\s+\d+ (failed|flaky|passed)/.test(l)) break;
      if (/Error Context:|attachment #|test-results\/|show-trace|Usage:/.test(l)) continue;
      excerpt.push(l);
    }
    // Last occurrence wins: the end-of-run summary is the cleanest copy.
    tests.set(`${m[1]} › ${m[2]}`, { file: m[1], title: m[2], excerpt: trimBlank(excerpt) });
  });
  return [...tests.values()];
};

/** Jest failure headers: `  ● Suite › test name`. */
const parseJest = (log) => {
  const lines = log.split("\n");
  const tests = new Map();
  lines.forEach((line, i) => {
    const m = line.match(/^\s*● (.+?)\s*$/);
    if (!m || tests.has(m[1])) return;
    const excerpt = [];
    for (let j = i + 1; j < lines.length && excerpt.length < 25; j++) {
      if (/^\s*● /.test(lines[j])) break;
      excerpt.push(lines[j]);
    }
    tests.set(m[1], { file: null, title: m[1], excerpt: trimBlank(excerpt) });
  });
  return [...tests.values()];
};

/** Vitest failure headers: ` FAIL  file.test.ts > Suite > test name`. */
const parseVitest = (log) => {
  const lines = log.split("\n");
  const tests = new Map();
  lines.forEach((line, i) => {
    const m = line.match(/^\s*FAIL\s+(.+?\.(?:test|spec)\.[cm]?[jt]sx?)\s+>\s+(.+?)\s*$/);
    const id = m && `${m[1]} › ${m[2]}`;
    if (!m || tests.has(id)) return;
    const excerpt = [];
    for (let j = i + 1; j < lines.length && excerpt.length < 25; j++) {
      if (
        /^\s*FAIL\s+.+?\.(?:test|spec)\.[cm]?[jt]sx?\s+>/.test(lines[j]) ||
        /^\s*(?:Test Files|Tests)\s+\d+/.test(lines[j])
      ) break;
      excerpt.push(lines[j]);
    }
    tests.set(id, {
      file: m[1],
      title: m[2],
      runner: "vitest",
      excerpt: trimBlank(excerpt),
    });
  });
  return [...tests.values()];
};

const trimBlank = (ls) => {
  const out = ls.filter((l, i) => l.trim() || (i > 0 && ls[i - 1].trim()));
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out.at(-1).trim()) out.pop();
  return out;
};

const genericExcerpt = (log, cls) => {
  const lines = log.split("\n").filter((l) => !/^##\[error\]Process completed/.test(l));
  if (cls === "dependency-conflict") {
    return [
      ...new Set(
        lines
          .filter((l) => /While resolving:|Found:|Could not resolve|Conflicting peer|peer .*@/.test(l))
          .map((l) => l.replace(/^npm error ?/, "")),
      ),
    ].slice(0, 20);
  }
  const start = lines.findIndex((l) =>
    /^\s*(npm error|##\[error\]|error TS|.* error TS\d+|FAIL\b|Error:|●|\d+:\d+\s+error\s)/.test(l),
  );
  const s = Math.max(0, (start === -1 ? 0 : start) - 3);
  return lines.slice(s, s + 60);
};

const testId = (t) => (t.file ? `${t.file} › ${t.title}` : t.title);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const testPattern = (t) =>
  t.runner === "vitest"
    ? new RegExp(`${escapeRe(t.file)}\\s+>\\s+${escapeRe(t.title)}`)
    : t.file
      ? new RegExp(`${escapeRe(t.file)}:\\d+:\\d+ › ${escapeRe(t.title)}`)
      : new RegExp(`● ${escapeRe(t.title)}`);

// ------------------------------------------------------------------ failures + history

console.log("## Failures");
console.log("");

let failureClass = failing.length ? "unknown" : "none";
const classPriority = {
  none: 0,
  unknown: 1,
  e2e: 2,
  "unit-test": 2,
  build: 3,
  typecheck: 3,
  lint: 3,
  "dependency-conflict": 4,
};
const allTests = [];
const newFailures = [];
const preexisting = [];
const unresolved = [];
const processedRuns = new Set();

if (failing.length === 0) console.log("_No failing checks on the PR head._\n");

for (const f of failing) {
  console.log(`### ${f.check.name}`);
  console.log("");
  if (f.output) console.log(`Check output: ${f.output}`);
  console.log(`Resolved via: ${f.how}`);
  console.log("");
  if (!f.runId) {
    if (f.check.link) console.log(`Logs are outside GitHub: ${f.check.link}\n`);
    unresolved.push(f.check.name);
    continue;
  }
  if (processedRuns.has(f.runId)) {
    console.log(`_Same run as above (${runUrl(f.runId)})._\n`);
    continue;
  }
  processedRuns.add(f.runId);

  const meta = ghJson(["run", "view", f.runId, "--repo", REPO, "--json", "workflowDatabaseId,workflowName,event,createdAt"]);
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    throw new Error(`ci-failures: expected metadata for workflow run ${f.runId} to be a JSON object`);
  }
  const log = failedLog(f.runId);
  const cls = classify(log);
  if (classPriority[cls] > classPriority[failureClass]) failureClass = cls;
  console.log(`Run: ${runUrl(f.runId)} — workflow \`${meta.workflowName ?? "?"}\`, event \`${meta.event ?? "?"}\`, class \`${cls}\``);
  console.log(`Full log: ${join(WORKDIR, `run-${f.runId}.clean.log`)}`);
  console.log("");

  const tests =
    cls === "e2e" ? parsePlaywright(log) : cls === "unit-test" ? [...parseVitest(log), ...parseJest(log)] : [];
  if (tests.length === 0) {
    console.log("```");
    console.log(genericExcerpt(log, cls).join("\n"));
    console.log("```");
    console.log("");
    continue;
  }

  for (const t of tests) {
    allTests.push(t);
    console.log(`#### \`${testId(t)}\``);
    console.log("");
    console.log("```");
    console.log(t.excerpt.join("\n"));
    console.log("```");
    console.log("");
  }

  // History: did these same tests fail in earlier runs of this workflow?
  if (!meta.workflowDatabaseId) continue;
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const history = ghJson([
    "run", "list", "--repo", REPO, "--workflow", String(meta.workflowDatabaseId),
    "--created", `>=${since}`, "--limit", "200",
    "--json", "databaseId,conclusion,createdAt",
  ]);
  if (!Array.isArray(history)) {
    throw new Error(`ci-failures: expected history for workflow run ${f.runId} to be a JSON array`);
  }
  const completed = history.filter((r) => r.conclusion === "success" || r.conclusion === "failure");
  const failedRuns = completed
    .filter((r) => r.conclusion === "failure" && String(r.databaseId) !== f.runId)
    .slice(0, HISTORY_MAX_RUNS);
  const totalFailed = completed.filter((r) => r.conclusion === "failure").length;

  console.log(`#### History — \`${meta.workflowName}\`, last ${HISTORY_DAYS} days`);
  console.log("");
  console.log(
    `Workflow: ${completed.length - totalFailed} passed / ${totalFailed} failed of ${completed.length} completed runs. ` +
      `Checked the ${failedRuns.length} most recent earlier failures for the same tests.`,
  );
  console.log("");
  console.log("| test | earlier failures | predating this PR | passing runs since first failure | verdict |");
  console.log("|---|---|---|---|---|");
  for (const t of tests) {
    const re = testPattern(t);
    const hits = failedRuns.filter((r) => re.test(failedLog(r.databaseId)));
    const before = hits.filter((r) => r.createdAt < pr.createdAt);
    const earliest = hits.at(-1)?.createdAt;
    const passesSince = earliest
      ? completed.filter((r) => r.conclusion === "success" && r.createdAt > earliest).length
      : 0;
    let verdict;
    if (before.length === 0) {
      verdict = "**NEW** — not seen before this PR";
      newFailures.push(testId(t));
    } else {
      verdict =
        passesSince > 0
          ? "**PRE-EXISTING, INTERMITTENT** (flake) — not caused by this PR"
          : "**PRE-EXISTING, CONSISTENT** — already broken before this PR";
      preexisting.push(testId(t));
    }
    const dates = hits.map((r) => `[${day(r.createdAt)}](${runUrl(r.databaseId)})`).join(", ") || "—";
    console.log(`| \`${testId(t)}\` | ${hits.length}: ${dates} | ${before.length} | ${passesSince} | ${verdict} |`);
  }
  console.log("");
}

console.log(`FAILURE_CLASS=${failureClass}`);
console.log(`FAILED_TESTS=${allTests.length}`);
console.log(`NEW_FAILURES=${newFailures.join("; ")}`);
console.log(`PREEXISTING_FAILURES=${preexisting.join("; ")}`);
console.log(`UNRESOLVED_CHECKS=${unresolved.join("; ")}`);
console.log(`PENDING_CHECKS=${pending.join("; ")}`);
