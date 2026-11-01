import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { SAFE_HANDS_CATEGORY_ID } from "../../src/lib/session-reports/kudos-ballot";
import { assertLocalTarget } from "../support/local-target";

const categories = [1, 2, 3].map((n) => `10000000-0000-4000-8000-00000000000${n}`);
categories.push(SAFE_HANDS_CATEGORY_ID);

async function withReport(
  draft: boolean,
  work: (db: Client, session: string, peer: string) => Promise<void>,
) {
  const url = process.env.DB_URL;
  if (!url) throw new Error("DB_URL required");
  assertLocalTarget(url, "DB_URL");
  const db = new Client({ connectionString: url });
  await db.connect();
  const session = randomUUID();
  const season = randomUUID();
  const peer = randomUUID();
  try {
    await db.query(
      "insert into kut.players(id,slug,display_name,archetype) values($1,$2,'Report Teammate','all_rounder')",
      [peer, `report-e2e-${peer}`],
    );
    await db.query(
      "insert into kut.seasons(id,name,starts_on,is_active) values($1,'Report E2E',current_date,false)",
      [season],
    );
    await db.query(
      `insert into kut.match_sessions(id,season_id,session_date,session_type,status,published_at,rating_rules_version)
      values($1,$2,current_date,'other','published',now(),2)`,
      [session, season],
    );
    await db.query(
      `insert into kut.attendance(session_id,player_id,goals)
      select $1,player_id,0 from kut.profiles where username='release_member'`,
      [session],
    );
    await db.query("insert into kut.attendance(session_id,player_id,goals) values($1,$2,0)", [
      session,
      peer,
    ]);
    await db.query(
      `insert into kut.session_surveys(session_id,opened_at,closes_at,category_ids,selection_seed,rules_version)
      values($1,now(),now()+interval '24 hours',$2,$3,3)`,
      [session, categories, randomUUID()],
    );
    await db.query(
      `insert into kut.session_survey_eligibility(session_id,player_id,user_id)
      select $1,player_id,id from kut.profiles where username='release_member'`,
      [session],
    );
    if (draft) {
      await db.query(
        `insert into kut.session_reports(session_id,player_id,submitted_by,goals,status,explicit_skips)
        select $1,player_id,id,2,'draft',$2 from kut.profiles where username='release_member'`,
        [session, categories.slice(1, 3)],
      );
      await db.query(
        `insert into kut.session_kudos(session_id,nominator_player_id,category_id,recipient_player_id)
        select $1,player_id,$2,$3 from kut.profiles where username='release_member'`,
        [session, categories[0], peer],
      );
    }
    await work(db, session, peer);
  } finally {
    // Scope cleanup to this test's UUID, and take back only its reward.
    try {
      await db.query("begin");
      await db.query(
        `update kut.wallets w set balance=w.balance-paid.amount
         from (select user_id,sum(amount) amount from kut.wallet_ledger
           where reference_type='match_session' and reference_id=$1 group by user_id) paid
         where w.user_id=paid.user_id`,
        [session],
      );
      await db.query("delete from kut.session_report_requests where session_id=$1", [session]);
      await db.query("delete from kut.session_report_rewards where session_id=$1", [session]);
      await db.query("delete from kut.attendance_rewards where session_id=$1", [session]);
      await db.query(
        "delete from kut.wallet_ledger where reference_type='match_session' and reference_id=$1",
        [session],
      );
      await db.query(
        "delete from kut.user_notifications where reference_type='match_session' and reference_id=$1",
        [session],
      );
      await db.query("delete from kut.session_kudos where session_id=$1", [session]);
      await db.query("delete from kut.session_reports where session_id=$1", [session]);
      await db.query("delete from kut.session_surveys where session_id=$1", [session]);
      await db.query("delete from kut.attendance where session_id=$1", [session]);
      await db.query("delete from kut.match_sessions where id=$1", [session]);
      await db.query("delete from kut.season_rating_rules where season_id=$1", [season]);
      await db.query("delete from kut.seasons where id=$1", [season]);
      await db.query("delete from kut.players where id=$1", [peer]);
      await db.query("commit");
    } finally {
      await db.end();
    }
  }
}

async function openReport(page: Page, session: string) {
  await page.goto("/login");
  await hydratedForm(page);
  await page.getByLabel("Username").fill("release_member");
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(`/sessions/${session}/report`);
  await hydratedForm(page);
}

async function hydratedForm(page: Page) {
  // SSR controls are visible before React attaches their handlers. In particular,
  // WebKit can fill a number input in that gap without updating controlled state.
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form && Object.keys(form).some((key) => key.startsWith("__reactProps$"));
  });
}

test("complete reports, unchanged/reverted edits, pending, failures, conflicts and reopen @narrow", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120_000);
  await withReport(false, async (db, session, peer) => {
    await openReport(page, session);
    const submit = page.getByRole("button", { name: "Submit report", exact: true });
    const save = page.getByRole("button", { name: "Save changes", exact: true });
    const count = page.getByRole("spinbutton");
    await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
    await expect(submit).toBeDisabled();
    const selects = page.getByRole("combobox");
    for (let n = 0; n < 3; n++) await selects.nth(n).selectOption("skip");
    const findSafeHands = page.getByRole("button", { name: "Safe Hands", exact: true });
    await findSafeHands.click();
    await expect(selects.nth(3)).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("unanswered-phone.png"), fullPage: true });
    await selects.nth(3).selectOption("skip");
    // Even a fully skipped ballot still needs an explicit count, including zero.
    await expect(submit).toBeDisabled();
    await page.getByRole("button", { name: "0", exact: true }).click();
    await expect(submit).toBeEnabled();
    await count.fill("10");
    await expect(submit).toBeDisabled();
    await page.getByRole("checkbox", { name: "Confirm 10 G+A" }).check();
    await expect(submit).toBeEnabled();
    await count.fill("0");

    // Hold a real save request so the pending state is deterministic.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/sessions/${session}/report`, async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    await submit.click();
    await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
    release();
    await expect(
      page.getByText("Report submitted → +50 FLUT Coins received.", { exact: true }),
    ).toBeVisible();
    await expect(save).toBeDisabled();
    await page.unrouteAll();
    await expect(selects.nth(3)).toHaveValue("skip");
    await count.fill("1");
    await expect(save).toBeEnabled();
    await expect(page.getByText("You have unsaved changes.", { exact: true })).toBeVisible();
    await count.fill("0");
    await expect(save).toBeDisabled();
    await selects.nth(3).selectOption("");
    await expect(save).toBeDisabled();
    await selects.nth(3).selectOption("skip");
    await expect(save).toBeDisabled();
    await count.fill("1");
    await save.click();
    await expect(
      page.getByText("Report submitted. Your changes are saved. Edits never pay twice.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(save).toBeDisabled();
    await count.fill("01");
    await expect(save).toBeDisabled();
    await selects.nth(0).selectOption(peer);
    await expect(save).toBeEnabled();
    await selects.nth(0).selectOption("skip");
    await expect(save).toBeDisabled();
    await selects.nth(0).selectOption(peer);
    await selects.nth(3).selectOption(peer);
    await expect(save).toBeEnabled();
    await selects.nth(1).selectOption(peer);
    await expect(save).toBeDisabled();
    await selects.nth(1).selectOption("skip");
    await save.click();
    await expect(save).toBeDisabled();
    await page.reload();
    await hydratedForm(page);
    await expect(count).toHaveValue("1");
    await expect(selects.nth(0)).toHaveValue(peer);
    await expect(selects.nth(3)).toHaveValue(peer);
    await expect(save).toBeDisabled();

    // A server rejection must preserve the edits and the successful revision.
    await db.query("update kut.session_surveys set status='cancelled' where session_id=$1", [
      session,
    ]);
    await count.fill("2");
    await save.click();
    await expect(page.getByRole("alert").filter({ hasText: "Reports are closed" })).toHaveText(
      "Reports are closed for this session.",
    );
    await expect(count).toHaveValue("2");
    await expect(save).toBeEnabled();
    await count.fill("1");
    await expect(save).toBeDisabled();
    await db.query("update kut.session_surveys set status='open' where session_id=$1", [session]);
    await count.fill("2");
    await save.click();
    await expect(save).toBeDisabled();
    await expect(page.getByRole("alert").filter({ hasText: "Reports are closed" })).toHaveCount(0);

    const other = await context.newPage();
    await other.goto(`/sessions/${session}/report`);
    await hydratedForm(other);
    await other.getByRole("spinbutton").fill("4");
    await count.fill("3");
    await save.click();
    await expect(save).toBeDisabled();
    await other.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(
      other.getByRole("alert").filter({ hasText: "This report changed elsewhere" }),
    ).toHaveText("This report changed elsewhere. Refresh to load the saved version.");
    await expect(other.getByRole("spinbutton")).toHaveValue("4");
    await expect(other.getByRole("button", { name: "Save changes", exact: true })).toBeEnabled();
    await other.reload();
    await hydratedForm(other);
    await expect(other.getByRole("spinbutton")).toHaveValue("3");
    await expect(other.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
    await other.close();
    const rewards = await db.query(
      "select amount from kut.session_report_rewards where session_id=$1",
      [session],
    );
    expect(rewards.rows.map((row) => Number(row.amount))).toEqual([50]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1,
    );
    await page.screenshot({ path: testInfo.outputPath("submitted-phone.png"), fullPage: true });
  });
});

test("historical drafts reopen without promotion and submit only when completed @narrow", async ({
  page,
}) => {
  await withReport(true, async (db, session, peer) => {
    await openReport(page, session);
    const submit = page.getByRole("button", { name: "Submit report", exact: true });
    await expect(page.getByRole("spinbutton")).toHaveValue("2");
    await expect(page.getByRole("combobox").nth(0)).toHaveValue(peer);
    for (let n = 1; n < 3; n++) await expect(page.getByRole("combobox").nth(n)).toHaveValue("skip");
    await expect(page.getByRole("combobox").nth(3)).toHaveValue("");
    await expect(submit).toBeDisabled();
    expect(
      (await db.query("select status from kut.session_reports where session_id=$1", [session]))
        .rows[0].status,
    ).toBe("draft");
    await page.getByRole("combobox").nth(3).selectOption("skip");
    await submit.click();
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
    await expect(
      page.getByText("Report submitted → +50 FLUT Coins received.", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await db.query("select status,goals from kut.session_reports where session_id=$1", [
          session,
        ])
      ).rows[0],
    ).toEqual({ status: "submitted", goals: 2 });
  });
});
