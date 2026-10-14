import { test, expect } from "@playwright/test";
import { lockClock } from "../../src/lib/midweek/entry";
import { MIDWEEK } from "../../src/game/midweek/config";

test(
  "FAQ topics, help anchors and privacy copy work at every width",
  { tag: "@narrow" },
  async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("release_member");
    await page.getByLabel("Password").fill("fictional-release-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/how-it-works");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How FLUT works");
    const topics = page.getByRole("navigation", { name: "Topics" });
    await expect(topics.getByRole("link")).toHaveCount(6);
    await expect(page.locator("main h2")).toHaveText([
      "Cards and ratings",
      "Packs and discard",
      "Market and trading",
      "Club Value",
      "Midweek Madness",
      "What others see",
    ]);
    for (const width of [320, 412, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const title of await topics.locator(".truncate").all()) {
        expect(await title.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
      }
      for (const id of ["cards", "packs", "market", "value", "midweek", "privacy"]) {
        await topics.locator(`a[href="#${id}"]`).click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        await expect(page.locator(`h2[id="${id}"]`)).toBeInViewport();
        const back = page
          .getByRole("region", {
            name: await page.locator(`h2[id="${id}"]`).innerText(),
            exact: true,
          })
          .getByRole("link", { name: "Back to the topics ↑" });
        await back.click();
        await expect(page.locator("#top")).toBeInViewport();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
    }
    // Existing links and the short design anchors both remain valid.
    for (const id of [
      "archetypes",
      "form",
      "trading",
      "plusses",
      "power",
      "midweek-ratings",
      "midweek-calls",
      "ratings",
      "calls",
    ]) {
      await page.goto(`/how-it-works#${id}`);
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
      await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
    }
    await page.goto("/how-it-works#privacy");
    await expect(
      page.getByText(`From ${lockClock(MIDWEEK.schedule.current)} on the Wednesday`, {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Owner counts are shown only when at least 3 members/),
    ).toBeVisible();
    await expect(page.getByText(/Nobody ever sees the rest of your collection/)).toBeVisible();
    await page.goto("/settings");
    await expect(
      page.getByText(
        `Members see the five you enter, or your auto squad, from ${lockClock(MIDWEEK.schedule.current)} on Wednesday.`,
      ),
    ).toBeVisible();
  },
);
