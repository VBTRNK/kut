import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";

// Pack tiers in the real shop and opening (#223 S2, design/pack-tiers/BRIEF.md).
// The fixtures switch Silver and Gold on and set the member's wallet directly
// on the local stack; every test puts the definitions, the wallet and its
// openings back, so the rest of the suite still sees the launch shop.

const MEMBER = "release_member";
const EMAIL = "release_member@users.kut.local";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(MEMBER);
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

async function withDatabase<T>(work: (database: Client) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DB_URL;
  if (!databaseUrl) throw new Error("Authenticated E2E requires DB_URL.");
  assertLocalTarget(databaseUrl, "DB_URL");
  const database = new Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    return await work(database);
  } finally {
    await database.end();
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const width = page.viewportSize()?.width ?? 0;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, page.url()).toBeLessThanOrEqual(width + 1);
}

type Definition = { slug: string; price: number; is_active: boolean };

/** Switch packs on/off and set the wallet; returns a restore for `finally`. */
async function stage(
  active: { silver: boolean; gold: boolean },
  balance: number,
): Promise<() => Promise<void>> {
  const before = await withDatabase(async (database) => {
    const definitions = await database.query<Definition>(
      "select slug, price, is_active from kut.pack_definitions",
    );
    await database.query(
      `update kut.pack_definitions set is_active = case slug
         when 'tfh-silver-pack' then $1 when 'tfh-gold-pack' then $2 else is_active end`,
      [active.silver, active.gold],
    );
    await setBalance(database, balance);
    return definitions.rows;
  });
  return () =>
    withDatabase(async (database) => {
      for (const definition of before) {
        await database.query(
          "update kut.pack_definitions set price = $2, is_active = $3 where slug = $1",
          [definition.slug, definition.price, definition.is_active],
        );
      }
      await deleteOpenings(database);
      // The fixture wallet the global setup grants.
      await setBalance(database, 500);
    });
}

async function setBalance(database: Client, balance: number) {
  await database.query(
    `update kut.wallets set balance = $2
     where user_id = (select id from auth.users where email = $1)`,
    [EMAIL, balance],
  );
}

async function balanceNow(): Promise<number> {
  return withDatabase(async (database) => {
    const { rows } = await database.query<{ balance: string }>(
      `select w.balance from kut.wallets w join auth.users u on u.id = w.user_id where u.email = $1`,
      [EMAIL],
    );
    return Number(rows[0].balance);
  });
}

async function openings(): Promise<
  { id: string; pack_slug: string; price_paid: number; best: number }[]
> {
  return withDatabase(async (database) => {
    const { rows } = await database.query(
      `select o.id, o.pack_slug, o.price_paid::int as price_paid,
              max(kut.pack_tier_rank(c.opened_tier)) as best
       from kut.pack_openings o
       join auth.users u on u.id = o.user_id
       join kut.pack_opening_cards c on c.opening_id = o.id
       where u.email = $1 group by o.id order by o.created_at`,
      [EMAIL],
    );
    return rows;
  });
}

/** As in mobile.spec: an opening and its cards restrict deleting the fixtures. */
async function deleteOpenings(database: Client) {
  const ids = `select o.id from kut.pack_openings o join auth.users u on u.id = o.user_id
    where u.email = '${EMAIL}'`;
  const cards = await database.query<{ card_id: string }>(
    `delete from kut.pack_opening_cards where opening_id in (${ids}) returning card_id`,
  );
  await database.query(`delete from kut.pack_openings where id in (${ids})`);
  await database.query("delete from kut.user_cards where id = any($1::uuid[])", [
    cards.rows.map((row) => row.card_id),
  ]);
}

async function summaryCards(page: Page): Promise<string[]> {
  return page.locator("main .pack-reveal__summary-card").allInnerTexts();
}

test(
  "the shop shows each pack's art, promise and price at every width",
  { tag: "@narrow" },
  async ({ page }) => {
    const restore = await stage({ silver: true, gold: false }, 420);
    try {
      await signIn(page);
      await page.goto("/club/packs");
      const regular = page.locator("[data-offer=regular]");
      const silver = page.locator("[data-offer=silver]");
      await expect(page.locator("[data-offer]")).toHaveCount(2);
      await expect(regular.getByRole("heading", { name: "Regular pack" })).toBeVisible();
      await expect(regular).toContainText("No minimum tier");
      await expect(regular.getByRole("button", { name: "Open for 250 coins" })).toBeEnabled();
      await expect(regular).toContainText("Leaves you 170.");
      await expect(silver).toContainText("At least 1 Silver+");
      // Not affordable: a saving goal, not a hidden offer.
      await expect(silver.getByRole("button", { name: "Need 80 more coins" })).toBeDisabled();
      await expect(silver).toContainText("Earn coins by attending published sessions.");
      // Gold is off, so it is not on sale.
      await expect(page.locator("[data-offer=gold]")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);

      await withDatabase((database) =>
        database.query("update kut.pack_definitions set is_active = true where slug = $1", [
          "tfh-gold-pack",
        ]),
      );
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.reload();
        await expect(page.locator("[data-offer]")).toHaveCount(3);
        await expect(page.locator("[data-offer=gold]")).toContainText("At least 1 Gold+");
        await expectNoHorizontalOverflow(page);
      }
      // From `sm` the offers stand side by side on one shelf.
      const tops = await page
        .locator("[data-offer]")
        .evaluateAll((offers) => offers.map((offer) => offer.getBoundingClientRect().top));
      expect(new Set(tops).size).toBe(1);
    } finally {
      await restore();
    }
  },
);

test("a Silver opening: sealed pack, keyboard, auto steps, skip, receipt, reload and replay", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "authenticated-pixel7", "pays once, on one project");
  const restore = await stage({ silver: true, gold: false }, 1250);
  try {
    await signIn(page);
    await page.goto("/club/packs");
    const open = page.locator("[data-offer=silver]").getByRole("button", {
      name: "Open for 500 coins",
    });
    await open.click();
    const confirm = page.getByRole("dialog", { name: "Open a Silver pack?" });
    await expect(confirm).toContainText(
      "500 coins for 3 Live Cards, at least 1 Silver+. You keep 750.",
    );
    await confirm.getByRole("button", { name: "Pay 500" }).focus();
    await page.keyboard.press("Tab");
    await expect(confirm.getByRole("button", { name: "Not now" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirm).toBeHidden();
    await expect(open).toBeFocused();
    expect(await balanceNow()).toBe(1250);

    await open.click();
    await confirm.getByRole("button", { name: "Pay 500" }).click();
    await expect(page).toHaveURL(/\/club\/packs\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const url = page.url();
    expect(await balanceNow()).toBe(750);
    const [opening] = await openings();
    expect(opening).toMatchObject({ pack_slug: "tfh-silver-pack", price_paid: 500 });
    // The guarantee held: at least one card was Silver+ when opened.
    expect(Number(opening.best)).toBeGreaterThanOrEqual(2);

    const status = page.getByRole("main").getByRole("status");
    const stageButton = page.getByRole("button", { name: "Open the Silver pack" });
    await expect(status).toHaveText("Silver pack");
    await expect(stageButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(status).toHaveText("Opening the Silver pack");
    // Tier and rating advance by themselves; the card then waits for a tap.
    await expect(status).toContainText("Card 1 of 3", { timeout: 10_000 });
    const next = page.getByRole("button", { name: "Next card" });
    await expect(next).toBeFocused({ timeout: 10_000 });
    await page.waitForTimeout(2_500);
    await expect(status).toContainText("Card 1 of 3");
    await page.keyboard.press(" ");
    await expect(status).toContainText("Card 2 of 3");
    // A tap during the tier or rating shows the card at once.
    await page.keyboard.press("Enter");
    await expect(next).toBeFocused();
    await expect(status).toContainText("Card 2 of 3");
    await page.getByRole("button", { name: "Skip all" }).click();

    const summary = page.locator("main .pack-reveal").first();
    await expect(page.getByRole("heading", { name: "Your new Live Cards" })).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(
      page.getByText(
        /^Silver pack · Paid 500 coins · (No new Players|\d+ new Players?)\. Album \d+ \/ \d+\.$/,
      ),
    ).toBeVisible();
    // Fresh from the pack, no card has moved tier.
    await expect(page.getByText(/when opened$/)).toHaveCount(0);
    const cards = await summaryCards(page);
    expect(cards).toHaveLength(3);
    await expectNoHorizontalOverflow(page);

    // Reload and replay show the same stored cards, with no request to pay.
    const paid: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") paid.push(request.url());
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "Open the Silver pack" })).toBeFocused();
    await page.getByRole("button", { name: "Skip all" }).click();
    expect(await summaryCards(page)).toEqual(cards);
    await page.getByRole("button", { name: "Replay opening" }).click();
    await expect(page.getByRole("button", { name: "Open the Silver pack" })).toBeVisible();
    await page.getByRole("button", { name: "Skip all" }).click();
    expect(await summaryCards(page)).toEqual(cards);
    expect(paid).toEqual([]);
    expect(await openings()).toHaveLength(1);
    expect(await balanceNow()).toBe(750);

    // Reduced motion opens at the summary, and replay stays there.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Your new Live Cards" })).toBeVisible();
    await page.getByRole("button", { name: "Replay opening" }).click();
    await expect(page.getByRole("heading", { name: "Your new Live Cards" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open the Silver pack" })).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    // A receipt keeps what it was: a card whose tier has moved since says so,
    // and an opening from before pack tiers shows its stored name and price only.
    await withDatabase(async (database) => {
      // No card is both Elite and Common now, so at least one of these moved.
      await database.query(
        `update kut.pack_opening_cards
         set opened_tier = case slot when 1 then 'elite' else 'common' end,
             opened_ovr = case slot when 1 then 85 else 20 end
         where opening_id = $1 and slot in (1, 2)`,
        [opening.id],
      );
    });
    await page.reload();
    await page.getByRole("button", { name: "Skip all" }).click();
    const notes = await page.getByText(/^(Elite 85|Common 20) when opened$/).count();
    expect(notes).toBeGreaterThanOrEqual(1);
    await withDatabase((database) =>
      Promise.all([
        database.query(
          "update kut.pack_openings set pack_title = 'TFH Pack', pack_slug = 'tfh-pack', min_tier = null where id = $1",
          [opening.id],
        ),
        database.query(
          "update kut.pack_opening_cards set opened_tier = null, opened_ovr = null where opening_id = $1",
          [opening.id],
        ),
      ]),
    );
    await page.reload();
    await expect(page.getByRole("button", { name: "Open the TFH Pack" })).toBeVisible();
    await page.getByRole("button", { name: "Skip all" }).click();
    await expect(page.getByText(/^TFH Pack · Paid 500 coins · /)).toBeVisible();
    await expect(page.getByText(/when opened$/)).toHaveCount(0);
  } finally {
    await restore();
  }
});

test("a changed price asks again, and a double tap on Pay opens one pack", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "authenticated-pixel7", "pays once, on one project");
  const restore = await stage({ silver: false, gold: false }, 1000);
  try {
    await signIn(page);
    await page.goto("/club/packs");
    await withDatabase((database) =>
      database.query("update kut.pack_definitions set price = 275 where slug = 'tfh-pack'"),
    );
    await page.getByRole("button", { name: "Open for 250 coins" }).click();
    const confirm = page.getByRole("dialog", { name: "Open a Regular pack?" });
    await confirm.getByRole("button", { name: "Pay 250" }).click();
    // Nothing is charged at the old quote; the sheet asks again at the new one.
    await expect(confirm.getByRole("button", { name: "Pay 275" })).toBeVisible();
    await expect(confirm).toContainText("275 coins for 3 Live Cards. You keep 725.");
    expect(await balanceNow()).toBe(1000);
    expect(await openings()).toHaveLength(0);

    await confirm.getByRole("button", { name: "Pay 275" }).dblclick();
    await expect(page).toHaveURL(/\/club\/packs\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Open the Regular pack" })).toBeVisible();
    expect(await openings()).toHaveLength(1);
    expect(await balanceNow()).toBe(725);
  } finally {
    await restore();
  }
});
