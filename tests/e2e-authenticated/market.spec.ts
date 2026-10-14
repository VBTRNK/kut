import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";

test(
  "Market filters, Selling, buy and offer controls (DR5-20)",
  { tag: "@narrow" },
  async ({ page }) => {
    test.setTimeout(120_000);
    const url = process.env.DB_URL;
    if (!url) throw new Error("Authenticated E2E requires DB_URL.");
    assertLocalTarget(url, "DB_URL");
    const db = new Client({ connectionString: url });
    await db.connect();
    const cards = Array.from({ length: 4 }, () => randomUUID());
    const listings = Array.from({ length: 3 }, () => randomUUID());
    const balances = await db.query(
      "select w.user_id, w.balance from kut.wallets w join kut.profiles p on p.id = w.user_id where p.username in ('release_member', 'release_admin')",
    );
    const users = await db.query(
      "select id, username from kut.profiles where username in ('release_member', 'release_admin')",
    );
    const member = users.rows.find((row) => row.username === "release_member").id;
    const admin = users.rows.find((row) => row.username === "release_admin").id;
    async function noOverflow() {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        page.viewportSize()!.width + 1,
      );
    }
    async function propose(user: string, listing: string) {
      await db.query("begin");
      try {
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
        await db.query("select kut.propose_trade($1, 10, '{}'::uuid[], $2)", [
          listing,
          randomUUID(),
        ]);
        await db.query("commit");
      } catch (error) {
        await db.query("rollback");
        throw error;
      }
    }
    try {
      // Standalone runs need the same missing-rating seed as the Collection check.
      await db.query(`insert into kut.player_season_state
        (player_id, season_id, activity_score, form_score, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier)
        select p.id, s.id, 0, 0, 30, 30, 30, 30, 30, 30, 30, 'common'
        from kut.players p cross join kut.seasons s
        where p.id = '00000097-0000-4000-8000-000000010001' and s.is_active
        on conflict (player_id, season_id) do nothing`);
      // New copies of the fixture edition: buying/accepting never moves the picker’s cards.
      for (let i = 0; i < cards.length; i++) {
        await db.query(
          "insert into kut.user_cards(id, edition_id, owner_id, source) select $1, id, $2, 'pack' from kut.card_editions where id = '00000097-0000-4000-8000-000000020001'",
          [cards[i], i === 2 ? admin : member],
        );
      }
      for (let i = 0; i < listings.length; i++) {
        await db.query(
          "insert into kut.market_listings(id, card_id, seller_id, price, expires_at) values ($1, $2, $3, $4, now() + interval '24 hours')",
          [listings[i], cards[i], i === 2 ? admin : member, 50 + i],
        );
      }
      await propose(admin, listings[0]);
      await propose(admin, listings[1]);
      await page.goto("/login");
      await page.getByLabel("Username").fill("release_member");
      await page.getByLabel("Password").fill("fictional-release-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/market");
      await expect(page.locator("main h1")).toHaveText("Market");
      const nav = page.getByRole("navigation", { name: "Market", exact: true });
      await expect(nav.getByRole("link", { name: "Buy", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await page.getByRole("searchbox", { name: "Search Players" }).fill("Keeper Fixture");
      await page.getByRole("searchbox", { name: "Search Players" }).press("Enter");
      await expect(page).toHaveURL(/q=Keeper/);
      await page.getByRole("button", { name: /^Filter/ }).click();
      const sheet = page.getByRole("dialog", { name: "Filter" });
      await sheet.getByLabel("Min", { exact: true }).fill("52");
      await sheet.getByLabel("Max", { exact: true }).fill("52");
      await sheet.getByRole("radio", { name: "Price", exact: true }).locator("..").click();
      await sheet.getByRole("button", { name: "Show listings" }).click();
      await expect(page).toHaveURL(/min=52/);
      await expect(page).toHaveURL(/max=52/);
      await expect(page).toHaveURL(/sort=price/);
      await expect(
        page
          .locator("main article")
          .filter({ has: page.getByRole("link", { name: /open this listing/ }) }),
      ).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Buy for 52 FLUT Coins" })).toBeVisible();
      await noOverflow();
      await page.getByRole("button", { name: /^Filter/ }).click();
      await sheet.getByLabel("Min", { exact: true }).fill("999");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: /^Filter/ })).toBeFocused();
      await page.getByRole("button", { name: /^Filter/ }).click();
      await expect(sheet.getByLabel("Min", { exact: true })).toHaveValue("52");
      await sheet.getByRole("button", { name: "Clear", exact: true }).click();
      await sheet.getByRole("button", { name: "Show listings" }).click();
      await expect(page).toHaveURL(/\/market$/);

      await nav.getByRole("link", { name: "Selling" }).click();
      await expect(page).toHaveURL(/\/market\/selling$/);
      await expect(nav.getByRole("link", { name: "Selling" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      const selling = page.getByRole("region", { name: "Your listings" });
      await expect(selling).toContainText("2 active");
      await expect(selling.getByRole("listitem")).toHaveCount(2);
      await expect(selling.getByText(/h left · 1 offer$/)).toHaveCount(2);
      await expect(selling.getByRole("link", { name: /52 coins/ })).toHaveCount(0);
      await noOverflow();
      await selling.locator(`a[href="/market/${listings[0]}"]`).click();
      await expect(page.getByRole("region", { name: "Buy now" })).toContainText(
        "This is your listing.",
      );
      await expect(page.getByRole("link", { name: "View your card" })).toHaveAttribute(
        "href",
        `/club/collection/${cards[0]}`,
      );
      await expect(page.getByRole("button", { name: /^Buy for/ })).toHaveCount(0);

      await page.goto(`/market/${listings[2]}`);
      await expect(page.getByRole("region", { name: "Or make an offer" })).toBeVisible();
      const coinInput = page.getByLabel("Coins", { exact: true });
      await coinInput.fill("0");
      await expect(page.getByRole("button", { name: "Send offer" })).toBeDisabled();
      // Listed copies stay in ownership counts, but cannot be added to an offer.
      const eligible = await db.query(
        `select count(*)::int from kut.user_cards c where c.owner_id = $1 and c.burned_at is null and c.held_by_offer_id is null
        and not exists(select 1 from kut.market_listings l where l.card_id = c.id and l.status = 'active' and l.expires_at > now())`,
        [member],
      );
      await expect(page.getByRole("checkbox")).toHaveCount(eligible.rows[0].count);
      await page.getByRole("checkbox").last().check();
      await expect(page.getByRole("button", { name: "Send offer" })).toBeEnabled();
      await page.getByRole("checkbox").last().uncheck();
      await coinInput.fill("10");
      await noOverflow();
      await page.getByRole("button", { name: "Send offer" }).click();
      await expect(page).toHaveURL(/offers\?sent=1/);
      await expect(
        page.getByRole("heading", { name: "On your listings", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "You sent", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(2);
      await expect(page.locator("main button.bg-brass")).toHaveCount(1);
      await noOverflow();
      await page.getByRole("button", { name: "Withdraw", exact: true }).click();
      await expect(page).toHaveURL(/withdrawn=1/);
      await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Decline", exact: true }).first().click();
      await expect(page).toHaveURL(/declined=1/);
      await expect(page.getByText("Declined", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      await expect(page).toHaveURL(/accepted=1/);
      await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);

      await page.goto(`/market/${listings[2]}`);
      await page.getByRole("button", { name: "Buy for 52 FLUT Coins" }).click();
      await expect(page).toHaveURL(/collection\?purchase=52/);
      expect(
        (await db.query("select owner_id from kut.user_cards where id = $1", [cards[2]])).rows[0]
          .owner_id,
      ).toBe(member);
      await page.goto("/market/selling");
      await expect(selling).toContainText("1 active");
      await db.query(
        "update kut.market_listings set listed_at = now() - interval '25 hours', expires_at = now() - interval '1 hour' where id = any($1::uuid[]) and status = 'active'",
        [listings],
      );
      await page.reload();
      await expect(selling).toContainText("You have no active listings.");
      await expect(selling).toContainText("0 active");
      await noOverflow();
    } finally {
      const offers = await db.query(
        "select id from kut.trade_offers where listing_id = any($1::uuid[])",
        [listings],
      );
      const sales = await db.query(
        "select id from kut.market_sales where listing_id = any($1::uuid[])",
        [listings],
      );
      const refs = [
        ...listings,
        ...offers.rows.map((row) => row.id),
        ...sales.rows.map((row) => row.id),
      ];
      await db.query("delete from kut.user_notifications where reference_id = any($1::uuid[])", [
        refs,
      ]);
      await db.query("delete from kut.wallet_ledger where reference_id = any($1::uuid[])", [refs]);
      await db.query("delete from kut.trade_offer_cards where offer_id = any($1::uuid[])", [
        offers.rows.map((row) => row.id),
      ]);
      await db.query("delete from kut.trade_offers where listing_id = any($1::uuid[])", [listings]);
      await db.query("delete from kut.market_sales where listing_id = any($1::uuid[])", [listings]);
      await db.query("delete from kut.market_listings where id = any($1::uuid[])", [listings]);
      await db.query("delete from kut.user_cards where id = any($1::uuid[])", [cards]);
      for (const row of balances.rows)
        await db.query("update kut.wallets set balance = $1 where user_id = $2", [
          row.balance,
          row.user_id,
        ]);
      await db.end();
    }
  },
);
