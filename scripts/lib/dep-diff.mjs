#!/usr/bin/env node
/**
 * dep-diff.mjs — classify dependency version changes between two package.json files.
 *
 * Contract
 *   Inputs        argv[2] = path to BASE package.json
 *                 argv[3] = path to HEAD package.json
 *   Output        Markdown table + summary counts on stdout. Last line is
 *                 `MAJORS=<comma-separated package names>` (empty when none).
 *   Preconditions Both paths must be readable JSON.
 *   Side effects  None.
 *
 * Exists so the agent never has to read a package-lock diff or eyeball semver
 * ranges to work out which bumps are risky.
 */

import { readFileSync } from "node:fs";

const FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

const read = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (err) {
    console.error(`dep-diff: cannot read ${p}: ${err.message}`);
    process.exit(2);
  }
};

/** Strip range operators and return [major, minor, patch], or null if unparseable. */
const parseVersion = (range) => {
  const m = String(range).match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const classify = (from, to) => {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (!a || !b) return "UNKNOWN";
  if (b[0] !== a[0]) return "MAJOR";
  if (b[1] !== a[1]) return "minor";
  if (b[2] !== a[2]) return "patch";
  return "range";
};

const [, , basePath, headPath] = process.argv;
if (!basePath || !headPath) {
  console.error("usage: dep-diff.mjs <base package.json> <head package.json>");
  process.exit(2);
}

const base = read(basePath);
const head = read(headPath);

const rows = [];
for (const field of FIELDS) {
  const b = base[field] ?? {};
  const h = head[field] ?? {};
  for (const name of new Set([...Object.keys(b), ...Object.keys(h)])) {
    if (b[name] === h[name]) continue;
    if (!(name in b)) rows.push({ name, field, from: "—", to: h[name], bump: "ADDED" });
    else if (!(name in h)) rows.push({ name, field, from: b[name], to: "—", bump: "REMOVED" });
    else rows.push({ name, field, from: b[name], to: h[name], bump: classify(b[name], h[name]) });
  }
}

const rank = { MAJOR: 0, ADDED: 1, REMOVED: 1, UNKNOWN: 2, minor: 3, patch: 4, range: 5 };
rows.sort((x, y) => rank[x.bump] - rank[y.bump] || x.name.localeCompare(y.name));

if (rows.length === 0) {
  console.log("_No package.json dependency changes._");
  console.log("");
  console.log("MAJORS=");
  process.exit(0);
}

console.log("| package | section | from | to | bump |");
console.log("|---|---|---|---|---|");
for (const r of rows) {
  const section = r.field === "devDependencies" ? "dev" : r.field.replace("Dependencies", "");
  console.log(`| \`${r.name}\` | ${section} | \`${r.from}\` | \`${r.to}\` | ${r.bump} |`);
}

const counts = rows.reduce((acc, r) => ({ ...acc, [r.bump]: (acc[r.bump] ?? 0) + 1 }), {});
console.log("");
console.log(
  `Totals: ${Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")} (${rows.length} changed)`,
);
console.log("");
console.log(`MAJORS=${rows.filter((r) => r.bump === "MAJOR").map((r) => r.name).join(",")}`);
