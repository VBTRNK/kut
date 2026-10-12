// Counts type sizes, voices (family, size, weight, case, letter-spacing) and
// text colours of the visible text under a selector, as S1 measured them.
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { root } from "./source.mjs";
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("@playwright/test");
const [file, width, selector] = [process.argv[2], Number(process.argv[3]), process.argv[4] ?? "main"];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(pathToFileURL(file).href);
await page.evaluate(() => document.fonts.ready);
const process_list = process.argv[5] === "list";
const out = await page.evaluate(([sel, process_list]) => [...document.querySelectorAll(sel)].map((rootEl) => {
  const sizes = new Set(), voices = new Set(), colours = new Set();
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || el.closest(".sr-only") || el.offsetParent === null && cs.position !== "fixed") continue;
    if (el.closest(".live-card") || el.closest("[class*='aspect-[5/7]']")) continue;
    sizes.add(cs.fontSize); colours.add(cs.color);
    voices.add([cs.fontFamily.split(",")[0], cs.fontSize, cs.fontWeight, cs.textTransform, cs.letterSpacing].join("|"));
  }
  return { sizes: sizes.size, voices: voices.size, colours: colours.size, list: process_list ? [...sizes].join(" ") + " | " + [...colours].join(" ") : undefined };
}), [selector, process_list]);
console.log(JSON.stringify(out));
await browser.close();
