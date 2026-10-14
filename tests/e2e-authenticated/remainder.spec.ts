import { test, expect } from "@playwright/test";

test("remaining pages use the phone layout and all-width player filters @narrow", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("release_member");
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  const overflow = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1,
    );
  };
  await page.goto("/leaderboard");
  await expect(page.locator("main h1")).toHaveText("Standings");
  await expect(page.getByText("You", { exact: true })).toBeVisible();
  await expect(page.locator("main").getByText("Cards", { exact: true })).toBeHidden();
  await expect(page.locator("main").getByText(/\d+ cards · \d+ players/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "See the maths" })).toHaveAttribute(
    "href",
    "/club/value",
  );
  await overflow();

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/players");
    await expect(page.locator("main h1")).toHaveText("Players");
    await page.getByRole("searchbox", { name: "Search Players" }).fill("Keeper Fixture");
    await page.getByRole("searchbox", { name: "Search Players" }).press("Enter");
    await expect(page).toHaveURL(/q=Keeper/);
    await page.getByRole("button", { name: /^Filter/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filter", exact: true });
    await sheet.getByRole("radio", { name: "Name", exact: true }).locator("..").click();
    await sheet.getByRole("button", { name: "Show Players" }).click();
    await expect(page).toHaveURL(/sort=name/);
    await expect(page).toHaveURL(/q=Keeper/);
    await overflow();
    await page.getByRole("button", { name: /^Filter/ }).click();
    await sheet.getByRole("radio", { name: "Gold", exact: true }).locator("..").click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Filter/ })).toBeFocused();
    await expect(page).not.toHaveURL(/rarity=gold/);
    await page.getByRole("button", { name: /^Filter/ }).click();
    await expect(sheet.getByRole("radio", { name: "All tiers", exact: true })).toBeChecked();
    await sheet.getByRole("button", { name: "Clear", exact: true }).click();
    await sheet.getByRole("button", { name: "Show Players" }).click();
    await expect(page).toHaveURL(/\/players$/);
  }

  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/players");
  await page.locator('main a[href^="/players/"]').first().click();
  await expect(page.getByRole("region", { name: "Attributes", exact: true })).toBeVisible();
  await overflow();
  for (const [route, title] of [
    ["/club/value", "Club Value"],
    ["/settings/card", "My card"],
    ["/chronicle", "FLUT Chronicle"],
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toHaveText(title);
    await overflow();
  }
  const latest = page.getByRole("link", { name: "Read the issue", exact: true });
  if (await latest.count()) {
    await latest.click();
    await expect(page.locator("main h1")).toHaveText(/^Week of /);
    await expect(page.getByRole("link", { name: "All issues", exact: true })).toBeVisible();
    await overflow();
  }
  await page.goto("/settings");
  await expect(page.getByText("Signed in as Release Member · release_member")).toBeVisible();
  const clubName = page.getByLabel("Club name", { exact: true });
  const oldName = await clubName.inputValue();
  try {
    await clubName.fill("S10 Test Club");
    await page.getByRole("button", { name: "Save club name" }).click();
    await expect(page.getByText("Club name saved.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(clubName).toHaveValue("S10 Test Club");
    await expect(page.getByRole("switch", { name: "Midweek Madness" })).toBeVisible();
    await expect(page.getByText("The rest of your collection is never shown.")).toBeVisible();
    await overflow();
  } finally {
    await clubName.fill(oldName);
    await page.getByRole("button", { name: "Save club name" }).click();
    await expect(page.getByText(/^Club name (saved|reset to the default)\.$/)).toBeVisible();
  }
});
