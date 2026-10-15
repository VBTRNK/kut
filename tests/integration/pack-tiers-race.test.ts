import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localDatabaseUrl } from "../support/local-target";

// ADR-164: pack settings and Silver purchases under real concurrency. Every
// id lives on the 66000000- prefix; settings are restored on cleanup.
const url = localDatabaseUrl();
const fx = {
  admin1: "66000000-0000-4000-8000-000000000001",
  admin2: "66000000-0000-4000-8000-000000000002",
  member: "66000000-0000-4000-8000-000000000003",
  poor: "66000000-0000-4000-8000-000000000004",
  player: "66000000-0000-4000-8000-000000000011",
  sameKey: "66000000-0000-4000-8000-000000000021",
};
const users = [fx.admin1, fx.admin2, fx.member, fx.poor];
type Definition = { slug: string; price: string; is_active: boolean };
let admin: Client, a: Client, b: Client;
let initial: Definition[] = [];

async function cleanup() {
  const openings = await admin.query(
    "select id from kut.pack_openings where user_id=any($1::uuid[])",
    [users],
  );
  const ids = openings.rows.map((r) => r.id);
  if (ids.length) {
    const cards = await admin.query(
      "select result.card_id,card.edition_id from kut.pack_opening_cards result join kut.user_cards card on card.id=result.card_id where result.opening_id=any($1::uuid[])",
      [ids],
    );
    for (const row of cards.rows)
      await admin.query(
        "update kut.card_editions set minted_count=greatest(0,minted_count-1) where id=$1",
        [row.edition_id],
      );
    await admin.query("delete from kut.pack_opening_cards where opening_id=any($1::uuid[])", [ids]);
    await admin.query("delete from kut.user_cards where id=any($1::uuid[])", [
      cards.rows.map((r) => r.card_id),
    ]);
    await admin.query("delete from kut.pack_openings where id=any($1::uuid[])", [ids]);
  }
  await admin.query("delete from kut.pack_settings_changes where changed_by=any($1::uuid[])", [
    users,
  ]);
  for (const row of initial)
    await admin.query("update kut.pack_definitions set price=$2,is_active=$3 where slug=$1", [
      row.slug,
      row.price,
      row.is_active,
    ]);
  await admin.query("delete from kut.wallet_ledger where user_id=any($1::uuid[])", [users]);
  await admin.query("delete from kut.wallets where user_id=any($1::uuid[])", [users]);
  await admin.query("delete from kut.profiles where id=any($1::uuid[])", [users]);
  await admin.query("delete from auth.users where id=any($1::uuid[])", [users]);
  await admin.query("delete from kut.player_season_state where player_id=$1", [fx.player]);
  await admin.query("delete from kut.card_editions where player_id=$1", [fx.player]);
  await admin.query("delete from kut.players where id=$1", [fx.player]);
}
async function begin(client: Client, user: string) {
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
}
async function run(client: Client, sql: string, args: unknown[]) {
  try {
    const result = await client.query(sql, args);
    await client.query("commit");
    return { result, error: null };
  } catch (error) {
    await client.query("rollback");
    return { result: null, error: error as Error };
  }
}
// Resolves once `client`'s backend is blocked on a row lock.
async function waitForLock(client: Client) {
  const pid = (client as unknown as { processID: number }).processID;
  for (let i = 0; i < 200; i++) {
    const row = await admin.query("select wait_event_type from pg_stat_activity where pid=$1", [
      pid,
    ]);
    if (row.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("the second transaction never waited for the lock");
}
async function settings() {
  const rows = await admin.query(
    "select slug,price,is_active from kut.pack_definitions where slug in ('tfh-pack','tfh-silver-pack','tfh-gold-pack')",
  );
  const bySlug = Object.fromEntries(rows.rows.map((r) => [r.slug, r]));
  const revision = await admin.query(
    "select coalesce(max(revision),0)::int revision from kut.pack_settings_changes",
  );
  return { bySlug, revision: revision.rows[0].revision as number };
}
const apply = (
  silverPrice: number,
  silverActive: boolean,
  revision: number,
  regular: string,
): [string, unknown[]] => [
  "select kut.admin_apply_pack_settings($1,$2,$3,$4,$5,$6) result",
  [revision, regular, silverPrice, 750, silverActive, false],
];
async function balance(user: string) {
  return (await admin.query("select balance from kut.wallets where user_id=$1", [user])).rows[0]
    .balance as string;
}

beforeAll(async () => {
  admin = new Client({ connectionString: url });
  a = new Client({ connectionString: url });
  b = new Client({ connectionString: url });
  await Promise.all([admin.connect(), a.connect(), b.connect()]);
  initial = (
    await admin.query(
      "select slug,price::text,is_active from kut.pack_definitions where slug in ('tfh-pack','tfh-silver-pack','tfh-gold-pack')",
    )
  ).rows;
  await cleanup();
  await admin.query(
    "insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) select id,'pack-race-'||ord||'@example.test','authenticated','authenticated','{}','{}',now(),now() from unnest($1::uuid[]) with ordinality u(id,ord)",
    [users],
  );
  await admin.query(
    "insert into kut.profiles(id,display_name,role) values($1,'Pack Race Admin 1','admin'),($2,'Pack Race Admin 2','admin'),($3,'Pack Race Member','user'),($4,'Pack Race Poor','user')",
    users,
  );
  // One Gold Live Player keeps the Silver guarantee possible on any roster.
  await admin.query(
    "insert into kut.players(id,slug,display_name,archetype) values($1,'pack-race-gold','Pack Race Gold','all_rounder')",
    [fx.player],
  );
  await admin.query(
    "insert into kut.card_editions(player_id,edition_type,title,is_live) values($1,'live','Live',true)",
    [fx.player],
  );
  const season = await admin.query("select id from kut.seasons where is_active");
  if (season.rows.length !== 1) throw new Error("the local stack needs one active season");
  await admin.query(
    "insert into kut.player_season_state(player_id,season_id,activity_score,form_score,live_ovr,pac,sho,pas,dri,def,phy,rarity_tier) values($1,$2,0,0,62,62,62,62,62,62,62,'gold')",
    [fx.player, season.rows[0].id],
  );
  const { bySlug, revision } = await settings();
  await begin(a, fx.admin1);
  const on = await run(a, ...apply(500, true, revision, bySlug["tfh-pack"].price));
  expect(on.result?.rows[0].result.status).toBe("applied");
  await admin.query(
    "insert into kut.wallets(user_id,balance) values($1,100000),($2,500) on conflict(user_id) do update set balance=excluded.balance",
    [fx.member, fx.poor],
  );
});
afterAll(async () => {
  await cleanup();
  await Promise.all([admin.end(), a.end(), b.end()]);
});

describe("pack tier concurrency", () => {
  it("lets one of two admins apply from the same revision", async () => {
    const { bySlug, revision } = await settings();
    await Promise.all([begin(a, fx.admin1), begin(b, fx.admin2)]);
    const results = await Promise.all([
      run(a, ...apply(525, true, revision, bySlug["tfh-pack"].price)),
      run(b, ...apply(550, true, revision, bySlug["tfh-pack"].price)),
    ]);
    expect(results.map((r) => r.result?.rows[0].result.status).sort()).toEqual([
      "applied",
      "conflict",
    ]);
    const after = await settings();
    expect(after.revision).toBe(revision + 1);
    const applied = results.find((r) => r.result?.rows[0].result.status === "applied");
    expect(Number(after.bySlug["tfh-silver-pack"].price)).toBe(
      applied?.result?.rows[0].result.packs["tfh-silver-pack"].price,
    );
  });

  it("re-quotes a purchase that waited for a price change, without a debit", async () => {
    const { bySlug, revision } = await settings();
    const quoted = Number(bySlug["tfh-silver-pack"].price);
    const before = await balance(fx.member);
    await Promise.all([begin(a, fx.admin1), begin(b, fx.member)]);
    await a.query(...apply(quoted + 25, true, revision, bySlug["tfh-pack"].price));
    const purchase = run(b, "select kut.open_pack('tfh-silver-pack',$1,gen_random_uuid()) result", [
      quoted,
    ]);
    await waitForLock(b);
    await a.query("commit");
    const result = await purchase;
    expect(result.result?.rows[0].result).toMatchObject({
      price_changed: true,
      current_price: quoted + 25,
    });
    expect(await balance(fx.member)).toBe(before);
  });

  it("refuses a purchase that waited while the pack was switched off, without a debit", async () => {
    const { bySlug, revision } = await settings();
    const quoted = Number(bySlug["tfh-silver-pack"].price);
    const before = await balance(fx.member);
    await Promise.all([begin(a, fx.admin1), begin(b, fx.member)]);
    await a.query(...apply(quoted, false, revision, bySlug["tfh-pack"].price));
    const purchase = run(b, "select kut.open_pack('tfh-silver-pack',$1,gen_random_uuid()) result", [
      quoted,
    ]);
    await waitForLock(b);
    await a.query("commit");
    const result = await purchase;
    expect(result.error?.message).toBe("active pack not found");
    expect(await balance(fx.member)).toBe(before);
    const on = await settings();
    await begin(a, fx.admin1);
    await run(a, ...apply(quoted, true, on.revision, bySlug["tfh-pack"].price));
  });

  it("finishes an in-flight purchase at its quote before a price change applies", async () => {
    const { bySlug, revision } = await settings();
    const quoted = Number(bySlug["tfh-silver-pack"].price);
    await Promise.all([begin(a, fx.member), begin(b, fx.admin1)]);
    const opened = await a.query(
      "select kut.open_pack('tfh-silver-pack',$1,gen_random_uuid()) result",
      [quoted],
    );
    const change = run(b, ...apply(quoted + 50, true, revision, bySlug["tfh-pack"].price));
    await waitForLock(b);
    await a.query("commit");
    expect((await change).result?.rows[0].result.status).toBe("applied");
    const paid = await admin.query("select price_paid from kut.pack_openings where id=$1", [
      opened.rows[0].result.opening_id,
    ]);
    expect(Number(paid.rows[0].price_paid)).toBe(quoted);
  });

  it("opens one Silver pack for concurrent same-key retries", async () => {
    const { bySlug } = await settings();
    const quoted = Number(bySlug["tfh-silver-pack"].price);
    const before = BigInt(await balance(fx.member));
    await Promise.all([begin(a, fx.member), begin(b, fx.member)]);
    const results = await Promise.all([
      run(a, "select kut.open_pack('tfh-silver-pack',$1,$2) result", [quoted, fx.sameKey]),
      run(b, "select kut.open_pack('tfh-silver-pack',$1,$2) result", [quoted, fx.sameKey]),
    ]);
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(results.map((r) => r.result?.rows[0].result.already_processed).sort()).toEqual([
      false,
      true,
    ]);
    expect(BigInt(await balance(fx.member))).toBe(before - BigInt(quoted));
    const cards = await admin.query(
      "select count(*)::int count, count(*) filter (where result.opened_tier in ('silver','gold','holo','elite'))::int qualifying from kut.pack_opening_cards result join kut.pack_openings opening on opening.id=result.opening_id where opening.idempotency_key=$1",
      [fx.sameKey],
    );
    expect(cards.rows[0].count).toBe(3);
    expect(cards.rows[0].qualifying).toBeGreaterThanOrEqual(1);
  });

  it("opens one of two different-key Silver packs with coins for one", async () => {
    const { bySlug } = await settings();
    const quoted = Number(bySlug["tfh-silver-pack"].price);
    await admin.query("update kut.wallets set balance=$2 where user_id=$1", [fx.poor, quoted]);
    await Promise.all([begin(a, fx.poor), begin(b, fx.poor)]);
    const results = await Promise.all([
      run(a, "select kut.open_pack('tfh-silver-pack',$1,gen_random_uuid()) result", [quoted]),
      run(b, "select kut.open_pack('tfh-silver-pack',$1,gen_random_uuid()) result", [quoted]),
    ]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(results.find((r) => r.error)?.error?.message).toBe(
      "insufficient FLUT Coins for this pack",
    );
    expect(await balance(fx.poor)).toBe("0");
  });
});
