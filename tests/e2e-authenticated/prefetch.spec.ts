import { expect, test } from "@playwright/test";

// Automatic Link prefetch is production-only. CI's authenticated suite uses next start.
test("browsing cards and filters does not prefetch private routes", async ({ page }) => {
  test.skip(!process.env.CI, "Requires a production build to exercise automatic prefetch.");
  await page.goto("/login");
  await page.getByLabel("Username").fill("release_member");
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  const speculative: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      request.headers()["next-router-prefetch"] &&
      /^\/(players|club\/collection|market)(\/|$)/.test(url.pathname)
    ) {
      speculative.push(url.pathname + url.search);
    }
  });

  for (const route of ["/players", "/club/collection", "/club/collection?view=manage", "/market"]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    // Allow hydration and the prefetch scheduler to run, then bring every card into view.
    await page.waitForTimeout(1_000);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      window.scrollTo(0, 0);
    });
    if (route === "/players" || route.endsWith("view=manage") || route === "/market") {
      await page.getByRole("button", { name: /^Filters/ }).click();
      await page.getByRole("link", { name: "Gold", exact: true }).hover();
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(1_000);
  }
  expect(speculative).toEqual([]);

  await page.goto("/club/collection?view=manage");
  const card = page
    .locator('main a[href^="/club/collection/"]')
    .filter({ has: page.locator(".live-card") })
    .first();
  // The fixture owns cards. Clicking still transitions without reloading the document.
  await expect(card).toBeVisible();
  await card.hover();
  await page.waitForTimeout(500);
  expect(speculative).toEqual([]);
  const playerName = await card.locator(".live-card__plate h2").innerText();
  await page.evaluate(() => document.body.setAttribute("data-navigation-probe", "retained"));
  await card.click();
  await expect(page).toHaveURL(/\/club\/collection\/[0-9a-f-]+$/);
  await expect(page.locator("main h1")).toHaveText(playerName);
  await expect(page.locator("body")).toHaveAttribute("data-navigation-probe", "retained");
});
