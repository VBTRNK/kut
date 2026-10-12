// Lists text cut off by an ellipsis on each artboard given (debug aid for the review).
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { root } from "./source.mjs";
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("@playwright/test");
const browser = await chromium.launch();
for (const file of process.argv.slice(2)) {
  const width = Number(file.match(/-(\d+)\.dc\.html$/)[1]);
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  const cut = await page.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((el) => el.closest(".live-card") === null && getComputedStyle(el).textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent.trim().slice(0, 60)),
  );
  if (cut.length) console.log(path.basename(file), JSON.stringify(cut));
  await page.close();
}
await browser.close();
