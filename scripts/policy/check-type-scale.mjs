#!/usr/bin/env node
// The type-scale ratchet (flut-ui-pass S4, ADR-153). Every text size outside
// the card face is to become one of the six DR5 roles (`text-title` …
// `text-label`, globals.css). Pages move onto the scale one session at a time,
// so this counts the size utilities still off it in src/ and holds that count
// to CEILING: above it fails (a page gained an off-scale size), and below it
// fails too until CEILING is lowered to match, so the count can only fall.
// S11 of the UI pass sets it to zero.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CEILING = 415;

// The card face keeps its own type (out of the UI pass's scope, ADR-043's
// ladder), as does the crest lockup once it is a component of its own (Q5).
export const EXEMPT = [
  "src/components/live-card.tsx",
  "src/components/card-tilt.tsx",
  "src/components/midweek/mini-card.tsx",
];

// A Tailwind size step (`text-sm`, `sm:text-2xl`, `text-lg/7`) or an
// arbitrary length (`text-[13px]`, `text-[0.7rem]`). Colours (`text-[#fff]`,
// `text-ink`) and the six roles (`text-small` …) don't match.
const OFF_SCALE =
  /(?<![\w-])text-(?:xs|sm|base|lg|xl|[2-9]xl|\[\d*\.?\d+(?:px|rem|em)\])(?![\w-])/g;

/** Off-scale size utilities in one file's text. */
export function countOffScale(text) {
  return text.match(OFF_SCALE)?.length ?? 0;
}

function sourceFiles(dir, root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full, root);
    return /\.tsx?$/.test(entry.name) ? [path.relative(root, full).replace(/\\/g, "/")] : [];
  });
}

/** Per-file counts for `files` (repo-relative paths mapped to their text). */
export function tally(files) {
  return Object.entries(files)
    .filter(([file]) => !EXEMPT.includes(file))
    .map(([file, text]) => ({ file, count: countOffScale(text) }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count);
}

/** One message when `total` is off the ceiling, else null. */
export function checkCeiling(total, ceiling = CEILING) {
  if (total > ceiling)
    return `${total} off-scale text sizes in src/, over the ceiling of ${ceiling}. Use the DR5 roles (text-title, text-figure, text-heading, text-body, text-small, text-label) instead.`;
  if (total < ceiling)
    return `${total} off-scale text sizes in src/, under the ceiling of ${ceiling}. Lower CEILING in scripts/policy/check-type-scale.mjs to ${total} so the count can't creep back.`;
  return null;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const files = Object.fromEntries(
    sourceFiles(path.join(root, "src"), root).map((file) => [
      file,
      readFileSync(path.join(root, file), "utf8"),
    ]),
  );
  const rows = tally(files);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (process.argv.includes("--list"))
    for (const row of rows) console.log(`${String(row.count).padStart(4)}  ${row.file}`);
  const problem = checkCeiling(total);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  console.log(`Type scale: ${total} off-scale text sizes left in src/ (the ceiling).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main();
