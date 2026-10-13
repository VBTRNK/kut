// Render the real card, then check the comparison and gold's wrap in Chromium.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { root, src, h, html } from "../ui-pass/build/source.mjs";
import { compileCss } from "../ui-pass/build/css.mjs";

const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("@playwright/test");
const { LiveCard } = src("components/live-card.tsx");
const out = path.join(root, ".release-evidence/card-animations");
fs.mkdirSync(out, { recursive: true });
const styles = fs.readFileSync(new URL("studies.css", import.meta.url), "utf8");
const legacy = fs.readFileSync(new URL("legacy-holo.css", import.meta.url), "utf8");
const player = { id: "animation-study", injured: false, displayName: "Alex", archetype: "playmaker",
  liveOvr: 71, pac: 69, sho: 69, pas: 81, dri: 76, def: 65, phy: 66, photoUrl: null };
const card = (rarityTier) => html(h(LiveCard, { player: { ...player, rarityTier }, size: "detail" }));
const panel = (id, title, copy, tier = "holo") => `<section class="${id}"><h2>${title}</h2>
  <p>${copy}</p><div class="card-slot">${card(tier)}</div></section>`;
const file = path.join(out, "index.html");
fs.writeFileSync(file, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FLUT · Card animation studies</title><style>
${await compileCss()}
${styles}
${legacy}
:root { --font-archivo: Arial; --font-instrument: Georgia; --font-hand: cursive; --font-marker: cursive; }
body { margin: 0; background: #17131d; color: #ede7f6; font-family: Arial, sans-serif; }
main { max-width: 1500px; padding: 36px 28px 60px; margin: auto; }
header { max-width: 760px; margin-bottom: 24px; }
h1 { font-size: clamp(28px, 4vw, 42px); line-height: 1.1; font-weight: 800; margin: 8px 0 14px; }
header p, section > p { color: #bdb1ce; line-height: 1.5; }
.eyebrow { color: #bca0ed; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 22px 0 32px; }
button, .photo { background: #352742; border: 1px solid #74568f; border-radius: 8px; padding: 9px 14px; color: #f5edff; cursor: pointer; font: inherit; }
input[type="file"] { width: 200px; font-size: 12px; }
input[type="range"] { width: 160px; vertical-align: middle; accent-color: #c1a0ed; }
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 30px; }
section > h2 { color: #f3ecfa; margin: 0 0 8px; font-size: 19px; font-weight: 700; }
section > p { font-size: 14px; min-height: 64px; margin: 0 0 20px; }
.card-slot { max-width: 330px; }
.live-card:hover { transform: none; }
.live-card[data-size="detail"] { width: 100%; }
body.album .card-slot { max-width: 180px; }
.gold { margin-top: 56px; max-width: 710px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.gold section > p { min-height: 44px; }
.note { font-size: 13px; color: #b7a8c8; margin-top: 28px; }
@media(max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media(max-width: 580px) { main { padding: 24px 20px 48px; } .grid { grid-template-columns: 1fr; gap: 36px; } section > p { min-height: 0; } .card-slot { margin: auto; } }
</style></head><body><main>
<header><span class="eyebrow">FLUT · Material studies</span><h1>Three ways to catch the light.</h1>
<p>Approved: pearl refraction at medium intensity and seamless gold. The other studies and the original rainbow lines remain here for comparison.</p></header>
<div class="controls"><button id="pause">Pause</button><button id="replay">Replay</button>
<label>Time <input id="time" type="range" min="0" max="18" step="0.01" value="0"></label>
<button id="size">Album size</button><label class="photo">Try your photo <input id="photo" type="file" accept="image/*"></label></div>
<div class="grid">
${panel("study study-pearl", "01 · Pearl refraction · Approved", "Wide pearlescent reflections: lilac, ice blue and blush. Approved at this medium intensity.")}
${panel("study study-aurora", "02 · Violet aurora", "Soft amethyst and orchid light, slowly drifting and breathing around the surface.")}
${panel("study study-glints", "03 · Foil glints", "Gentle star reflections catch the light in alternating groups, over a purple glaze.")}
${panel("study-current", "Before · Rainbow lines", "The original moving line pattern, preserved for a direct comparison.")}
</div><div class="grid gold">
${panel("study-old", "Gold · Before", "The gradient jumps back at the nine-second boundary.", "gold")}
${panel("study-new", "Gold · Seamless", "One complete texture tile every nine seconds. Same travel speed at the wrap.", "gold")}
</div><div class="grid gold">
${panel("production-holo", "Holo · Applied to the app", "The real card with production CSS only; verified against the approved study.")}
</div><p class="note">Invented sample player; effects use the real card. A selected photo stays in this browser. Your system's reduced-motion preference is respected.</p>
</main><script>
const animations = document.getAnimations();
const pause = document.querySelector('#pause');
const time = document.querySelector('#time');
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
function setPaused(value) {
  paused = value;
  animations.forEach(a => value ? a.pause() : a.play());
  pause.textContent = value ? 'Play' : 'Pause';
}
document.querySelector('#pause').onclick = () => setPaused(!paused);
document.querySelector('#replay').onclick = () => { animations.forEach(a => a.currentTime = 0); time.value = 0; setPaused(false); };
time.oninput = () => { setPaused(true); animations.forEach(a => a.currentTime = Number(time.value) * 1000); };
document.querySelector('#size').onclick = e => { const album = document.body.classList.toggle('album'); e.target.textContent = album ? 'Detail size' : 'Album size'; };
let photoUrl;
document.querySelector('#photo').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(file);
  document.querySelectorAll('.live-card__portrait').forEach(p => {
    const img = document.createElement('img'); img.src = photoUrl; img.alt = ''; p.replaceChildren(img);
  });
};
animations.forEach(a => { a.pause(); a.currentTime = 0; });
setPaused(paused);
</script></body></html>`);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1480, height: 1050 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(file).href);
  const seek = (ms) => page.evaluate((t) => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
  }, ms);
  await seek(4500);
  await page.screenshot({ path: path.join(out, "comparison.png"), fullPage: true });
  const results = [];
  for (const width of [330, 180]) {
    await page.evaluate((w) => document.querySelectorAll('.card-slot').forEach(el => el.style.maxWidth = w + 'px'), width);
    const wrapper = page.locator('.study-pearl');
    const originalClass = await wrapper.getAttribute('class');
    const renderedStyles = () => page.locator('.study-pearl .live-card, .production-parity .live-card').evaluate(el =>
      [el, ...el.querySelectorAll('*')].map(node => {
        const style = getComputedStyle(node);
        return Object.fromEntries(Array.from(style).filter(name => name !== 'animation-name').map(name => [name, style.getPropertyValue(name)]));
      }));
    // Compare all rendered properties; only the study's animation name differs.
    for (const ms of [0, 2750, 5500, 8250, 11000]) {
      await seek(ms);
      const reference = await renderedStyles();
      const section = await wrapper.elementHandle();
      await section.evaluate(el => el.className = 'production-parity');
      await seek(ms);
      const applied = await renderedStyles();
      await section.evaluate((el, value) => el.className = value, originalClass);
      assert.deepEqual(applied, reference,
        `Production holo differs from approved study at ${width}px / ${ms}ms`);
    }
    results.push(`holo at ${width}px: production matches approved study at five phases`);
    // Drive to the exact keyframe end within a single held iteration, so this
    // proves the endpoints themselves match, not the browser's infinite wrap.
    for (const part of ['plate', 'pennant']) {
      const foil = page.locator('.study-new .live-card__' + part);
      await page.evaluate(() => document.getAnimations().forEach(a => {
        a.pause(); a.currentTime = 0;
        if (a.animationName === 'card-gold-foil') a.effect.updateTiming({ iterations: 1, fill: 'both' });
      }));
      const first = await foil.screenshot({ animations: 'allow' });
      await seek(9000);
      const last = await foil.screenshot({ animations: 'allow' });
      assert(first.equals(last), `Gold ${part} endpoints differ at ${width}px`);
      results.push(`gold ${part} at ${width}px: pixel-identical 0/9s endpoints`);
    }
  }
  for (const width of [1480, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    if (width === 390) await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'Reduced motion still animates');
  assert.equal(await page.locator('.production-holo .live-card__film').evaluate(el => getComputedStyle(el).opacity), '0.32',
    'Reduced-motion holo lost its static pearl finish');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.production-holo .live-card').evaluate(el => el.dataset.injured = 'true');
  assert(await page.locator('.production-holo .live-card').evaluate(el =>
    ['film', 'sheen'].every(layer => getComputedStyle(el.querySelector('.live-card__' + layer)).display === 'none')),
    'Injured holo still shows its foil layers');
  results.push('Reduced-motion holo retains static pearl; injury hides foil layers');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, "verification.txt"), [...results, 'No horizontal overflow: 1480 / 768 / 390 / 320px', 'Reduced motion: no active animations', 'No browser errors'].join('\n') + '\n');
  console.log(`Preview: ${file}\n${results.join('\n')}\nLayout, reduced motion and browser checks passed.`);
} finally {
  await browser.close();
}
