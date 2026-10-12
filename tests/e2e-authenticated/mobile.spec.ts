import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";
import { BRAND } from "../../src/lib/brand";
import { assertLocalTarget } from "../support/local-target";
import {
  advanceFixtureEvening,
  COMPLETED_WEEK,
  endFixtureEvening,
  FIXTURE_PHOTO,
  LONG_CLUB,
  moveFixtureEveningTo,
  resetMidweekMember,
  setWeekArchetype,
  stageShootout,
  startFixtureEvening,
  type StagedKick,
} from "./midweek-fixture";

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  // Against the device's width, not `innerWidth`: a mobile browser widens its
  // layout viewport to fit an element that is too wide, and `innerWidth` grows
  // with it (a hidden table did that in PR 8).
  const width = page.viewportSize()?.width ?? 0;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, page.url()).toBeLessThanOrEqual(width + 1);
}

/**
 * The match page's Teams (ADR-111, DR5-15): on a phone behind its tab, from
 * `lg` beside Match. Every card with its Power, `Show every factor` opens five
 * boxes per card, and a factor's explanation shows on focus and closes on
 * Escape, all inside the screen. A pointer resting on another factor never
 * takes the focused explanation away (#279).
 */
async function expectMatchPageWhy(page: Page) {
  const tab = page
    .getByRole("navigation", { name: "This match" })
    .getByRole("link", { name: "Teams" });
  if (await tab.isVisible()) {
    await tab.click();
    await expect(page).toHaveURL(/\?tab=teams$/);
    await expect(tab).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("list", { name: "Key moments" })).toBeHidden();
  }
  await expect(page.getByRole("img", { name: /^Before kick-off: / })).toBeVisible();
  const why = page.getByRole("region", { name: /’s five$/ });
  await expect(why).toHaveCount(2);
  await expect(
    why.first().getByText(/ power, (strong|above ordinary|below ordinary|weak)$/),
  ).toHaveCount(5);
  await page.getByRole("button", { name: "Show every factor" }).click();
  await expect(page.getByRole("button", { name: "Hide the factors" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const form = page.getByRole("button", { name: "Form", exact: true }).first();
  await expect(form).toHaveAccessibleDescription(/^The Player's form this week/);
  await form.focus();
  const tip = page
    .getByRole("tooltip")
    .filter({ hasText: /^The Player's form this week/ })
    .first();
  await expect(tip).toBeVisible();
  // The mixed-input case (#279, KB-042): with Form focused, another factor
  // comes under the pointer, as when focusing scrolls one under a resting
  // pointer and Chromium fires a hover. Focus wins. (A hidden tooltip has no
  // role, so the filter finds the shown one or none.)
  const pick = page.getByRole("tooltip").filter({ hasText: /^Picking against/ });
  // The other five's first card: the open explanation covers the cards under Form.
  const otherPick = page.getByRole("button", { name: "Pick", exact: true }).nth(5);
  await otherPick.hover();
  await expect(tip).toBeVisible();
  await expect(pick).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  // Escape hides everything, the hovered factor too (WCAG 1.4.13).
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
  await expect(pick).toHaveCount(0);
  // Once focus leaves, hover shows the factor under the pointer again.
  await form.blur();
  await page.mouse.move(0, 0);
  await otherPick.hover();
  await expect(pick).toBeVisible();
}

/**
 * The deeper team colours (ADR-119): violet names on the left, teal on the
 * right, and both fills as a 3 px strip across the top of the scoreboard.
 */
async function expectTeamColours(page: Page) {
  const board = page.getByRole("group", { name: /^Final score:/ });
  const seen = await board.evaluate((el) => {
    const colour = (selector: string, property: "color" | "backgroundColor") => {
      const node = el.querySelector(selector);
      return node ? getComputedStyle(node)[property] : null;
    };
    const strip = el.querySelector(".bg-team-0-fill")?.parentElement?.getBoundingClientRect();
    return {
      names: [colour(".text-team-0", "color"), colour(".text-team-1", "color")],
      fills: [
        colour(".bg-team-0-fill", "backgroundColor"),
        colour(".bg-team-1-fill", "backgroundColor"),
      ],
      strip: strip && {
        height: strip.height,
        width: strip.width,
        top: strip.top - el.getBoundingClientRect().top,
      },
      board: el.getBoundingClientRect().width,
    };
  });
  expect(seen.names).toEqual(["rgb(158, 128, 209)", "rgb(79, 179, 160)"]);
  expect(seen.fills).toEqual(["rgb(111, 79, 161)", "rgb(31, 122, 108)"]);
  expect(seen.strip?.height).toBe(3);
  expect(seen.strip?.top).toBeLessThanOrEqual(1);
  expect(seen.strip?.width).toBeGreaterThan(seen.board - 4);
}

/**
 * The night's ratings (F7, ADR-117, DR5-6): five rows in neutral discs, one
 * `★ Best`, and the way to the rule, all inside the screen.
 */
async function expectRatings(page: Page) {
  const block = page.getByRole("region", { name: "Your five’s ratings" });
  await expect(block).toBeVisible();
  await expect(block.getByText(/^Mean of \d+ match(es)?$/)).toBeVisible();
  await expect(block.getByText(/^rated \d+\.\d out of 10 for the night$/)).toHaveCount(5);
  await expect(block.getByText("★ Best")).toHaveCount(1);
  await expect(block.getByRole("link", { name: "How ratings work" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

/** A picker card's Add button (DR5-13): it fills the first empty slot. */
const PICK_BUTTON = /^Add to your five: /;

/** Compete's tab while it asks for a pick: the word, then what it means (ADR-107). */
const PICK_NAME = /^Compete Pick\. Midweek Madness: you haven't picked your five$/;

/** The visible bar's Compete tab: the bottom bar on a phone, the top bar from `sm`. */
function competeTab(page: Page) {
  return page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /^Compete/ });
}

async function withDatabase(work: (database: Client) => Promise<void>) {
  const databaseUrl = process.env.DB_URL;
  if (!databaseUrl) throw new Error("Authenticated E2E requires DB_URL.");
  assertLocalTarget(databaseUrl, "DB_URL");
  const database = new Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    await work(database);
  } finally {
    await database.end();
  }
}

async function resetMidweek(username: string) {
  await withDatabase((database) => resetMidweekMember(database, username));
}

test("member can sign in and use core mobile routes", { tag: "@narrow" }, async ({ page }) => {
  await signIn(page, "release_member");
  await expect(page.getByRole("heading", { name: `This week in ${BRAND.shortName}` })).toBeVisible({
    timeout: 15_000,
  });
  await expectNoHorizontalOverflow(page);

  for (const route of [
    "/club/collection",
    "/club/packs",
    "/midweek",
    "/midweek/pick",
    `/midweek/${COMPLETED_WEEK}`,
    `/midweek/${COMPLETED_WEEK}/bracket`,
    `/midweek/${COMPLETED_WEEK}/night`,
    `/midweek/${COMPLETED_WEEK}/calls`,
    `/midweek/${COMPLETED_WEEK}/picks`,
    "/market",
    "/leaderboard",
  ]) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/\/login$/);
    await expectNoHorizontalOverflow(page);
  }
});

test.describe("Midweek Madness entry (PR 7)", () => {
  const five = [
    "Keeper Fixture",
    "Winger Fixture",
    "Striker Fixture",
    "Wall Fixture",
    "Engine Fixture",
  ];

  test.beforeEach(async () => {
    await resetMidweek("release_member");
  });

  test("member picks five cards, saves, and sees them saved after a reload", async ({ page }) => {
    await signIn(page, "release_member");
    await expect(page.getByRole("link", { name: /Pick your five/ })).toBeVisible();
    // Compete asks for the pick until one is saved (ADR-107).
    await expect(competeTab(page)).toHaveAccessibleName(PICK_NAME);

    // The hub (DR5-12): the brass Now block asks for the five; the picker has its own page.
    await page.goto("/midweek");
    await expect(page.getByRole("heading", { level: 1, name: "Midweek Madness" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your five" })).toContainText(
      "Not picked yet, so an auto squad would play.",
    );
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "Pick your five" }).click();
    await expect(page).toHaveURL(/\/midweek\/pick$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pick your five" })).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Not picked: an auto squad plays." }),
    ).toBeVisible();
    // One row per Player: the second copy is a note, not a sixth row.
    await expect(page.getByText(/×2/).filter({ visible: true })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);

    for (const name of five) {
      await page.getByRole("button", { name: new RegExp(`^Add to your five: ${name}`) }).click();
    }
    await expect(page.getByText("Keeper Fixture goes in goal and isn’t counted.")).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Save to make it count." }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Save your five" }).click();
    await expect(page.getByText("Saved. Your five play on Wednesday.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: /^Saved / })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change your five" })).toBeVisible();
    await expect(page.getByText(/^✓ In/).filter({ visible: true })).toHaveCount(five.length);
    await expectNoHorizontalOverflow(page);

    await page.goto("/midweek");
    await expect(page.getByRole("region", { name: "Your five" })).toContainText("✓ Saved");
    await expect(page.getByRole("link", { name: "Change your five" })).toBeVisible();

    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "Now" }).getByRole("link", { name: "Change your five" }),
    ).toBeVisible();
    await expect(competeTab(page)).toHaveAccessibleName("Compete");
  });

  test(
    "the picker filters by archetype, keeps Save in reach, and names a coming archetype (KB-028/029)",
    { tag: "@narrow" },
    async ({ page }) => {
      await withDatabase((database) => setWeekArchetype(database, "Winger Fixture", "goalkeeper"));
      await signIn(page, "release_member");
      await page.goto("/midweek/pick");
      await expect(page.getByText(/ · locks \d\d:\d\d$/)).toBeVisible();
      // KB-028 in the phone list: the week's archetype, and the change in words.
      await expect(
        page.getByText("Goalkeeper this week, Speedster from next").filter({ visible: true }),
      ).toHaveCount(1);

      // The archetypes live in the Filter sheet (Q7); Goalkeepers counts the week's archetype.
      const filter = async (name: string | RegExp, result: string) => {
        await page.getByRole("button", { name: /^Filter/ }).click();
        const sheet = page.getByRole("dialog", { name: "Filter" });
        // The radio is visually hidden inside its chip: tap the chip, as a member does.
        await sheet.locator("label", { hasText: name }).click();
        await expect(sheet.getByRole("radio", { name })).toBeChecked();
        await sheet.getByRole("button", { name: result }).click();
        await expect(sheet).toBeHidden();
      };
      await filter("Goalkeepers 2", "Show 2 Players");
      await expect(page.getByRole("button", { name: "Filter 1 on" })).toBeVisible();
      await expect(page.getByRole("button", { name: PICK_BUTTON })).toHaveCount(2);
      await filter(/^All /, "Show 5 Players");
      await expect(page.getByRole("button", { name: PICK_BUTTON })).toHaveCount(5);

      // Unsaved changes on a phone: one compact row stays above the tab bar.
      await page.getByRole("button", { name: /: Striker Fixture$/ }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Save to make it count." }),
      ).toBeVisible();
      await page.getByRole("button", { name: /: Engine Fixture$/ }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "Save your five" })).toBeInViewport();
      await expectNoHorizontalOverflow(page);

      // From lg: the card face says what the Player plays from next week, and
      // the five's slot says it in words.
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(
        page.getByText("Speedster from next week").filter({ visible: true }),
      ).toHaveCount(1);
      await page.getByRole("button", { name: /: Winger Fixture$/ }).click();
      await expect(
        page
          .getByRole("list", { name: "Your five" })
          .getByText("Goalkeeper this week, Speedster from next"),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    },
  );

  test("the plusses count follows the five: no count without a Goalkeeper, a short line and its factor, then balanced", async ({
    page,
  }) => {
    const add = (name: string) =>
      page.getByRole("button", { name: new RegExp(`${PICK_BUTTON.source}${name}`) }).click();
    await signIn(page, "release_member");
    await page.goto("/midweek/pick");
    // Each phone row shows its card's plusses, from the engine's table.
    await expect(
      page.getByText("Plusses: attack 3, midfield 1, defence 0").filter({ visible: true }),
    ).toHaveCount(1);

    const lines = page.getByRole("region", { name: "Plusses per line" });
    for (const name of ["Striker Fixture", "Winger Fixture", "Engine Fixture"]) await add(name);
    await expect(lines.getByText(/^Add a Goalkeeper to see your count\./)).toBeVisible();
    await expect(page.getByText("No Goalkeeper yet, so no line count")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // With the Goalkeeper in goal, the empty slot plays as a trialist (1/1/1).
    await add("Keeper Fixture");
    await expect(lines.getByRole("group")).toHaveAccessibleName(
      "Attack 7 of 3, enough; Midfield 7 of 3, enough; Defence 1 of 3, 2 short",
    );
    await expect(
      lines.getByText("2 plusses short, so your whole five plays at ×0.77 this week."),
    ).toBeVisible();
    await expect(lines.getByText("Keeper Fixture goes in goal and isn’t counted.")).toBeVisible();
    await expect(page.getByText("! Defence 2 short · ×0.77")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await add("Wall Fixture");
    await expect(lines.getByText("Every line has 3 or more, so no penalty.")).toBeVisible();
    await expect(page.getByText("✓ Lines balanced")).toBeVisible();
    await expect(lines.getByRole("link", { name: "How plusses work" })).toHaveAttribute(
      "href",
      "/how-it-works#plusses",
    );

    // From sm the save bar is inline and its second row is hidden; the count stays.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText("✓ Lines balanced")).toBeHidden();
    await expect(lines).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("the settings opt-out toggles, and the picker offers the way back", async ({ page }) => {
    await signIn(page, "release_member");
    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: "Midweek Madness" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expectNoHorizontalOverflow(page);

    await toggle.click();
    await expect(page.getByText("Opt out of Midweek Madness?")).toBeVisible();
    await page.getByRole("button", { name: "Opt out", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("You’ve opted out", { exact: true })).toBeVisible();

    await page.goto("/midweek");
    await expect(page.getByRole("heading", { name: "You’re sitting this out" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // Opted out, the picker sends you back to the hub, which says why.
    await page.goto("/midweek/pick");
    await expect(page).toHaveURL(/\/midweek$/);
    await page.getByRole("button", { name: "Take part again" }).click();
    await expect(page.getByRole("link", { name: "Pick your five" })).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("switch", { name: "Midweek Madness" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("Compete (ADR-107)", () => {
  test.beforeEach(async () => {
    await resetMidweek("release_member");
  });

  test("Compete owns Midweek, Standings and Players, and the old Midweek links redirect", async ({
    page,
  }) => {
    await signIn(page, "release_member");

    await competeTab(page).click();
    await expect(page).toHaveURL(/\/midweek$/);
    await expect(competeTab(page)).toHaveAttribute("aria-current", "page");
    const sections = page.getByRole("navigation", { name: "Compete" });
    await expect(sections.getByRole("link", { name: "Midweek" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await sections.getByRole("link", { name: "Standings" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Standings" })).toBeVisible();
    await expect(competeTab(page)).toHaveAttribute("aria-current", "true");
    await expectNoHorizontalOverflow(page);

    await page
      .getByRole("navigation", { name: "Compete" })
      .getByRole("link", { name: "Players" })
      .click();
    await expect(page).toHaveURL(/\/players$/);
    await expect(competeTab(page)).toHaveAttribute("aria-current", "true");
    await expectNoHorizontalOverflow(page);

    // Permanent redirects keep shared links working (DR1-2).
    await page.goto("/club/midweek");
    await expect(page).toHaveURL(/\/midweek$/);
    await page.goto(`/club/midweek/${COMPLETED_WEEK}`);
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}$`));
    await expect(page.getByText(/^Midweek Madness · .+ won it$/)).toBeVisible();

    // The Collection strip is gone (Q12): Compete's badge and Home's card replace it.
    await page.goto("/club/collection");
    await expect(page.getByText(/Midweek Madness: pick five of these/)).toHaveCount(0);
  });

  test("on a 1440 px desktop the top bar carries Compete and its badge", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, "release_member");
    await expect(competeTab(page)).toHaveAccessibleName(PICK_NAME);
    for (const route of ["/", "/midweek", "/leaderboard", "/players"]) {
      await page.goto(route);
      await expect(competeTab(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("from 640 px to lg the top bar fits the screen (KB-033)", async ({ page }) => {
    await signIn(page, "release_member");
    for (const width of [640, 768, 1023]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/midweek", "/market"]) {
        await page.goto(route);
        // Icons only below lg, but every tab keeps its name.
        await expect(competeTab(page)).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Market" }),
        ).toBeVisible();
        await expect(page.getByRole("link", { name: /^Settings, / })).toBeInViewport();
        await expectNoHorizontalOverflow(page);
      }
    }
  });
});

test.describe("Midweek Madness results (PR 8)", () => {
  test(
    "a completed week's bracket and a match report fit the screen",
    { tag: "@narrow" },
    async ({ page }) => {
      await signIn(page, "release_member");

      // The hub's Last week tile carries last week's result and opens that week.
      await page.goto("/midweek");
      await expect(page.getByRole("region", { name: "Your five" })).toBeVisible();
      await page.getByRole("link", { name: /^Last week/ }).click();
      await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}$`));

      // The week page (E2-Week-Past): who won it, your night, the final and its tiles.
      await expect(page.getByText(/^Midweek Madness · .+ won it$/)).toBeVisible();
      await expect(page.getByRole("region", { name: "The final" })).toBeVisible();
      await expect(page.getByText("✓ Matches the seal.")).toBeAttached();
      await expectNoHorizontalOverflow(page);
      await page.getByRole("link", { name: /^Who picked whom/ }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Who picked whom" })).toBeVisible();
      await expect(page.getByRole("table")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // The bracket, latest round first: release_member's own path is marked,
      // and a played match opens its report.
      await page.goto(`/midweek/${COMPLETED_WEEK}`);
      await page.getByRole("link", { name: /^Bracket Won by / }).click();
      await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}/bracket$`));
      await expect(page.getByRole("heading", { name: "Final", exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expect(page.getByText("You", { exact: true }).first()).toBeVisible();
      await page
        .getByRole("link", { name: /^Match report: / })
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}/match/[0-9a-f-]{36}$`));
      // The Match tab (DR5-15): the moments, with Teams behind its tab.
      await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Key moments" })).toBeVisible();
      await expect(page.getByRole("region", { name: /’s five$/ }).first()).toBeHidden();
      await expectNoHorizontalOverflow(page);
      await expectTeamColours(page);

      await expectMatchPageWhy(page);
    },
  );

  test("on a 1440 px desktop a match report puts Teams beside the story", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, "release_member");
    await page.goto(`/midweek/${COMPLETED_WEEK}/bracket`);
    await page
      .getByRole("link", { name: /^Match report: / })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}/match/[0-9a-f-]{36}$`));
    // Both views side by side, so the tabs hide.
    await expect(page.getByRole("navigation", { name: "This match" })).toBeHidden();
    const story = await page.getByRole("list", { name: "Key moments" }).boundingBox();
    const why = await page.getByRole("heading", { name: "Teams" }).boundingBox();
    expect(why!.x).toBeGreaterThan(story!.x + story!.width);
    await expectNoHorizontalOverflow(page);
    await expectTeamColours(page);
    await expectMatchPageWhy(page);
  });

  test("your night lists your five's ratings, and How ratings work lands on the rule", async ({
    page,
  }) => {
    await signIn(page, "release_member");
    await page.goto(`/midweek/${COMPLETED_WEEK}`);
    await page.getByRole("link", { name: /^Your night / }).click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}/night$`));
    await expectRatings(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectRatings(page);

    await page.getByRole("link", { name: "How ratings work" }).click();
    await expect(page).toHaveURL(/\/how-it-works#midweek-ratings$/);
    await expect(page.getByRole("heading", { name: "Ratings", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("from lg, every bracket line meets the match it leads to (KB-031)", async ({ page }) => {
    await signIn(page, "release_member");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/midweek/${COMPLETED_WEEK}/bracket`);
    const tree = page.getByTestId("bracket-tree");
    await expect(tree).toBeVisible();
    // The fixture's five entrants leave byes beside matches in round 1, the
    // case the mockups never showed.
    await expect(tree.locator('[data-tree-pair^="1/"]').getByText("Bye")).not.toHaveCount(0);

    const box = async (selector: string) => {
      const found = await tree.locator(selector).boundingBox();
      if (!found) throw new Error(`${selector} has no box`);
      return found;
    };
    const middle = (b: { y: number; height: number }) => b.y + b.height / 2;
    const rounds = await tree.locator("section").count();
    for (let round = 1; round < rounds; round += 1) {
      const groups = await tree.locator(`[data-tree-group^="${round}/"]`).count();
      for (let group = 0; group < groups; group += 1) {
        // The group's bracket line runs from a quarter to three quarters of its
        // height: those ends must be the middles of its two pairings, and its
        // middle the middle of the next round's pairing.
        const outer = await box(`[data-tree-group="${round}/${group}"]`);
        const top = await box(`[data-tree-pair="${round}/${2 * group}"]`);
        const bottom = await box(`[data-tree-pair="${round}/${2 * group + 1}"]`);
        const next = await box(`[data-tree-pair="${round + 1}/${group}"]`);
        const label = `round ${round}, group ${group}`;
        expect(Math.abs(middle(top) - (outer.y + outer.height / 4)), label).toBeLessThanOrEqual(1);
        expect(
          Math.abs(middle(bottom) - (outer.y + (3 * outer.height) / 4)),
          label,
        ).toBeLessThanOrEqual(1);
        expect(Math.abs(middle(next) - middle(outer)), label).toBeLessThanOrEqual(1);
      }
    }
    await expectNoHorizontalOverflow(page);
  });

  test(
    "a 79-character club is cut in the rows, whole in their labels, and clamped on the scoreboard (#262, DR4-9)",
    { tag: "@narrow" },
    async ({ page }) => {
      await signIn(page, "release_member");
      await page.goto(`/midweek/${COMPLETED_WEEK}/bracket`);
      // The row's report link names the whole club; its own text is cut to one line.
      const report = page
        .getByRole("link", { name: new RegExp(`^Match report: .*${LONG_CLUB}`) })
        .first();
      await expect(report).toBeVisible();
      const cut = page.getByText(/^Sportclub Elinewijk/).first();
      await expect(cut).toBeVisible();
      expect(await cut.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
      await expectNoHorizontalOverflow(page);

      // The report: the scoreboard names it in full to a screen reader and shows at
      // most two lines; on the Teams tab its five's heading wraps it in full.
      await report.click();
      const board = page.getByRole("group", { name: new RegExp(`^Final score: .*${LONG_CLUB}`) });
      await expect(board).toBeVisible();
      const name = board.getByText(/^Sportclub Elinewijk/).first();
      const lines = await name.evaluate(
        (node) => node.clientHeight / parseFloat(getComputedStyle(node).lineHeight),
      );
      expect(lines).toBeLessThanOrEqual(2.05);
      await page.getByRole("link", { name: "Teams" }).click();
      await expect(
        page.getByRole("heading", { level: 3, name: new RegExp(`^${LONG_CLUB}`) }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    },
  );

  test("past weeks list every finished week, each opening its bracket", async ({ page }) => {
    await signIn(page, "release_member");
    await page.goto("/midweek/past");
    await expect(page.getByRole("heading", { level: 1, name: "Past weeks" })).toBeVisible();
    const week = page
      .getByRole("list", { name: "Past weeks" })
      .getByRole("link", { name: / won it · \d+ entrants\. You/ })
      .last();
    await expect(week).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await week.click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}$`));
  });

  test("a bracket URL that isn't a week, or a match that isn't a uuid, is not found", async ({
    page,
  }) => {
    await signIn(page, "release_member");
    for (const url of [
      "/midweek/2001-01-16",
      "/midweek/not-a-week",
      `/midweek/${COMPLETED_WEEK}/match/not-a-uuid`,
    ]) {
      // A streamed page answers before `notFound()` runs, so check the page, not the status.
      await page.goto(url);
      await expect(page.getByRole("heading", { name: "Page not found" }), url).toBeVisible();
    }
  });
});

/** The hub's Small line under its Title (DR5-12): `Wed 7 Oct · the draw is out`. */
const hubLine = (page: Page, phase: RegExp) =>
  page.getByText(new RegExp(`^\\w{3} \\d+ \\w{3} · ${phase.source}$`));

test.describe("Midweek Madness evening from the lock (F5, ADR-113)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test(
    "from the lock: the draw, every five, kick-off times and the bracket",
    { tag: "@narrow" },
    async ({ page }) => {
      await resetMidweek("release_member");
      let weekStart = "";
      await withDatabase(async (database) => {
        ({ weekStart } = await startFixtureEvening(database));
      });
      await signIn(page, "release_member");
      await page.goto("/midweek");

      await expect(hubLine(page, /the draw is out/)).toBeVisible();
      // The sticky evening clock is retired (DR5 Q3, ADR-154).
      await expect(page.getByTestId("midweek-clock")).toHaveCount(0);
      const first = page.getByRole("region", { name: "Your first match" });
      await expect(first).toBeVisible();
      // release_member's auto squad, and one or two opponents' fives, from the lock.
      expect(await first.getByRole("list").count()).toBeGreaterThanOrEqual(2);
      await expect(first.getByRole("list", { name: "Your five" })).toBeVisible();
      await expect(first.getByText("Auto", { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /^Your night Starts \d\d:\d\d/ })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      // KB-034: with `Live` on Midweek, Compete's tabs stay inside the page's
      // 16 px gutter, which the page-width check alone can't see.
      const tabs = await page.getByRole("navigation", { name: "Compete" }).boundingBox();
      expect(tabs!.x + tabs!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 15);

      await page.getByRole("link", { name: /^Bracket / }).click();
      await expect(page).toHaveURL(new RegExp(`/midweek/${weekStart}/bracket$`));
      await expect(page.getByRole("heading", { level: 1, name: "Bracket" })).toBeVisible();
      await expect(
        page
          .getByRole("group", { name: /, kick-off \d\d:\d\d\.$|has a bye, which counts/ })
          .first(),
      ).toBeVisible();
      // Nothing is played yet: no full-time row, no report link.
      await expect(page.getByRole("link", { name: /^Match report: / })).toHaveCount(0);
      await expect(page.getByText(/^Kick-off \d\d:\d\d$/).first()).toBeVisible();
      // On a phone a round shows from 15 minutes before its kick-off (DR5-14).
      await expect(page.locator("#round-1")).toBeVisible();
      await expect(page.locator("#round-2")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    },
  );

  test("between rounds: results at full time, the next kick-offs and your night", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    await withDatabase(async (database) => {
      ({ weekStart } = await startFixtureEvening(database));
      // Round 1 (lock + 5) has ended, even with 50 kicks (8:55); round 2 kicks
      // off in four minutes (lock + 20).
      await advanceFixtureEvening(database, 15);
    });
    await signIn(page, "release_member");
    await page.goto("/midweek");

    await expect(
      hubLine(
        page,
        /(round 2 is live|(quarter|semi)-finals are live|you’re out|the final is live)/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /^(Your next match|You’re out|Your match|The final)$/ }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/midweek/${weekStart}/night`);
    await expect(page.getByRole("heading", { name: "Round by round" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Your night" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto(`/midweek/${weekStart}/bracket`);
    await expect(page.getByRole("group", { name: / won\.$/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Match report: / }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page
      .getByRole("link", { name: /^Match report: / })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
  });

  test("after the final: the champion, your ratings and the way to past weeks", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    await withDatabase(async (database) => {
      await startFixtureEvening(database);
      // Long past the end of any final: the worker pays and completes the week.
      await advanceFixtureEvening(database, 120, { runWorker: true });
    });
    await signIn(page, "release_member");
    await page.goto("/midweek");

    // The title names the champion (Q4); the Now block is your night.
    await expect(page.getByRole("heading", { level: 1, name: / are champions$/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your night" })).toContainText("Your finish");
    await expect(page.getByRole("region", { name: "The final" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // The ratings and the share images are behind the Your night tile.
    await page.getByRole("link", { name: /^Your night / }).click();
    await expect(page).toHaveURL(/\/night$/);
    await expectRatings(page);
    await expect(page.getByRole("region", { name: "Share the night" })).toBeVisible();
    await page.goto("/midweek");
    await page.getByRole("link", { name: /^Past weeks/ }).click();
    await expect(page).toHaveURL(/\/midweek\/past$/);
    await expect(page.getByRole("heading", { level: 1, name: "Past weeks" })).toBeVisible();
  });

  test("on a 1440 px desktop the fives sit side by side and the tree shows kick-offs", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetMidweek("release_member");
    let weekStart = "";
    await withDatabase(async (database) => {
      ({ weekStart } = await startFixtureEvening(database));
    });
    await signIn(page, "release_member");
    await page.goto("/midweek");
    await expect(hubLine(page, /the draw is out/)).toBeVisible();
    // From lg the tiles sit beside the Now block (DR5-12).
    const now = await page.getByRole("region", { name: "Your first match" }).boundingBox();
    const tiles = await page.getByRole("navigation", { name: "Midweek" }).boundingBox();
    expect(tiles!.x).toBeGreaterThan(now!.x + now!.width);
    await expectNoHorizontalOverflow(page);

    await page.goto(`/midweek/${weekStart}/bracket`);
    const tree = page.getByTestId("bracket-tree");
    await expect(tree).toBeVisible();
    await expect(tree.getByText(/^Kick-off \d\d:\d\d$/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

/** The fixture evening's matches in one round, and release_member's id. */
async function roundMatches(weekStart: string, round: number) {
  let result: {
    member: string;
    matches: { id: string; side_0_user_id: string; side_1_user_id: string }[];
  } = { member: "", matches: [] };
  await withDatabase(async (database) => {
    const member = await database.query<{ id: string }>(
      "select id from kut.profiles where username = 'release_member'",
    );
    const matches = await database.query<{
      id: string;
      side_0_user_id: string;
      side_1_user_id: string;
    }>(
      `select m.id, m.side_0_user_id, m.side_1_user_id from kut.midweek_matches m
       join kut.midweek_tournaments t on t.id = m.tournament_id
       where t.week_start = $1 and m.round = $2 and not m.bye order by m.pairing`,
      [weekStart, round],
    );
    result = { member: member.rows[0].id, matches: matches.rows };
  });
  return result;
}

/** A live scoreboard, `Live, 48th minute: Mila 1, Eline 0`, never a row in play. */
const LIVE_BOARD = /^Live, (?!.*Watch it\.$)/;

/** A row in play (DR4-6, ADR-148): `Live, 48th minute: Mila 1, Eline 0. Watch it.` */
const LIVE_ROW = /^Live, (?:\d+(?:st|nd|rd|th) minute|penalties): .+ \d+, .+ \d+.*\. Watch it\.$/;

test.describe("Midweek Madness live (F6, ADR-115)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test("a match in play: your own live, every other in play, no result before full time", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    await withDatabase(async (database) => {
      ({ weekStart } = await startFixtureEvening(database));
      // Round 1 kicked off a minute ago.
      await advanceFixtureEvening(database, 5);
    });
    const { member, matches } = await roundMatches(weekStart, 1);
    const isMine = (m: (typeof matches)[number]) =>
      m.side_0_user_id === member || m.side_1_user_id === member;
    const match = matches.find(isMine) ?? matches[0];
    const mine = isMine(match);
    const other = matches.find((m) => !isMine(m));
    await signIn(page, "release_member");

    // Home's block (DR5-16): brass with Watch it while your own match plays.
    const home = page.getByRole("region", { name: "Now" }).getByRole("region").first();
    await expect(home).toContainText("Live");
    if (mine) await expect(home.getByRole("link", { name: "Watch it" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/midweek");
    await expect(page.getByText(/^Updated \d\d:\d\d:\d\d$/)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Bracket .+ · \d+ live$/ })).toBeVisible();
    if (mine) {
      // Your match: the score and the minute only, no moment on the hub (DR5-12).
      await expect(page.getByRole("heading", { name: "Your match" })).toBeVisible();
      await expect(page.getByRole("group", { name: LIVE_BOARD })).toBeVisible();
      await expect(page.getByRole("link", { name: "Watch it", exact: true })).toBeVisible();
      await expect(page.getByRole("list", { name: "The latest chance" })).toHaveCount(0);
    }
    await expectNoHorizontalOverflow(page);

    await page.goto(`/midweek/${weekStart}/bracket`);
    if (other) {
      // Every match in play is live on its row, with its score so far (ADR-148).
      await expect(page.getByRole("group", { name: LIVE_ROW }).first()).toBeVisible();
    }
    // Nothing about round 1 reads as played yet.
    await expect(page.getByRole("group", { name: / won\.$/ })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // While the week is played, its own page is the hub.
    await page.goto(`/midweek/${weekStart}`);
    await expect(page).toHaveURL(/\/midweek$/);

    // Every match in play is watched live (ADR-147).
    await page.goto(`/midweek/${weekStart}/match/${match.id}`);
    await expect(page.getByText(mine ? / · live · your match$/ : /^[^·]+ · live$/)).toBeVisible();
    await expect(page.getByRole("group", { name: LIVE_BOARD })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How it’s going" })).toBeVisible();
    await expect(page.getByText(/· checks every 10 seconds$/)).toBeVisible();
    await expect(page.getByRole("group", { name: /^Final score:/ })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    // Teams before full time: both fives, without goals or assists (ADR-115).
    await page
      .getByRole("navigation", { name: "This match" })
      .getByRole("link", { name: "Teams" })
      .click();
    await expect(page).toHaveURL(/\?tab=teams$/);
    const teams = page.getByRole("region", { name: "Teams" });
    await expect(teams.getByRole("region", { name: /’s five$/ })).toHaveCount(2);
    await expect(teams).not.toContainText(/\b\d+ (goal|assist)s?\b/);
    await expectNoHorizontalOverflow(page);

    if (mine && other) {
      await page.goto(`/midweek/${weekStart}/match/${other.id}`);
      await expect(page.getByText(/^[^·]+ · live$/)).toBeVisible();
      await expect(page.getByRole("heading", { name: "How it’s going" })).toBeVisible();
      await expect(page.getByText(/^You’re not in this match/)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the final is live for everyone, on the evening and its own page", async ({ page }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    let rounds = 0;
    await withDatabase(async (database) => {
      ({ weekStart, rounds } = await startFixtureEvening(database));
      // The final kicked off a minute ago: lock + 5 + 15 × (rounds − 1).
      await advanceFixtureEvening(database, 5 + 15 * (rounds - 1));
    });
    const { matches } = await roundMatches(weekStart, rounds);
    await signIn(page, "release_member");
    await page.goto("/midweek");
    await expect(hubLine(page, /the final is live/)).toBeVisible();
    await expect(page.getByRole("region", { name: "The final" })).toBeVisible();
    await expect(page.getByRole("group", { name: LIVE_BOARD })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/midweek/${weekStart}/match/${matches[0].id}`);
    await expect(page.getByText(/^The final · live$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "How it’s going" })).toBeVisible();
    const story = await page.getByRole("heading", { name: "How it’s going" }).boundingBox();
    const why = await page.getByRole("heading", { name: "Teams" }).boundingBox();
    // From lg Teams sits beside the story.
    expect(why!.x).toBeGreaterThan(story!.x + 200);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Midweek Madness, every match live (MM 3.0 S3, ADR-147)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  /** A round-2 match release_member isn't in: round 2 always has two, so one is someone else's. */
  async function othersMatch() {
    await resetMidweek("release_member");
    let weekStart = "";
    await withDatabase(async (database) => {
      ({ weekStart } = await startFixtureEvening(database));
    });
    const { member, matches } = await roundMatches(weekStart, 2);
    const other = matches.find((m) => m.side_0_user_id !== member && m.side_1_user_id !== member);
    if (!other) throw new Error("The fixture evening has no round-2 match without release_member.");
    return { matchId: other.id, url: `/midweek/${weekStart}/match/${other.id}` };
  }

  /** The page `seconds` after the match's kick-off, and the HTML it was served as. */
  async function openAt(page: Page, url: string, matchId: string, seconds: number) {
    await withDatabase((database) => moveFixtureEveningTo(database, matchId, seconds));
    const response = await page.goto(url);
    return (await response!.text()).replace(/<!-- -->/g, "");
  }

  /** What a live page must never carry before full time (ADR-106, ADR-115). */
  function expectNoResult(html: string) {
    expect(html).not.toMatch(/Final score|✓ Through|How it went|Decider|on pens|ends_at/);
  }

  /** A kick's moment after kick-off: 280 seconds of play, then one every 5 (ADR-104). */
  const kickAt = (kick: number) => 280 + 5 * kick;

  test(
    "another member's match one minute in: its chances so far, a ticking clock, nothing of its result",
    { tag: "@narrow" },
    async ({ page }) => {
      const { url, matchId } = await othersMatch();
      await signIn(page, "release_member");
      // Compile the route before its timing matters (the dev server compiles on first visit).
      await page.goto(url);
      const html = await openAt(page, url, matchId, 60);

      await expect(page.getByText(/^[^·]+ · live$/)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^.+ v .+$/);
      await expect(page.getByRole("heading", { name: "How it’s going" })).toBeVisible();
      await expect(page.getByText("Newest first")).toBeVisible();
      await expect(page.getByText(/^Kick-off \d\d:\d\d$/)).toBeVisible();
      await expect(page.getByText(/· checks every 10 seconds$/)).toBeVisible();
      expectNoResult(html);
      // No moment from after the minute the server rendered.
      const rendered = Number(/Live, (\d+)(?:st|nd|rd|th) minute/.exec(html)?.[1]);
      expect(rendered).toBeGreaterThanOrEqual(19);
      for (const [, minute] of html.matchAll(/(\d+)(?:st|nd|rd|th) minute\. /g)) {
        expect(Number(minute)).toBeLessThanOrEqual(rendered);
      }
      // The clock ticks between polls (a minute is 3.1 seconds).
      const timer = page.getByRole("timer");
      await expect(timer).toHaveText(/^Live · \d+′$/);
      const first = await timer.textContent();
      await expect(timer).not.toHaveText(first!, { timeout: 6_000 });
      await expectNoHorizontalOverflow(page);
      // The scoreboard clips, so a name or chip pushed past its edge hides
      // instead of scrolling: every part must lie inside it (S8, 320 px).
      const board = page.getByRole("group", { name: LIVE_BOARD });
      const clipped = await board.evaluate((el) => {
        const edge = el.getBoundingClientRect();
        // A clamped name's inline parts include its hidden lines: the
        // paragraph's own box stands for them.
        return Array.from(el.querySelectorAll("*"))
          .filter((child) => {
            if (child.parentElement?.closest(".line-clamp-2")) return false;
            const box = child.getBoundingClientRect();
            return (
              box.width > 0 &&
              (box.left < edge.left - 1 ||
                box.right > edge.right + 1 ||
                box.bottom > edge.bottom + 1)
            );
          })
          .map(
            (child) =>
              `${child.tagName} ${child.className} ${JSON.stringify(child.getBoundingClientRect())} in ${JSON.stringify(edge)}`,
          );
      });
      expect(clipped).toEqual([]);

      await page.setViewportSize({ width: 1440, height: 900 });
      const story = await page.getByRole("heading", { name: "How it’s going" }).boundingBox();
      const why = await page.getByRole("heading", { name: "Teams" }).boundingBox();
      expect(why!.x).toBeGreaterThan(story!.x + 200);
      await expectNoHorizontalOverflow(page);
    },
  );

  test(
    "a long sudden death kick by kick (#263), then each kick's line and the decider at full time",
    { tag: "@narrow" },
    async ({ page }) => {
      const { url, matchId } = await othersMatch();
      // Six kicks each scored, then the loser's seventh saved: 14 kicks, 7–6.
      const kicks: StagedKick[] = [
        ...Array.from({ length: 6 }, (): StagedKick[] => [
          ["loser", "goal"],
          ["winner", "goal"],
        ]).flat(),
        ["loser", "save"],
        ["winner", "goal"],
      ];
      await withDatabase((database) => stageShootout(database, matchId, kicks));
      await signIn(page, "release_member");
      await page.goto(url);
      const html = await openAt(page, url, matchId, kickAt(12) + 2.5);

      await expect(page.getByRole("timer")).toHaveText(/^Live · pens \d+–\d+$/);
      await expect(page.getByText(/· checks every 5 seconds$/)).toBeVisible();
      await expect(page.getByText("Penalties · 0–0 at 90′")).toBeVisible();
      await expect(page.getByRole("group", { name: /: \d+ scored from \d+$/ })).toHaveCount(2);
      const feed = page.getByRole("list", { name: "The match so far, newest first" });
      const shownKicks = feed.getByText(/^(Latest\. )?Penalty \d+: /);
      const shown = await shownKicks.count();
      expect(shown).toBeGreaterThanOrEqual(12);
      expect(shown).toBeLessThan(14);
      await expect(page.getByText(`${shown} kicks so far`, { exact: true })).toBeVisible();
      await expect(shownKicks.first()).toHaveText(/^Latest\. Penalty \d+: /);
      // Exactly the kicks due are in the page.
      expect(html.match(/Penalty \d+: /g)).toHaveLength(shown);
      expectNoResult(html);
      await expectNoHorizontalOverflow(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await expectNoHorizontalOverflow(page);

      await withDatabase((database) => moveFixtureEveningTo(database, matchId, kickAt(14) + 1));
      await page.reload();
      await expect(page.getByRole("group", { name: /won 7–6 on penalties\.$/ })).toBeVisible();
      await expect(page.getByText("14 kicks", { exact: true })).toBeVisible();
      const story = page.getByRole("list", { name: "Every kick in order" });
      await expect(story.getByRole("listitem")).toHaveCount(14);
      await expect(story.getByText("Decider", { exact: true })).toHaveCount(1);
      await expect(story.getByRole("listitem").last()).toContainText("Decider");
      await expect(story.getByRole("listitem").nth(12)).toContainText("saved");
      await expectNoHorizontalOverflow(page);
    },
  );

  test("an early-decided shoot-out shows nothing of its end before its deciding kick", async ({
    page,
  }) => {
    const { url, matchId } = await othersMatch();
    await withDatabase((database) =>
      stageShootout(database, matchId, [
        ["loser", "save"],
        ["winner", "goal"],
        ["loser", "wide"],
        ["winner", "goal"],
        ["loser", "woodwork"],
        ["winner", "goal"],
      ]),
    );
    await signIn(page, "release_member");
    await page.goto(url);
    const html = await openAt(page, url, matchId, kickAt(5) + 2.5);
    await expect(page.getByRole("timer")).toHaveText(/^Live · pens (0–2|2–0)$/);
    await expect(page.getByText("5 kicks so far", { exact: true })).toBeVisible();
    await expect(page.getByText("Miss", { exact: true })).toHaveCount(3);
    expectNoResult(html);

    await withDatabase((database) => moveFixtureEveningTo(database, matchId, kickAt(6) + 1));
    await page.reload();
    await expect(page.getByRole("group", { name: /won 3–0 on penalties\.$/ })).toBeVisible();
    await expect(page.getByText("6 kicks", { exact: true })).toBeVisible();
    await expect(page.getByText("Decider", { exact: true })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });

  test("a shoot-out still level after every kick stays live until the draw settles it", async ({
    page,
  }) => {
    const { url, matchId } = await othersMatch();
    const level = Array.from({ length: 5 }, (): StagedKick[] => [
      ["loser", "goal"],
      ["winner", "goal"],
    ]).flat();
    await withDatabase((database) => stageShootout(database, matchId, level, true));
    await signIn(page, "release_member");
    await page.goto(url);
    // After the tenth kick, before the draw five seconds later.
    const html = await openAt(page, url, matchId, kickAt(10) + 2.5);
    await expect(page.getByRole("timer")).toHaveText("Live · pens 5–5");
    await expect(page.getByText("10 kicks so far", { exact: true })).toBeVisible();
    expectNoResult(html);

    await withDatabase((database) => moveFixtureEveningTo(database, matchId, kickAt(11) + 1));
    await page.reload();
    await expect(page.getByRole("group", { name: /won 5–5 on penalties\.$/ })).toBeVisible();
    await expect(page.getByText("Decider", { exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Midweek Madness rows live (MM 3.0 S4, ADR-148)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  /** The goals members may see now in these matches, counted from the stored events. */
  async function goalsSoFar(ids: string[]) {
    let goals = 0;
    await withDatabase(async (database) => {
      const counted = await database.query<{ goals: string }>(
        `select count(*)::text as goals from kut.midweek_match_events
         where match_id = any($1::uuid[]) and kind = 'chance' and outcome = 'goal'
           and reveal_at <= now()`,
        [ids],
      );
      goals = Number(counted.rows[0].goals);
    });
    return goals;
  }

  /** The goals the live rows show, summed: `… Mila 1, Eline 0. Watch it.` */
  async function goalsShown(rows: Locator) {
    let total = 0;
    for (const name of await rows.evaluateAll((all) =>
      all.map((row) => row.getAttribute("aria-label") ?? ""),
    )) {
      const [, a, b] = /: .+ (\d+), .+ (\d+)[,.]/.exec(name) ?? [];
      total += Number(a) + Number(b);
    }
    return total;
  }

  test(
    "every match in play shows Live, its score so far and a ticking minute, links to watch it, and no result",
    { tag: "@narrow" },
    async ({ page }) => {
      await resetMidweek("release_member");
      let weekStart = "";
      await withDatabase(async (database) => {
        ({ weekStart } = await startFixtureEvening(database));
      });
      const { matches } = await roundMatches(weekStart, 2);
      const ids = matches.map((m) => m.id);
      await signIn(page, "release_member");
      // Compile the routes before their timing matters.
      await page.goto("/midweek");
      await page.goto(`/midweek/${weekStart}/bracket`);
      // Round 2 kicked off 150 seconds ago: about the 48th minute.
      await withDatabase((database) => moveFixtureEveningTo(database, matches[0].id, 150));

      // The hub counts the matches in play on its Bracket tile, and sends no end.
      const hub = (await (await page.goto("/midweek"))!.text()).replace(/<!-- -->/g, "");
      expect(hub).not.toMatch(/ends_at/);
      await expect(
        page.getByRole("link", { name: new RegExp(`^Bracket .+ · ${matches.length} live$`) }),
      ).toBeVisible();

      for (const url of [`/midweek/${weekStart}/bracket`]) {
        const before = await goalsSoFar(ids);
        const html = (await (await page.goto(url))!.text()).replace(/<!-- -->/g, "");
        const after = await goalsSoFar(ids);
        const rows = page.getByRole("group", { name: LIVE_ROW });
        await expect(rows, url).toHaveCount(matches.length);
        const shown = await goalsShown(rows);
        expect(shown, url).toBeGreaterThanOrEqual(before);
        expect(shown, url).toBeLessThanOrEqual(after);
        // Nothing of round 2 reads as played: no end in the payload, and no
        // result, report link or full time in its section (round 1's played
        // rows may say "on penalties").
        expect(html, url).not.toMatch(/ends_at/);
        const round2 = page.locator("#round-2");
        await expect(round2.getByRole("group", { name: / won\.$/ }), url).toHaveCount(0);
        await expect(round2.getByRole("link", { name: /^Match report: / }), url).toHaveCount(0);
        await expect(round2.getByText("Full time"), url).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
      }

      // The minute ticks between polls (a minute is 3.1 seconds).
      const minute = page
        .getByRole("group", { name: LIVE_ROW })
        .first()
        .getByText(/^\d+′$/);
      const first = await minute.textContent();
      await expect(minute).not.toHaveText(first!, { timeout: 6_000 });

      // Every row links to its match, live.
      await page
        .getByRole("link", { name: /^Watch it: .+ v .+$/ })
        .first()
        .click();
      await expect(page).toHaveURL(/\/match\/[0-9a-f-]{36}$/);
      await expect(page.getByText(/ · live$/)).toBeVisible();

      // From lg the tree carries the same live rows, inside the screen.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/midweek/${weekStart}/bracket`);
      const tree = page.getByTestId("bracket-tree");
      await expect(tree.getByRole("group", { name: LIVE_ROW })).toHaveCount(matches.length);
      await expectNoHorizontalOverflow(page);
    },
  );
});

type OutMember = { login: string; round: number };

/**
 * Whoever goes out first before the final, a release account if one does, and
 * the round they lose in. The field is the local stack's, so it can be a
 * fixture member: then it gets the release password for this test (local rows
 * the teardown deletes).
 */
async function outMember(
  database: Client,
  weekStart: string,
  rounds: number,
): Promise<OutMember | null> {
  const lost = await database.query<{ id: string; username: string | null; round: number }>(
    `select p.id, p.username, min(m.round)::int as round from kut.midweek_matches m
     join kut.midweek_tournaments t on t.id = m.tournament_id
     join kut.profiles p on p.id in (m.side_0_user_id, m.side_1_user_id)
     where t.week_start = $1 and not m.bye and m.winner_user_id <> p.id
       and (p.username in ('release_member', 'release_admin') or p.id::text like '00000097-%')
     group by p.id, p.username
     having min(m.round) < $2
     order by (p.username is null), 3, p.username
     limit 1`,
    [weekStart, rounds],
  );
  const row = lost.rows[0];
  if (!row) return null;
  if (row.username) return { login: row.username, round: row.round };
  const email = await database.query<{ email: string }>(
    `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
       email_confirmed_at = coalesce(email_confirmed_at, now()),
       instance_id = '00000000-0000-0000-0000-000000000000',
       confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = ''
     where id = $1 returning email`,
    [row.id, "fictional-release-password"],
  );
  return { login: email.rows[0].email, round: row.round };
}

test.describe("Midweek Madness calls (D, ADR-118)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test("once out, a member calls the later matches, sees them on the bracket, and is paid for the right ones", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    let rounds = 0;
    let out = null as OutMember | null;
    await withDatabase(async (database) => {
      ({ weekStart, rounds } = await startFixtureEvening(database));
      out = await outMember(database, weekStart, rounds);
      // A minute before the next round kicks off: every match before it has ended.
      if (out) await advanceFixtureEvening(database, 3 + 15 * out.round);
    });
    test.skip(!out, "Nobody in the fixture goes out before the final.");
    await signIn(page, out!.login);

    // Out: the hub's Now block says so and leads to the calls (DR5-12, DR5-14).
    await page.goto("/midweek");
    await expect(page.getByRole("region", { name: "You’re out" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Calls \d+ open$/ })).toBeVisible();
    await page.getByRole("link", { name: "Make your calls" }).click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${weekStart}/calls$`));
    const block = page.getByRole("list", { name: "Calls" });
    await expect(block).toBeVisible();
    await expect(
      page.getByText(
        new RegExp(`· \\+\\d+ ${BRAND.currency} a correct pick · paid after the final$`),
      ),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // A tap saves at once; the other name changes it; tapping the pick again clears it.
    const card = block
      .getByRole("group", { name: /, kick-off \d\d:\d\d\. Who wins\?$/ })
      .filter({ has: page.getByRole("button", { disabled: false }) })
      .first();
    const [first, second] = [card.getByRole("button").nth(0), card.getByRole("button").nth(1)];
    const firstName = (await first.innerText())
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)[0];
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText(/^✓ Saved \d\d:\d\d\.$/)).toBeVisible();
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText(/^✓ Changed to .+, \d\d:\d\d\.$/)).toBeVisible();
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "false");
    await expect(card.getByText(/^Pick cleared\./)).toBeVisible();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expectNoHorizontalOverflow(page);

    // Saved for real: a reload shows the pick.
    await page.reload();
    const saved = page
      .getByRole("list", { name: "Calls" })
      .getByRole("button", { name: new RegExp(`^${firstName}`) })
      .first();
    await expect(saved).toHaveAttribute("aria-pressed", "true");

    // The bracket shows the call and never takes one.
    await page.goto(`/midweek/${weekStart}/bracket`);
    await expect(
      page.getByText(`Your call: ${firstName}`).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^${firstName}`) })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/midweek/${weekStart}/calls`);
    await expect(page.getByRole("list", { name: "Calls" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto(`/midweek/${weekStart}/bracket`);
    await expect(
      page.getByText(`Your call: ${firstName}`).filter({ visible: true }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Kick-off: the call closes and the club's split shows (counts only).
    await withDatabase((database) => advanceFixtureEvening(database, 2));
    await page.goto(`/midweek/${weekStart}/calls`);
    await expect(page.getByText(`Closed at kick-off. You picked ${firstName}.`)).toBeVisible();
    await expect(
      page.getByRole("img", { name: /^\d+ picked .+, \d+ picked .+$/ }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // After the final the week is paid: the weekly line, and the calls kept on the bracket.
    await withDatabase((database) => advanceFixtureEvening(database, 120, { runWorker: true }));
    await page.goto("/midweek");
    await expect(page.getByText(/ for wins, \d+ for calls$/)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Calls [01] of 1 right$/ })).toBeVisible();
    await page.goto(`/midweek/${weekStart}/night`);
    await expect(page.getByText(/^You called [01] of 1 right/)).toBeVisible();
    await page.getByRole("link", { name: /^Your calls / }).click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${weekStart}/calls$`));
    await expect(page.getByRole("region", { name: "Your calls" })).toContainText(
      `You picked ${firstName}.`,
    );
    await expectNoHorizontalOverflow(page);

    await page.goto("/how-it-works#midweek-calls");
    await expect(page.getByRole("heading", { name: "Calls, once you’re out" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Midweek Madness pre-match (MM 3.0 S5, ADR-149)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  /** Round 1's first match (never a bye) and the round-2 pairing it feeds. */
  async function fedPairing(weekStart: string) {
    let found = { matchId: "", pairing: 0 };
    await withDatabase(async (database) => {
      const first = await database.query<{ id: string; pairing: number }>(
        `select m.id, m.pairing from kut.midweek_matches m
         join kut.midweek_tournaments t on t.id = m.tournament_id
         where t.week_start = $1 and m.round = 1 and not m.bye order by m.pairing limit 1`,
        [weekStart],
      );
      found = { matchId: first.rows[0].id, pairing: first.rows[0].pairing >> 1 };
    });
    return found;
  }

  /** Round 2 starts 15 minutes after round 1 (ADR-104): `seconds` before its kick-off. */
  const beforeRoundTwo = (seconds: number) => 15 * 60 - seconds;

  test(
    "between rounds: shown once both feeders end, absent while one plays, no win chance or day roll, live at kick-off",
    { tag: "@narrow" },
    async ({ page }) => {
      await resetMidweek("release_member");
      let weekStart = "";
      await withDatabase(async (database) => {
        ({ weekStart } = await startFixtureEvening(database));
      });
      const { matchId, pairing } = await fedPairing(weekStart);
      const url = `/midweek/${weekStart}/next/2/${pairing}`;
      await signIn(page, "release_member");
      // Compile the routes before their timing matters.
      await page.goto(url);
      await page.goto(`/midweek/${weekStart}/bracket`);

      // A minute into round 1: the pairing waits on a feeder in play.
      await withDatabase((database) => moveFixtureEveningTo(database, matchId, 60));
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1, name: "Not settled yet" })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Watch .+ v .+$/ })).toBeVisible();
      await expect(page.getByRole("region", { name: /: the five$/ })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await page.goto(`/midweek/${weekStart}/bracket`);
      await expect(page.getByRole("link", { name: /^Pre-match: Winner of / })).toHaveCount(0);

      // Round 1 has ended (8:55 at the longest) and round 2 is 90 seconds away.
      await withDatabase((database) => moveFixtureEveningTo(database, matchId, beforeRoundTwo(90)));
      for (const where of [`/midweek/${weekStart}/bracket`]) {
        await page.goto(where);
        await expect(
          // A member who is out also hears the row's call: `… kick-off 20:15. Call open`.
          page
            .getByRole("link", { name: /^Pre-match: .+ v .+, kick-off \d\d:\d\d(\. .+)?$/ })
            .first(),
          where,
        ).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
      // Still in, the hub's Now block leads to your next match's pre-match (DR5-12).
      await page.goto("/midweek");
      const next = page.getByRole("region", { name: "Your next match" });
      if ((await next.count()) > 0) {
        await expect(next.getByRole("link", { name: "Pre-match" })).toHaveAttribute(
          "href",
          /\/next\/2\/\d+$/,
        );
      }
      await page.goto(`/midweek/${weekStart}/night`);
      const night = page.getByRole("list", { name: "Your night" });
      const nextRow = night.getByRole("link", { name: /^Next: / });
      if ((await nextRow.count()) > 0) {
        await expect(nextRow).toHaveAttribute("href", /\/next\/2\/\d+$/);
      }

      const html = (await (await page.goto(url))!.text()).replace(/<!-- -->/g, "");
      await expect(page).toHaveURL(new RegExp(`${url}$`));
      // Nothing of the match before kick-off: no win chance, no day roll, no id.
      expect(html).not.toMatch(/win_?chance|day_?rolls?_?ppm|dayRoll|match_id/i);
      await expect(page.getByText(/\d%/)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, name: /^.+ v .+$/ })).toBeVisible();
      await expect(page.getByText(/ · kick-off \d\d:\d\d, /)).toBeVisible();
      await expect(page.getByRole("timer")).toBeVisible();
      const fives = page.getByRole("region", { name: /: the five$/ });
      await expect(fives).toHaveCount(2);
      for (const five of await fives.all()) {
        await expect(five.getByText(/’s five/)).toBeVisible();
        await expect(five.getByRole("definition")).toHaveCount(3);
        await expect(
          five.getByText(/ power, (strong|above ordinary|below ordinary|weak)$/),
        ).toHaveCount(5);
      }
      await expect(page.getByText(/· goes live at kick-off$/)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await expectNoHorizontalOverflow(page);

      // At kick-off the page asks for itself and becomes the live match.
      await withDatabase((database) => moveFixtureEveningTo(database, matchId, beforeRoundTwo(4)));
      await page.goto(url);
      await expect(page).toHaveURL(/\/match\/[0-9a-f-]{36}$/, { timeout: 20_000 });
      await expect(page.getByText(/ · live$/)).toBeVisible();
    },
  );

  test("a member who is out calls it on the pre-match, which closes at kick-off; a late call is refused", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    let rounds = 0;
    let out = null as OutMember | null;
    let kickoffMs = 0;
    await withDatabase(async (database) => {
      ({ weekStart, rounds } = await startFixtureEvening(database));
      out = await outMember(database, weekStart, rounds);
      if (!out) return;
      // A minute before the next round kicks off: every match before it has ended.
      await advanceFixtureEvening(database, 3 + 15 * out.round);
      const next = await database.query<{ ms: string }>(
        `select (extract(epoch from min(m.reveal_at)) * 1000)::bigint::text as ms
         from kut.midweek_matches m join kut.midweek_tournaments t on t.id = m.tournament_id
         where t.week_start = $1 and m.round = $2`,
        [weekStart, out.round + 1],
      );
      kickoffMs = Number(next.rows[0].ms);
    });
    test.skip(!out, "Nobody in the fixture goes out before the final.");
    await signIn(page, out!.login);
    // The device clock runs on as ever, so it can be paused just before kick-off.
    await page.clock.install();

    await page.goto(`/midweek/${weekStart}/calls`);
    await page
      .getByRole("list", { name: "Calls" })
      .getByRole("link", { name: "Pre-match", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/next\/\d+\/\d+$/);
    const calls = page.getByRole("list", { name: "Calls" });
    const card = calls.getByRole("group", { name: /, kick-off \d\d:\d\d\. Who wins\?$/ });
    await expect(card).toHaveCount(1);
    await expect(page.getByRole("region", { name: /: the five$/ })).toHaveCount(2);
    await expect(calls.getByRole("link", { name: "Pre-match", exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // The server passes kick-off while this page still shows the call open:
    // the trigger refuses it with its own words.
    await withDatabase((database) => advanceFixtureEvening(database, 2));
    const first = card.getByRole("button").first();
    await expect(first).toBeEnabled();
    await first.click();
    await expect(calls.getByRole("alert")).toHaveText(
      /^Couldn’t save: picks closed at kick-off, \d\d:\d\d\.$/,
    );
    await expect(first).toHaveAttribute("aria-pressed", "false");

    // On the page's own clock, the card closes at kick-off, a second before the
    // page asks for itself again.
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(Math.max(now + 100, kickoffMs - 3_000));
    for (let step = 0; step < 60 && (await first.isEnabled()); step += 1) {
      await page.clock.runFor(250);
    }
    await expect(first).toBeDisabled();
    await expect(page).toHaveURL(/\/next\/\d+\/\d+$/);
    await expect(card.getByText("Closed at kick-off. You didn’t call this one.")).toBeVisible();
    await page.clock.resume();
    await expect(page).toHaveURL(/\/match\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  });
});

test.describe("Midweek Madness ratings at full time (MM 3.0 S6, ADR-150)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  const RATED = /^rated \d+\.\d out of 10 for this match$/;

  test(
    "a match is rated at its full time, on its report and under Your night, and not before; the night waits",
    { tag: "@narrow" },
    async ({ page }) => {
      await resetMidweek("release_member");
      let weekStart = "";
      await withDatabase(async (database) => {
        ({ weekStart } = await startFixtureEvening(database));
      });
      const round1 = await roundMatches(weekStart, 1);
      const round2 = await roundMatches(weekStart, 2);
      const first = round1.matches[0];
      const mine = round1.matches.find(
        (m) => m.side_0_user_id === round1.member || m.side_1_user_id === round1.member,
      );
      let length = 0;
      await withDatabase(async (database) => {
        const row = await database.query<{ seconds: number }>(
          "select extract(epoch from ends_at - reveal_at)::int as seconds from kut.midweek_matches where id = $1",
          [first.id],
        );
        length = row.rows[0].seconds;
      });
      const report = (id: string) => `/midweek/${weekStart}/match/${id}`;
      await signIn(page, "release_member");
      // Compile the routes before their timing matters.
      await page.goto(report(first.id));
      await page.goto(`/midweek/${weekStart}/night`);

      // Twenty seconds before full time: in play, so no rating anywhere in the page.
      await withDatabase((database) => moveFixtureEveningTo(database, first.id, length - 20));
      const before = (await (await page.goto(report(first.id)))!.text()).replace(/<!-- -->/g, "");
      expect(before).not.toMatch(/out of 10 for this match|ends_at/);
      await expect(page.getByText(/ · live$/)).toBeVisible();
      await expect(page.getByText(RATED)).toHaveCount(0);

      // Round 2 is a minute in: round 1 has ended, and round 2's page is still unrated.
      await withDatabase((database) => moveFixtureEveningTo(database, round2.matches[0].id, 60));
      const playing = (await (await page.goto(report(round2.matches[0].id)))!.text()).replace(
        /<!-- -->/g,
        "",
      );
      expect(playing).not.toMatch(/out of 10 for this match/);

      for (const width of [320, 412]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(report(first.id));
        await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
        // Five cards a side, each with a disc, while the week is still running.
        await expect(page.getByText(RATED)).toHaveCount(10);
        await page.goto(`${report(first.id)}?tab=teams`);
        await expect(page.getByText("Rating, out of 10")).toBeVisible();
        await expectNoHorizontalOverflow(page);

        await page.goto(`/midweek/${weekStart}/night`);
        const block = page.getByRole("region", { name: /^Against / });
        if (mine) {
          await expect(block).toBeVisible();
          await expect(block.getByText(RATED)).toHaveCount(5);
          await expect(block.getByText(/ · out of 10$/)).toBeVisible();
          await expect(block.getByRole("link", { name: "Report", exact: true })).toHaveAttribute(
            "href",
            report(mine.id),
          );
          // The night's block, its lines and its star wait for the week to be complete.
          await expect(block.getByText("★")).toHaveCount(0);
        } else {
          await expect(block).toHaveCount(0);
        }
        await expect(page.getByRole("region", { name: "Your five’s ratings" })).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
      }
    },
  );
});

test.describe("Midweek Madness share images (F8, ADR-120)", () => {
  // One fixture Player of the champion's five gets a real local photo, so the
  // canvas draws a photo fetched from Storage; a tainted canvas couldn't export.
  test.beforeEach(async () => {
    await withDatabase(async (database) => {
      await database.query(
        "update kut.players set photo_path = $1 where display_name = 'Engine Fixture'",
        [FIXTURE_PHOTO],
      );
    });
  });
  test.afterEach(async () => {
    await withDatabase(async (database) => {
      await database.query(
        "update kut.players set photo_path = null where display_name = 'Engine Fixture'",
      );
    });
  });

  /** A PNG's width and height, from its IHDR chunk. */
  const pngSize = (bytes: Buffer) => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];

  test(
    "on a phone, both images draw at 1080 × 1350 and Share hands the PNG to the share sheet",
    { tag: "@narrow" },
    async ({ page }) => {
      await page.addInitScript(() => {
        const record = window as unknown as { __shared?: string[] };
        record.__shared = [];
        Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
        Object.defineProperty(navigator, "share", {
          value: async (data: { files: File[] }) => {
            record.__shared!.push(
              `${data.files[0].name} ${data.files[0].type} ${data.files[0].size}`,
            );
          },
          configurable: true,
        });
      });
      await signIn(page, "release_member");
      await page.goto(`/midweek/${COMPLETED_WEEK}/night`);
      const block = page.getByRole("region", { name: "Share the night" });
      await expect(block).toBeVisible();
      for (const name of ["Preview: The champion poster", "Preview: Your night"]) {
        const preview = block.getByRole("img", { name });
        await expect(preview).toBeVisible({ timeout: 15_000 });
        expect(
          await preview.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
        ).toEqual([1080, 1350]);
      }
      await expectNoHorizontalOverflow(page);

      await block.getByRole("button", { name: "Share" }).first().click();
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __shared: string[] }).__shared))
        .toEqual([expect.stringMatching(/^flut-midweek-17-jan-champion\.png image\/png \d+$/)]);

      const download = page.waitForEvent("download");
      await block.getByRole("button", { name: "Save image" }).nth(1).click();
      expect((await download).suggestedFilename()).toBe("flut-midweek-17-jan-release-member.png");
      await expect(
        block.getByText(/is in your downloads\. Drop it into the group chat\.$/),
      ).toBeVisible();
    },
  );

  test("on a desktop, Download saves the PNG", async ({ browser }) => {
    // Playwright passes the project's phone options on; a desktop has a mouse.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      hasTouch: false,
      isMobile: false,
    });
    const page = await context.newPage();
    try {
      await signIn(page, "release_member");
      await page.goto(`/midweek/${COMPLETED_WEEK}/night`);
      const block = page.getByRole("region", { name: "Share the night" });
      await expect(block.getByRole("img", { name: "Preview: The champion poster" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(block.getByRole("button", { name: "Share" })).toHaveCount(0);
      const download = page.waitForEvent("download");
      await block.getByRole("button", { name: "Download" }).first().click();
      const saved = await download;
      expect(saved.suggestedFilename()).toBe("flut-midweek-17-jan-champion.png");
      const bytes = readFileSync(await saved.path());
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(pngSize(bytes)).toEqual([1080, 1350]);
      await expect(block.getByRole("button", { name: "Downloaded" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
});

test.describe("Home and Messages (F4, ADR-114)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test(
    "Home leads with what's due: a short header, the now stack, two tiles",
    { tag: "@narrow" },
    async ({ page }) => {
      await resetMidweek("release_member");
      await signIn(page, "release_member");
      await expect(
        page.getByRole("heading", { level: 1, name: `This week in ${BRAND.shortName}` }),
      ).toBeVisible();
      const now = page.getByRole("region", { name: "Now" });
      // Home's Midweek block (DR5-16): brass, the countdown, one primary.
      await expect(now.getByRole("region", { name: "Pick your five" })).toContainText(
        /^Pick your five ?Locks in /,
      );
      await expect(now.getByRole("link", { name: "Pick your five" })).toHaveAttribute(
        "href",
        "/midweek/pick",
      );
      // The coins tile went: the coin pill shows the balance.
      await expect(page.getByText("Wallet balance")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /^Club Value .* See the maths →$/ }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /^Rank .* Standings →$/ })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Top risers" })).toBeVisible();
      await expect(page.getByRole("link", { name: "This week’s Chronicle →" })).toBeVisible();
      await expect(
        page.getByRole("link", { name: `New here? How ${BRAND.shortName} works →` }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.reload();
      await expect(now.getByRole("link", { name: /Pick your five/ })).toBeVisible();
      const tile = await page.getByRole("link", { name: /^Club Value/ }).boundingBox();
      const pack = await page.getByRole("link", { name: "Open a pack" }).boundingBox();
      // From `sm` the two tiles and the pack button share one row.
      expect(Math.abs(tile!.y - pack!.y)).toBeLessThan(2);
      await expectNoHorizontalOverflow(page);
    },
  );

  test("during the evening the live card leads Home, as it stood at page load", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    await withDatabase(async (database) => {
      await startFixtureEvening(database);
    });
    await signIn(page, "release_member");
    const now = page.getByRole("region", { name: "Now" });
    const live = now.getByRole("region").first();
    await expect(live).toContainText("Live");
    await expect(live).toContainText("The draw is out");
    await expect(live.getByRole("link", { name: "See the draw" })).toHaveAttribute(
      "href",
      "/midweek",
    );
    await expectNoHorizontalOverflow(page);

    await withDatabase(async (database) => {
      // Round 2 kicked off a minute ago: release_member's round-1 match (or bye) is played.
      await advanceFixtureEvening(database, 20);
    });
    await page.reload();
    await expect(live).toContainText("Live");
    await expect(
      live.getByRole("link", {
        name: /^(See the report|Follow the final|Follow the bracket|Watch it)$/,
      }),
    ).toHaveAttribute("href", /^\/midweek/);
    await expectNoHorizontalOverflow(page);
  });

  test("every message opens its subject and is marked read on the way", async ({ page }) => {
    const inserted: string[] = [];
    let resultId = "";
    let noticeId = "";
    await withDatabase(async (database) => {
      const member = await database.query<{ id: string }>(
        "select id from kut.profiles where username = 'release_member'",
      );
      const week = await database.query<{ id: string }>(
        "select id from kut.midweek_tournaments where week_start = $1",
        [COMPLETED_WEEK],
      );
      const userId = member.rows[0].id;
      // The completed week may already have messaged its result: reuse it, unread.
      const result = await database.query<{ id: string }>(
        `insert into kut.user_notifications(user_id, event_type, title, body, reference_type, reference_id)
         values ($1, 'midweek_result', 'You went out in round 1', 'E2E result.', 'midweek_tournament', $2)
         on conflict (user_id, event_type, reference_type, reference_id)
           where reference_type is not null and reference_id is not null do nothing
         returning id`,
        [userId, week.rows[0].id],
      );
      if (result.rows[0]) inserted.push(result.rows[0].id);
      resultId = (
        await database.query<{ id: string }>(
          `update kut.user_notifications set read_at = null
           where user_id = $1 and event_type = 'midweek_result' and reference_id = $2 returning id`,
          [userId, week.rows[0].id],
        )
      ).rows[0].id;
      noticeId = (
        await database.query<{ id: string }>(
          `insert into kut.user_notifications(user_id, event_type, title, body)
           values ($1, 'admin_notice', 'E2E club notice', 'Nothing to open.') returning id`,
          [userId],
        )
      ).rows[0].id;
      inserted.push(noticeId);
    });
    try {
      await signIn(page, "release_member");
      await page.goto("/messages");
      await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
      await expect(page.getByText(/^\d+ new · opening one marks it read$/)).toBeVisible();
      const today = page.getByRole("region", { name: "Today" });
      const result = today.locator(`a[href="/messages/${resultId}/open"]`);
      await expect(result).toContainText("New");
      await expect(result).toContainText("Bracket →");
      // A club notice has nowhere to go: no arrow, and opening it only marks it read.
      const notice = today.locator(`a[href="/messages/${noticeId}/open"]`);
      await expect(notice).toContainText("New");
      await expect(notice).not.toContainText("→");
      await expectNoHorizontalOverflow(page);

      await result.click();
      await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}$`));
      await page.goto("/messages");
      await expect(result).not.toContainText("New");
      await expect(result).toContainText("Bracket →");

      await notice.click();
      await expect(page).toHaveURL(/\/messages$/);
      // Read and without a subject, it is no link at all.
      await expect(notice).toHaveCount(0);
      await expect(page.getByText("E2E club notice")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await withDatabase(async (database) => {
        await database.query("delete from kut.user_notifications where id = any($1::uuid[])", [
          inserted,
        ]);
      });
    }
  });
});

test("how-it-works shows the plusses table and the weakest-line rule (ADR-116)", async ({
  page,
}) => {
  await signIn(page, "release_member");
  await page.goto("/how-it-works#midweek");
  await expect(page.getByRole("heading", { name: "Your squad’s shape" })).toBeVisible();
  const plusses = page.getByRole("table").filter({ hasText: "Midfield" });
  await expect(plusses.getByRole("row")).toHaveCount(8);
  await expect(plusses.getByRole("row", { name: /^Tank/ })).toBeVisible();
  await expect(page.getByText("Every line needs at least 3 plusses.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("admin can reach the Midweek controls", async ({ page }) => {
  await signIn(page, "release_admin");
  await page.goto("/admin/midweek");
  await expect(page.getByRole("heading", { name: "Midweek Madness", level: 1 })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Running|Paused/ })).toBeVisible();
  // The rehearsal writes nothing, so it is safe to run against the fixture.
  await page.getByRole("button", { name: "Run a rehearsal" }).click();
  await expect(page.getByText(/Last run /)).toBeVisible({ timeout: 15_000 });
  await expectNoHorizontalOverflow(page);
  await page.goto("/admin/midweek?void=1");
  await expect(page.getByRole("heading", { name: /^Void / })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test(
  "admin can reach the mobile attendance finalization surface",
  { tag: "@narrow" },
  async ({ page }) => {
    await signIn(page, "release_admin");
    await page.goto("/admin/attendance");
    await expect(page.getByRole("heading", { name: "Record attendance" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  },
);

// Last in this file and run once on the narrow Chromium project. It spends
// 250 coins and adds cards; finally removes those cards so the later WebKit
// project keeps the same picker inventory.
test(
  "a pack's summary names the slots it fills and the copies it adds (ADR-114)",
  { tag: "@narrow" },
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "authenticated-320", "runs once on narrow Chromium");
    await signIn(page, "release_member");
    await page.goto("/club/packs");
    try {
      await page
        .getByRole("button", { name: new RegExp(`^Open for \\d+ ${BRAND.currency}$`) })
        .click();
      await page.getByRole("button", { name: /^Pay \d+$/ }).click();
      // The first opening on a dev server compiles the reveal page.
      await expect(page).toHaveURL(/\/club\/packs\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      await page.getByRole("button", { name: "Skip all" }).click();
      await expect(page.getByRole("heading", { name: "Your new Live Cards" })).toBeVisible();
      await expect(
        page.getByText(/^(No new Players|\d+ new Players?)\. Album \d+ \/ \d+\.$/),
      ).toBeVisible();
      await expect(
        page.getByText(/^(New · fills slot \d+|×\d+ · discards for \d+)$/).first(),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      // An opening restricts deleting its member, and a card it drew of a
      // fixture Player restricts deleting the fixture: the teardown needs both gone.
      // The member is recreated every run, so its openings are this test's, also
      // when the reveal page never loaded.
      await withDatabase(async (database) => {
        const openings = `select o.id from kut.pack_openings o join auth.users u on u.id = o.user_id
        where u.email = 'release_member@users.kut.local'`;
        const cards = await database.query<{ card_id: string }>(
          `delete from kut.pack_opening_cards where opening_id in (${openings}) returning card_id`,
        );
        await database.query(`delete from kut.pack_openings where id in (${openings})`);
        await database.query("delete from kut.user_cards where id = any($1::uuid[])", [
          cards.rows.map((row) => row.card_id),
        ]);
      });
    }
  },
);
