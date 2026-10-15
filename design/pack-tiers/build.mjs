// Build source-backed pack mockups and check their presentation in Chromium.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { root, src, sourceModule, h, html } from "../ui-pass/build/source.mjs";
import { analyze, suggestPrice, TIERS } from "../../scripts/analyze-pack-tiers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { PACKS, OPENED, Shop, Opening, Storyboards, Celebrations, History } = sourceModule(path.join(here, "studies.tsx"));
const { AdminEconomy } = sourceModule(path.join(here, "admin.tsx"));
const { LAST_STEP, initialRevealState, packRevealReducer } = src("components/pack-reveal-state.ts");
const out = path.join(root, ".release-evidence/issue-223/design");
// A key set is committed; every other screenshot stays in ignored evidence.
const KEY_SHOTS = new Set(["shop-390", "shop-1440", "comparison-1440", "comparison-grayscale-1440", "storyboards-1440",
  "celebrations-1440", "history-390", "admin-390", "admin-1440", "admin-draft-1440", "backs-gold-390", "result-gold-390"]);
const shotDirs = [path.join(root, "docs/design/pack-tiers"), path.join(out, "screens")];
const shot = (name) => path.join(shotDirs[KEY_SHOTS.has(name) ? 0 : 1], `${name}.png`);
fs.mkdirSync(out, { recursive: true });
shotDirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

// Admin numbers: the research harness on the anonymous 15 Oct roster fixture,
// standing in for the canonical S1 analytics. Prices are the launch plan.
const { roster } = JSON.parse(fs.readFileSync(path.join(root, "scripts/research/pack-roster-2026-10-15.json"), "utf8"));
const candidate = (key, price) => ({ name: key, price, slots: key === "regular" ? ["common", "common", "common"] : ["common", "common", key], guaranteeWhenNeeded: key !== "regular" });
const regularResult = analyze(roster, candidate("regular", 250));
const metrics = (key, price, on) => {
  const result = key === "regular" ? regularResult : analyze(roster, candidate(key, price));
  const floor = key === "regular" ? 0 : TIERS.indexOf(key);
  return {
    key, price, on, title: `${key[0].toUpperCase()}${key.slice(1)} pack`,
    promise: key === "regular" ? "No minimum tier" : `At least 1 ${key === "silver" ? "Silver" : "Gold"}+`,
    suggested: suggestPrice(result, regularResult), eligible: roster.length,
    pool: roster.filter((p) => TIERS.indexOf(p.tier) >= floor).length,
    perPack: { cards: result.cards, discard: result.expectedDiscard, silver: result.expectedSilverPlus, gold: result.expectedGoldPlus, holo: result.expectedHoloPlus, elite: result.expectedElitePlus },
    chance: { silver: result.chanceSilverPlus, gold: result.chanceGoldPlus, holo: result.chanceHoloPlus },
  };
};
const ECONOMY = [metrics("regular", 250, true), metrics("silver", 500, true), metrics("gold", 750, false)];
const CONFLICT = [metrics("regular", 250, true), metrics("silver", 500, true), metrics("gold", 800, true)];
assert.deepEqual(ECONOMY.map((p) => p.suggested), [250, 500, 750], "Suggestions no longer reproduce 250/500/750");

// Confetti offsets as static nth-child rules (a fixed seed, so builds match).
let seed = 223;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const confetti = Array.from({ length: 60 }, (_, i) => {
  const angle = rnd() * Math.PI * 2;
  const reach = 80 + rnd() * 120;
  return `.celebrate__bits i:nth-child(${i + 1}){--x:${Math.round(Math.cos(angle) * reach)}px;--y:${Math.round(Math.sin(angle) * reach * 0.85 - 30)}px;--r:${Math.round(rnd() * 720 - 360)}deg;--fall:${Math.round(50 + rnd() * 90)}px;--delay:${Math.round(rnd() * 140)}ms;--lx:${Math.round(rnd() * 280 - 140)}px;--ld:${Math.round(rnd() * 1100)}ms}`;
}).join("\n");

// The app's globals.css through Tailwind, scanning src/, the DR5 chrome and this folder.
const require = createRequire(path.join(root, "package.json"));
const fwd = (p) => p.replace(/\\/g, "/");
const globals = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace('@import "tailwindcss";', [
  '@import "tailwindcss" source(none);',
  `@source "${fwd(path.join(root, "src"))}";`,
  `@source "${fwd(path.join(root, "design/ui-pass/build"))}/*.tsx";`,
  `@source "${fwd(here)}/*.tsx";`,
].join("\n"));
const appCss = (await require("postcss")([require("@tailwindcss/postcss")({ optimize: { minify: true } })])
  .process(globals, { from: path.join(root, "src/app/pack-tiers-design.css") })).css;
const css = `${appCss}\n${fs.readFileSync(path.join(here, "studies.css"), "utf8")}\n${confetti}`;
const interaction = fs.readFileSync(path.join(here, "preview.js"), "utf8");
const reducer = `const LAST_STEP=${LAST_STEP};\n${initialRevealState.toString()}\n${packRevealReducer.toString().replaceAll("exports.LAST_STEP", "LAST_STEP")}`;

// [file, component, props, screenshot name, nav path, economy data]
const PAGES = [
  ["index.html", Shop, {}, "shop"], ["comparison.html", Shop, { comparison: true }, "comparison"],
  ["opening.html", Opening, {}, null], ["storyboards.html", Storyboards, {}, "storyboards"],
  ["celebrations.html", Celebrations, {}, null], ["history.html", History, {}, "history"],
  ["admin.html", AdminEconomy, { packs: ECONOMY }, "admin", "/admin/economy", ECONOMY],
  ["admin-conflict.html", AdminEconomy, { packs: CONFLICT, conflict: true }, "admin-conflict", "/admin/economy", CONFLICT],
];
for (const [file, component, props, , nav = "/club/packs", data] of PAGES) {
  globalThis.__mockPath = nav;
  const economy = data ? `<script id="econ-data" type="application/json">${JSON.stringify(data)}</script>` : "";
  fs.writeFileSync(path.join(out, file), `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FLUT · Pack tiers design</title><style>${css}</style></head><body class="bg-board text-ink">
${html(h(component, props))}${economy}<script>${reducer}\n${interaction}</script></body></html>`);
}

const browser = await chromium.launch({ headless: true });
const report = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  const visit = (file) => {
    const [filename, search = ""] = file.split("?");
    const url = pathToFileURL(path.join(out, filename));
    url.search = search;
    return page.goto(url.href);
  };
  const noOverflow = async (label) => assert(await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow: ${label}`);
  // Let entrance animations land (the Gold/Holo foil cycles never finish).
  const settle = () => page.evaluate(() => Promise.all(document.getAnimations()
    .filter((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
  const freeze = (t) => page.evaluate((time) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = time; }), t);
  const animationNames = () => page.evaluate(() => document.getAnimations().map((a) => a.animationName));
  const focused = (locator) => locator.evaluate((el) => el === document.activeElement);
  const scope = (key) => `[data-opening=${key}]`;
  const stage = (key) => page.locator(`${scope(key)} [data-stage]`);
  const summary = (key) => page.locator(`[data-summary=${key}]`);
  const step = (key, index, n) => page.locator(`${scope(key)} [data-index="${index}"][data-step="${n}"]:not([hidden])`);

  // Every page, plus each opening's sealed and summary states, at four widths.
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [file, , , name] of PAGES.filter((p) => p[0] !== "opening.html")) {
      await visit(file);
      await noOverflow(`${file}/${width}`);
      if (name && (width === 1440 || width === 390)) {
        await settle();
        await page.screenshot({ path: shot(`${name}-${width}`), fullPage: true });
      }
    }
    for (const pack of PACKS) {
      await visit(`opening.html?receipt=${pack.key}`);
      await noOverflow(`sealed/${pack.key}/${width}`);
      await page.locator(`${scope(pack.key)} [data-skip]`).click();
      await noOverflow(`summary/${pack.key}/${width}`);
    }
  }
  report.push("All pages and every sealed/summary opening: no horizontal overflow at 1440/768/390/320px");

  await visit("index.html");
  assert.equal(await page.locator("[data-offer=gold]").count(), 0, "Gold shown in launch shop");
  assert.match(await page.locator("[data-open=silver]").innerText(), /Need 80 more coins/);
  assert(await page.locator("[data-open=silver]").isDisabled(), "Unaffordable offer is enabled");
  assert.doesNotMatch(await page.locator("main").innerText(), /Duplicates can happen/);
  await visit("comparison.html");
  assert.equal(await page.locator("main button.bg-brass:not(:disabled)").count(), 3, "Affordable offers are not all brass");
  report.push("Launch shop: Regular/Silver, Gold absent, Silver unaffordable at 420 coins; every affordable offer brass; no duplicates footnote");

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const pack of PACKS) {
      await visit("comparison.html");
      const offer = page.locator(`[data-open=${pack.key}]`);
      for (let i = 0; i < 40 && !await focused(offer); i++) await page.keyboard.press("Tab");
      assert(await focused(offer), `Offer unreachable by keyboard: ${pack.key}`);
      assert.equal(await offer.evaluate((el) => getComputedStyle(el).outlineStyle), "solid", "Missing focus ring");
      await page.keyboard.press("Enter");
      const sheet = page.locator(`[data-sheet=${pack.key}] [role=dialog]`);
      assert(await sheet.isVisible(), `No confirmation for ${pack.key}`);
      assert(await focused(sheet), "Sheet did not take focus");
      assert.match(await sheet.innerText(), new RegExp(`Open a ${pack.title}\\?[\\s\\S]*${pack.price} coins for 3 Live Cards`));
      if (pack.floor) assert.match(await sheet.innerText(), /at least 1 (Silver|Gold)\+/);
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        assert(await sheet.evaluate((el) => el.contains(document.activeElement)), "Tab left the sheet");
      }
      await page.keyboard.press("Escape");
      assert(await focused(offer), "Escape lost focus");
      await page.keyboard.press("Space");
      if (width === 390) await page.screenshot({ path: shot(`confirm-${pack.key}-390`) });
      await page.locator(`[data-pay=${pack.key}]`).focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(new RegExp(`opening\\.html\\?receipt=${pack.key}$`));
      assert(await focused(stage(pack.key)), "Sealed stage not focused");

      // The tap opens the wrapper; then the backs fan out and hold.
      const opened = Date.now();
      await page.keyboard.press("Enter");
      const names = await animationNames();
      for (const expected of ({ regular: ["pack-tear", "pack-drop"], silver: ["pack-sweep", "pack-slide"], gold: ["pack-seal", "pack-door-l", "pack-door-r"] })[pack.key])
        assert(names.includes(expected), `Missing ${expected} for ${pack.key}`);
      if (width === 390) {
        await freeze(pack.duration * 0.6);
        await page.screenshot({ path: shot(`opening-${pack.key}-390`) });
        await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      }
      await page.locator(`${scope(pack.key)} .is-fanned`).waitFor({ timeout: 5000 });
      assert(Date.now() - opened >= pack.duration - 50, "Gesture ended early");
      assert.match(await page.locator(`${scope(pack.key)} [data-status]`).innerText(), /3 Live Cards/);
      if (width === 390) {
        await page.waitForTimeout(500);
        await page.screenshot({ path: shot(`backs-${pack.key}-390`) });
      }
      const cards = OPENED[pack.key];
      for (let index = 0; index < 3; index++) {
        if (pack.key === "regular" && index === 0) {
          // No input: hold, tier and rating all advance on their own.
          await step("regular", 0, 0).waitFor({ timeout: 3000 });
          await step("regular", 0, 1).waitFor({ timeout: 3000 });
          await step("regular", 0, 2).waitFor({ timeout: 3000 });
        } else {
          // Cuts the hold short (a slow screenshot may already have outlasted it).
          if (index === 0 && await page.locator(`${scope(pack.key)} [data-sealed]`).isVisible()) await page.keyboard.press("Enter");
          assert(await step(pack.key, index, 0).isVisible() || await step(pack.key, index, 1).isVisible(), `Card ${index + 1} did not start at its tier`);
          await page.keyboard.press("Enter"); // Jumps straight to the card.
        }
        assert(await step(pack.key, index, 2).isVisible(), `Card ${index + 1} not revealed`);
        const playing = await animationNames();
        const tier = cards[index].rarityTier;
        assert.equal(playing.includes("pack-confetti"), tier !== "common", `Celebration wrong for ${tier}`);
        await page.waitForTimeout(150);
        assert(await step(pack.key, index, 2).isVisible(), "The revealed card did not wait for a tap");
        await page.keyboard.press(index % 2 ? "Space" : "Enter");
      }
      assert(await summary(pack.key).isVisible(), `No summary for ${pack.key}`);
      assert(await focused(summary(pack.key)), "Summary focus lost");
      const text = await summary(pack.key).innerText();
      assert(text.includes(`${pack.title} · Paid ${pack.price} coins`), "Receipt missing");
      const faces = await summary(pack.key).locator(".live-card").evaluateAll((els) => els.map((el) => el.textContent));
      assert.equal(faces.length, 3);
      if (pack.key === "gold") assert.equal(faces[0], faces[1], "Duplicate fixture lost");
      if (width === 390) {
        await settle();
        await page.screenshot({ path: shot(`result-${pack.key}-390`), fullPage: true });
      }
      await page.locator(`${scope(pack.key)} [data-replay]`).click();
      assert(await page.locator(`${scope(pack.key)} [data-sealed]`).isVisible(), "Replay did not reseal");
      await stage(pack.key).click();
      await page.locator(`${scope(pack.key)} [data-skip]`).click();
      assert.equal(await summary(pack.key).innerText(), text, "Replay changed the receipt");
      await page.reload();
      await page.locator(`${scope(pack.key)} [data-skip]`).click();
      assert.equal(await summary(pack.key).innerText(), text, "Reload changed the receipt");
      report.push(`${pack.key}/${width}: keyboard, focus ring, sheet trap, pay→opening, gesture ≥${pack.duration} ms then backs hold, ${pack.key === "regular" ? "tier/rating/card advance unaided" : "taps cut ahead"}, card waits for a tap, tier celebrations, summary focus, skip mid-gesture, replay/reload PASS`);
    }
  }

  // Celebrations: each tier's effects, frozen mid-moment for review.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit("celebrations.html");
    const by = (tier) => page.evaluate((t) => document.querySelector(`[data-demo="${t}"]`).getAnimations({ subtree: true }).map((a) => a.animationName), tier);
    assert.deepEqual((await by("common")).filter((n) => n.startsWith("pack-") && n !== "pack-card-rise"), [], "Common celebrates");
    for (const tier of ["bronze", "silver", "gold", "holo"]) assert((await by(tier)).includes("pack-confetti"), `${tier}: no confetti`);
    assert((await by("silver")).includes("card-sweep"), "Silver: no sweep");
    assert((await by("gold")).includes("pack-glow-burst"), "Gold: no glow");
    assert((await by("holo")).includes("pack-ring"), "Holo: no rings");
    for (const name of ["pack-leaf", "pack-rays", "pack-dim", "pack-lift"]) assert((await by("elite")).includes(name), `Elite: no ${name}`);
    await freeze(650);
    await page.screenshot({ path: shot(`celebrations-${width}`), fullPage: true });
  }
  await page.reload();
  await settle();
  await page.locator("[data-play=gold]").click();
  assert((await page.evaluate(() => document.querySelector("[data-demo=gold]").getAnimations({ subtree: true }).map((a) => a.animationName))).includes("pack-confetti"), "Play again did not replay");
  report.push("Celebrations: none for Common; bronze/silver/gold/holo confetti; silver sweep, gold glow, holo rings; elite dim, rays, leaf and lift; Play again replays");

  // Admin: drafts recompute, warnings advise, nothing blocks a valid Apply.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit("admin.html");
  const form = page.locator("[data-econ]");
  assert.equal(await form.locator("[data-row]").count(), 3);
  assert.equal(await form.locator("[data-row=regular] [role=switch]").count(), 0, "Regular can be switched off");
  assert(await form.locator("[data-apply]").isDisabled(), "Apply enabled without changes");
  assert.equal(await form.locator("[data-warnings] li").count(), 0, "Launch prices warn");
  await page.getByLabel("Silver price").fill("300");
  assert.match(await form.locator("[data-warnings]").innerText(), /Silver pack gives more .* per coin than Regular/);
  assert(await form.locator("[data-apply]").isEnabled(), "Warning blocked Apply");
  assert.match(await form.locator("[data-dirty]").innerText(), /Silver 500 → 300/);
  await form.locator("[data-toggle=gold]").focus();
  await page.keyboard.press("Space");
  assert.equal(await form.locator("[data-toggle=gold]").getAttribute("aria-checked"), "true");
  assert.match(await form.locator("[data-row=gold] [data-state]").innerText(), /On/);
  await settle();
  await page.screenshot({ path: shot("admin-draft-1440"), fullPage: true });
  await form.locator("[data-suggest]").click();
  assert.equal(await page.getByLabel("Silver price").inputValue(), "500");
  assert.equal(await form.locator("[data-warnings] li").count(), 0, "Suggested prices still warn");
  await page.getByLabel("Regular price").fill("");
  assert(await form.locator("[data-apply]").isDisabled(), "Invalid price can be applied");
  await page.getByLabel("Regular price").fill("250");
  await form.locator("[data-apply]").click();
  assert.match(await form.locator("[data-dirty]").innerText(), /Applied/);
  assert(await form.locator("[data-apply]").isDisabled(), "Apply stays enabled after saving");
  await visit("admin-conflict.html");
  assert.match(await page.getByRole("alert").innerText(), /applied changes at 10:20/);
  report.push("Admin: Regular always on; launch prices clean; a Silver draft at 300 warns but Apply stays enabled; Gold toggles by keyboard; suggestions refill; invalid price blocks; conflict notice");

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const pack of PACKS) {
    await visit(`opening.html?receipt=${pack.key}`);
    assert(await summary(pack.key).isVisible(), "Reduced motion did not open at the summary");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, "Reduced motion still animates");
    await page.locator(`${scope(pack.key)} [data-replay]`).click();
    assert(await summary(pack.key).isVisible(), "Reduced replay started motion");
  }
  await visit("celebrations.html");
  assert.equal(await page.evaluate(() => document.getAnimations().filter((a) => a.animationName.startsWith("pack-")).length), 0, "Reduced motion celebrates");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await visit("opening.html?receipt=silver");
  await stage("silver").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await summary("silver").waitFor({ state: "visible" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  report.push("Reduced motion: openings start at the summary, replay stays there, a mid-gesture change skips; no celebrations");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit("comparison.html");
  await page.evaluate(() => { document.documentElement.style.filter = "grayscale(1)"; });
  await page.screenshot({ path: shot("comparison-grayscale-1440"), fullPage: true });
  await page.setViewportSize({ width: 640, height: 900 });
  for (const file of ["comparison.html", "admin.html"]) {
    await visit(file);
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    // Page content only: the real AppNav's sm bar overflows at 200% zoom in
    // the app today too (recorded as a leftover, not a pack-tier defect).
    assert(await page.evaluate(() => [...document.querySelectorAll("main *")].every((el) =>
      el.getBoundingClientRect().right <= innerWidth + 1)), `${file}: content overflows at 200% zoom/640px`);
  }
  report.push("Grayscale comparison retained; 200% zoom/640px: shop and admin content fit (existing AppNav bar overflows, out of scope)");
  assert.deepEqual(errors, [], "Browser errors");
  assert.deepEqual(requests, [], "Prototype made network requests");
  report.push("No browser errors or HTTP requests; no database/paid-flow assertions made by this prototype");
  fs.writeFileSync(path.join(out, "verification.txt"), report.join("\n") + "\n");
  console.log(`Preview: ${path.join(out, "index.html")}\n${report.join("\n")}`);
} finally {
  await browser.close();
}
