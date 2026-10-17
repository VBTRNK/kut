// Builds the Academy mocks canvas (#246 S1) on the DR5 generator
// (design/ui-pass/build): one .dc.html per board and width under
// <out>/project/, plus canvas.json (v3). Each artboard is measured in
// Chromium at its width; the build fails if any scrolls sideways.
//
//   node design/academy/build/build.mjs [--out <dir>] [--shots <dir>] [--only <stem prefix>]
//
// <out> defaults to .release-evidence/academy-mocks, which Git ignores.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { root, html } from "../../ui-pass/build/source.mjs";
import { here } from "./paths.mjs";
import { BOARDS, PAGES } from "./screens.mjs";

const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("@playwright/test");
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");

const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const out = path.join(path.resolve(arg("--out") ?? path.join(root, ".release-evidence/academy-mocks")), "project");
const shots = arg("--shots") ? path.resolve(arg("--shots")) : null;
const only = arg("--only");
fs.mkdirSync(out, { recursive: true });
if (shots) fs.mkdirSync(shots, { recursive: true });

// The app's globals.css with Tailwind v4, scanning src/ and this folder, then the stamp.
async function compileCss() {
  const fwd = (p) => p.replace(/\\/g, "/");
  const globals = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const input = globals.replace(
    '@import "tailwindcss";',
    ['@import "tailwindcss" source(none);', `@source "${fwd(path.join(root, "src"))}";`, `@source "${fwd(here)}/*.tsx";`].join("\n"),
  );
  const result = await postcss([tailwind({ optimize: { minify: true } })]).process(input, { from: path.join(root, "src/app/academy-design.css") });
  return `${result.css}\n${fs.readFileSync(path.join(here, "academy.css"), "utf8")}`;
}

const css = await compileCss();
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function dcFile({ title, body, w, h }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&amp;family=Instrument+Serif&amp;family=Caveat:wght@400;700&amp;family=Permanent+Marker&amp;display=swap">
<style>
body{margin:0;background:#15130f}
:root{--font-archivo:"Archivo";--font-instrument:"Instrument Serif";--font-hand:"Caveat";--font-marker:"Permanent Marker"}
${css}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 600 }, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const COL = { 320: 0, 412: 400, 1200: 0, 1440: 892 };
const boards = {};
const order = [];
const notes = {};
const nextY = Object.fromEntries(PAGES.map((p) => [p.id, 0]));
let count = 0;

for (const board of BOARDS) {
  if (only && !board.stem.startsWith(only)) continue;
  globalThis.__mockPath = undefined;
  const body = html(board.body());
  const y = nextY[board.page];
  let rowH = 0;
  for (const w of board.widths) {
    const file = `${board.stem}-${w}.dc.html`;
    const target = path.join(out, file);
    fs.writeFileSync(target, dcFile({ title: `${board.title} · ${w}`, body, w, h: 800 }));
    await page.setViewportSize({ width: w, height: 600 });
    await page.goto(pathToFileURL(target).href);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth }));
    if (m.sw > w) throw new Error(`${file} overflows at ${w}px: ${m.sw}px wide`);
    fs.writeFileSync(target, dcFile({ title: `${board.title} · ${w}`, body, w, h: m.h }));
    if (shots) {
      await page.evaluate(() => {
        for (const el of document.querySelectorAll("body *")) if (getComputedStyle(el).position === "fixed") el.style.visibility = "hidden";
      });
      await page.screenshot({ path: path.join(shots, `${board.stem}-${w}.png`), fullPage: true });
    }
    boards[file] = { x: COL[w], y, w, h: m.h, title: `${board.title} · ${w}`, page: board.page };
    order.push(file);
    rowH = Math.max(rowH, m.h);
    count += 1;
  }
  notes[`note-${board.stem.toLowerCase()}`] = { x: -380, y, w: 300, page: board.page, text: `${board.title}\n\n${board.note}`, fill: "blue" };
  nextY[board.page] = y + rowH + 160;
}
await browser.close();
if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);

if (!only) {
  const canvas = {
    v: 3,
    createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, "Z") },
    title: "FLUT Academy, mocks (#246 S1)",
    launch: { view: "canvas", page: "members" },
    pages: PAGES,
    boards,
    order,
    notes,
    designSystems: [],
  };
  fs.writeFileSync(path.join(out, "canvas.json"), `${JSON.stringify(canvas, null, 2)}\n`);
}
console.log(`Wrote ${count} artboards from ${BOARDS.length} boards${shots ? `; shots in ${shots}` : ""}.`);
