import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";

async function database<T>(work: (db: Client) => Promise<T>) {
  const url = process.env.DB_URL;
  if (!url) throw new Error("DB_URL required");
  assertLocalTarget(url, "DB_URL");
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    return await work(db);
  } finally {
    await db.end();
  }
}
async function signIn(page: Page, username = "release_admin") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}
async function settings() {
  return database(
    async (db) =>
      (await db.query("select slug,price::int,is_active from kut.pack_definitions order by slug"))
        .rows,
  );
}
async function revision() {
  return database(async (db) =>
    Number(
      (
        await db.query(
          "select coalesce(max(revision),0) as revision from kut.pack_settings_changes",
        )
      ).rows[0].revision,
    ),
  );
}

test("admin economy drafts, overrides, audit and conflicting editors @narrow", async ({
  page,
  context,
}) => {
  const before = await settings();
  const initialRevision = await revision();
  try {
    await signIn(page);
    await page.goto("/admin/economy");
    await expect(page.getByRole("heading", { name: "Economy", exact: true })).toBeVisible();
    await expect(page.getByText(/^Measured/)).toContainText("UTC");
    await expect(page.getByRole("switch")).toHaveCount(2);
    await expect(page.getByText("Always on", { exact: true })).toBeVisible();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
      await page.screenshot({
        path: `.release-evidence/issue-223/admin-${width}.png`,
        fullPage: true,
        caret: "initial",
      });
    }
    const sql = await database(async (db) => {
      await db.query("begin");
      try {
        await db.query(
          "select set_config('request.jwt.claim.sub',(select id::text from kut.profiles where username='release_admin'),true)",
        );
        await db.query("set local role authenticated");
        return (await db.query("select * from kut.pack_price_suggestions()")).rows;
      } finally {
        await db.query("rollback");
      }
    });
    for (const suggestion of sql)
      if (suggestion.suggested_price !== null)
        await expect(
          page.getByText(
            `Suggested ${Number(suggestion.suggested_price).toLocaleString("en-GB")}`,
            { exact: true },
          ),
        ).toBeVisible();
    await page.getByRole("spinbutton", { name: "Regular price", exact: true }).fill("500");
    const silverHelp = page
      .getByRole("spinbutton", { name: "Silver price", exact: true })
      .locator("..")
      .getByText(/^Suggested/);
    const suggested = await silverHelp.textContent();
    expect(suggested).not.toBe(
      `Suggested ${Number(sql.find((row) => row.slug === "tfh-silver-pack").suggested_price).toLocaleString("en-GB")}`,
    );
    const valueBefore = await page
      .getByRole("table", { name: "Pack value at draft prices" })
      .textContent();
    await page.getByRole("button", { name: "Use suggested prices" }).click();
    await expect(page.getByRole("spinbutton", { name: "Silver price", exact: true })).toHaveValue(
      suggested!.replace("Suggested ", "").replaceAll(",", ""),
    );
    expect(await settings()).toEqual(before);
    expect(await revision()).toBe(initialRevision);
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: "Regular price", exact: true })).toHaveValue(
      String(before.find((row) => row.slug === "tfh-pack").price),
    );
    await expect(page.getByRole("table", { name: "Pack value at draft prices" })).not.toHaveText(
      valueBefore!,
    );
    await page.getByRole("spinbutton", { name: "Silver price", exact: true }).fill("0");
    await expect(page.getByRole("button", { name: "Apply changes" })).toBeDisabled();
    await page.getByRole("spinbutton", { name: "Silver price", exact: true }).fill("1.5");
    await expect(page.getByRole("button", { name: "Apply changes" })).toBeDisabled();
    await page.getByRole("spinbutton", { name: "Silver price", exact: true }).fill("1");
    await expect(page.getByText(/no net coins removed/)).toBeVisible();
    await expect(page.getByText(/beats Regular per coin/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply changes" })).toBeEnabled();
    const switcher = page.getByRole("switch", { name: "Silver pack on sale" });
    const wasActive = await switcher.getAttribute("aria-checked");
    await switcher.focus();
    await page.keyboard.press("Space");
    await expect(switcher).toHaveAttribute("aria-checked", String(wasActive !== "true"));
    await page.keyboard.press("Space");
    if (wasActive !== "true") await switcher.click();
    // Second editor retains the older revision while the first saves.
    const other = await context.newPage();
    await other.goto("/admin/economy");
    await other.getByRole("spinbutton", { name: "Gold price", exact: true }).fill("777");
    await page.getByRole("button", { name: "Apply changes" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Pack settings applied." }),
    ).toBeVisible();
    expect(await revision()).toBe(initialRevision + 1);
    const saved = await settings();
    expect(saved.find((row) => row.slug === "tfh-silver-pack")).toMatchObject({
      price: 1,
      is_active: true,
    });
    const audited = await database(
      async (db) =>
        (
          await db.query("select after from kut.pack_settings_changes where revision=$1", [
            initialRevision + 1,
          ])
        ).rows[0].after,
    );
    expect(audited["tfh-silver-pack"]).toEqual({ price: 1, is_active: true });
    await other.getByRole("button", { name: "Apply changes" }).click();
    await expect(
      other.getByRole("alert").filter({ hasText: "Another admin applied changes" }),
    ).toContainText("Another admin applied changes");
    await expect(other.getByRole("spinbutton", { name: "Silver price", exact: true })).toHaveValue(
      "1",
    );
    expect(await settings()).toEqual(saved);
    expect(await revision()).toBe(initialRevision + 1);
    await other.close();
    await page.reload();
    await expect(page.getByRole("spinbutton", { name: "Silver price", exact: true })).toHaveValue(
      "1",
    );
    await expect(page.getByText(/Revision.*Release Admin/)).toBeVisible();
    await page.getByRole("spinbutton", { name: "Gold price", exact: true }).fill("777");
    await page.getByRole("button", { name: "Apply changes" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: "Pack settings applied." }),
    ).toBeVisible();
    expect(await revision()).toBe(initialRevision + 2);
  } finally {
    await database(async (db) => {
      await db.query("begin");
      try {
        for (const row of before)
          await db.query("update kut.pack_definitions set price=$2,is_active=$3 where slug=$1", [
            row.slug,
            row.price,
            row.is_active,
          ]);
        await db.query(
          "delete from kut.pack_settings_changes where revision > $1 and changed_by = (select id from kut.profiles where username = 'release_admin')",
          [initialRevision],
        );
        await db.query("commit");
      } catch (error) {
        await db.query("rollback");
        throw error;
      }
    });
  }
});

test("member cannot reach economy controls", async ({ page }) => {
  await signIn(page, "release_member");
  await page.goto("/admin/economy");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Apply changes" })).toHaveCount(0);
});
