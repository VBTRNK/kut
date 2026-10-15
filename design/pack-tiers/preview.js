// Design-only interaction over fixed receipts. S2 uses OpenPackForm, BottomSheet
// and PackReveal themselves; this script only stands in for their React state.
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

// ---- shop: the confirmation sheet (BottomSheet's focus, Escape and Tab wrap) ----
let sheet = null;
let trigger = null;

function closeSheet() {
  if (!sheet) return;
  sheet.hidden = true;
  sheet = null;
  document.documentElement.style.overflow = "";
  trigger?.focus();
}

document.querySelectorAll("[data-open]").forEach((button) =>
  button.addEventListener("click", () => {
    trigger = button;
    sheet = document.querySelector(`[data-sheet="${button.dataset.open}"]`);
    sheet.hidden = false;
    document.documentElement.style.overflow = "hidden";
    sheet.querySelector("[role=dialog]").focus();
  }),
);
document.querySelectorAll("[data-sheet]").forEach((wrapper) => {
  // The backdrop is the sheet's first button, as BottomSheet renders it.
  wrapper.querySelector("button").addEventListener("click", closeSheet);
  wrapper.querySelector("[data-cancel]").addEventListener("click", closeSheet);
  wrapper.querySelector("[data-pay]").addEventListener("click", (event) => {
    // The paid action redirects to its stored opening; here, a fixed receipt.
    // A static design page, not a Next.js route, so plain navigation is right.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = `opening.html?receipt=${event.currentTarget.dataset.pay}`;
  });
});
document.addEventListener("keydown", (event) => {
  if (!sheet) return;
  const panel = sheet.querySelector("[role=dialog]");
  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet();
  }
  if (event.key !== "Tab") return;
  const controls = [...panel.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')];
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey ? document.activeElement === first || document.activeElement === panel : document.activeElement === last) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
});

// ---- opening: sealed -> gesture -> three backs -> auto tier/rating -> card (tap) ----
const receipt = new URLSearchParams(location.search).get("receipt");
const root = receipt && document.querySelector(`[data-opening="${receipt}"]`);
if (root) {
  root.hidden = false;
  const title = root.dataset.title;
  const ms = (name) => Number(root.dataset[name]);
  const stage = root.querySelector("[data-stage]");
  const pack = root.querySelector("[data-sealed] .pack");
  const status = root.querySelector("[data-status]");
  const summary = root.querySelector("[data-part=summary]");
  const steps = [...root.querySelectorAll("[data-step]")];
  // sealed | opening | fanned | reveal; `state` is PackReveal's reducer state.
  let phase;
  let state;
  let timer = null;

  const later = (fn, delay) => {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };

  function render() {
    const done = state.phase === "summary";
    const wrapped = phase !== "reveal";
    root.querySelector("[data-part=reveal]").hidden = done;
    summary.hidden = !done;
    root.querySelector("[data-sealed]").hidden = done || !wrapped;
    pack.classList.toggle("is-opening", phase === "opening" || phase === "fanned");
    pack.classList.toggle("is-fanned", phase === "fanned");
    steps.forEach((el) => {
      el.hidden = wrapped || done || Number(el.dataset.index) !== state.index || Number(el.dataset.step) !== state.step;
    });
    if (done) return summary.focus();
    if (wrapped) {
      status.textContent = phase === "sealed" ? title : phase === "opening" ? `Opening the ${title}` : "3 Live Cards";
      stage.setAttribute("aria-label", phase === "sealed" ? `Open the ${title}` : "Show card 1 now");
    } else {
      const detail = steps.find((el) => !el.hidden).dataset.detail;
      status.innerHTML = `Card ${state.index + 1} of 3<span class="sr-only"> · ${detail}</span>`;
      const last = state.index === 2;
      stage.setAttribute("aria-label", state.step < 2 ? "Show the card now" : last ? "See all three" : "Next card");
      // Tier and rating advance on their own; the card waits for a tap.
      if (state.step === 0) later(advance, ms("tier"));
      if (state.step === 1) later(advance, ms("rating"));
    }
    stage.focus();
  }

  function advance() {
    clearTimeout(timer);
    state = packRevealReducer(state, { type: "advance" }, 3);
    render();
  }

  function reveal() {
    clearTimeout(timer);
    phase = "reveal";
    render();
  }

  function start() {
    clearTimeout(timer);
    phase = reduced.matches ? "reveal" : "sealed";
    state = initialRevealState(3, reduced.matches);
    render();
  }

  stage.addEventListener("click", () => {
    if (phase === "sealed") {
      // The tap is the gesture; the backs then hold before card 1.
      phase = "opening";
      later(() => {
        phase = "fanned";
        render();
        later(reveal, ms("hold"));
      }, ms("duration"));
      render();
    } else if (phase !== "reveal") reveal(); // A tap cuts the wait short.
    else if (state.step < 2) {
      clearTimeout(timer);
      while (state.step < 2) state = packRevealReducer(state, { type: "advance" }, 3);
      render();
    } else advance();
  });
  function skipAll() {
    clearTimeout(timer);
    phase = "reveal";
    state = packRevealReducer(state, { type: "skipAll" }, 3);
    render();
  }
  root.querySelector("[data-skip]").addEventListener("click", skipAll);
  root.querySelector("[data-replay]").addEventListener("click", start);
  reduced.addEventListener("change", () => {
    if (reduced.matches && state.phase !== "summary") skipAll();
  });
  start();
}

// ---- celebrations page: replay one tier's moment ----
document.querySelectorAll("[data-play]").forEach((button) =>
  button.addEventListener("click", () => {
    const stage = document.querySelector(`[data-demo="${button.dataset.play}"]`);
    const focus = stage.firstElementChild;
    stage.replaceChild(focus.cloneNode(true), focus);
  }),
);

// ---- admin economy: drafts, suggestions and advisory warnings ----
const form = document.querySelector("[data-econ]");
if (form) {
  const packs = JSON.parse(document.querySelector("#econ-data").textContent);
  const LABEL = { cards: "cards", discard: "discard coins", silver: "Silver+ cards", gold: "Gold+ cards", holo: "Holo+ cards", elite: "Elite cards" };
  const template = (selector) => document.querySelector(`#econ-templates ${selector}`).firstElementChild.cloneNode(true);
  const fmt = (n, d = 2) => n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (n) => `${(n * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
  const health = (r) => (r >= 0.95 ? "critical" : r > 0.8 ? "warning" : r > 0.75 ? "watch" : "target");
  let saved = Object.fromEntries(packs.map((p) => [p.key, { price: p.price, on: p.on }]));
  const draft = structuredClone(saved);
  const input = (key) => form.querySelector(`[data-price="${key}"]`);

  function update() {
    const regular = packs.find((p) => p.key === "regular");
    const warnings = [];
    for (const p of packs) {
      const price = draft[p.key].price;
      const valid = Number.isSafeInteger(price) && price > 0;
      const row = form.querySelector(`[data-row="${p.key}"]`);
      input(p.key).setAttribute("aria-invalid", String(!valid));
      if (!valid) continue;
      const ratio = p.perPack.discard / price;
      row.querySelector("[data-return]").textContent = pct(ratio);
      row.querySelector("[data-health]").replaceChildren(template(`[data-health-template="${health(ratio)}"]`));
      const state = row.querySelector("[data-state]");
      if (state) state.replaceChildren(template(`[data-state-template="${draft[p.key].on ? "on" : "off"}"]`));
      form.querySelector(`[data-removed="${p.key}"]`).textContent = Math.round(price - p.perPack.discard).toLocaleString("en-GB");
      if (health(ratio) !== "target")
        warnings.push(`${p.title} returns ${pct(ratio)} in discards${ratio >= 1 ? ", more than it costs" : ""}. Target: 75% or less.`);
      let worst = null;
      for (const key of Object.keys(LABEL)) {
        const cell = form.querySelector(`[data-cell="${p.key}:${key}"]`);
        const perCoin = (p.perPack[key] * 1000) / price;
        const regularPerCoin = (regular.perPack[key] * 1000) / draft.regular.price;
        const beats = p.key !== "regular" && regularPerCoin > 0 && perCoin > regularPerCoin;
        if (cell) {
          cell.textContent = `${beats ? "▲ " : ""}${fmt(perCoin, key === "discard" ? 0 : 2)}`;
          cell.classList.toggle("text-warning", beats);
        }
        if (beats && (!worst || perCoin / regularPerCoin > worst.ratio)) worst = { key, ratio: perCoin / regularPerCoin, a: perCoin, b: regularPerCoin };
      }
      if (worst)
        warnings.push(`${p.title} gives more ${LABEL[worst.key]} per coin than Regular (${fmt(worst.a)} vs ${fmt(worst.b)} per 1,000 coins).`);
      if (p.key !== "regular" && regular.chance[p.key] >= 0.9)
        warnings.push(`Regular already gives a ${p.key === "silver" ? "Silver" : "Gold"}+ in ${pct(regular.chance[p.key])} of packs; ${p.title} adds little.`);
    }
    form.querySelector("[data-warnings]").replaceChildren(...warnings.map((text) => {
      const li = document.createElement("li");
      li.className = "flex items-start gap-2 text-small";
      li.append(template("[data-warning-template]"), Object.assign(document.createElement("span"), { textContent: text }));
      return li;
    }));
    const changes = packs.flatMap((p) => [
      draft[p.key].price !== saved[p.key].price ? `${p.title.replace(" pack", "")} ${saved[p.key].price} → ${Number.isFinite(draft[p.key].price) ? draft[p.key].price : "?"}` : null,
      draft[p.key].on !== saved[p.key].on ? `${p.title.replace(" pack", "")} ${draft[p.key].on ? "on" : "off"}` : null,
    ]).filter(Boolean);
    const valid = packs.every((p) => Number.isSafeInteger(draft[p.key].price) && draft[p.key].price > 0);
    form.querySelector("[data-apply]").disabled = changes.length === 0 || !valid;
    form.querySelector("[data-dirty]").textContent = !valid ? "Prices must be whole coins above 0." : changes.length ? `Unsaved: ${changes.join(", ")}` : "";
  }

  for (const p of packs) {
    input(p.key).addEventListener("input", (event) => {
      draft[p.key].price = event.target.value === "" ? NaN : Number(event.target.value);
      update();
    });
    const toggle = form.querySelector(`[data-toggle="${p.key}"]`);
    toggle?.addEventListener("click", () => {
      draft[p.key].on = !draft[p.key].on;
      toggle.setAttribute("aria-checked", String(draft[p.key].on));
      toggle.classList.toggle("bg-moss", draft[p.key].on);
      toggle.classList.toggle("bg-line", !draft[p.key].on);
      const knob = toggle.firstElementChild;
      knob.classList.toggle("left-6", draft[p.key].on);
      knob.classList.toggle("bg-board-deep", draft[p.key].on);
      knob.classList.toggle("left-1", !draft[p.key].on);
      knob.classList.toggle("bg-ink-dim", !draft[p.key].on);
      update();
    });
  }
  form.querySelector("[data-suggest]").addEventListener("click", () => {
    // Fills the form only; nothing changes until Apply.
    for (const p of packs) if (p.suggested !== null) {
      draft[p.key].price = p.suggested;
      input(p.key).value = p.suggested;
    }
    update();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saved = structuredClone(draft);
    update();
    form.querySelector("[data-dirty]").textContent = "Applied as revision 6 (preview: nothing saved).";
  });
  update();
}
