import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WantedPage from "@/app/(app)/club/collection/wanted/page";

const { requireUser, createClient } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/user", () => ({ requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ usePathname: () => "/club/collection/wanted" }));
vi.mock("@/app/(app)/club/collection/discovery-actions", () => ({
  setCardWant: vi.fn(),
  setTradeAvailability: vi.fn(),
}));

type Response = { data: unknown; error: { message: string } | null };
let responses: Record<string, Response>;

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireUser.mockResolvedValue({ id: "member" });
  responses = Object.fromEntries(
    Object.entries({
      my_wanted_cards: [
        {
          edition_id: "edition",
          state: "active",
          edition_title: "Live Wanted Player",
          is_live: true,
          display_name: "Wanted Player",
          owned_count: 0,
          lowest_listing_price: null,
        },
      ],
      get_my_wanted_availability: [{ edition_id: "edition", owner_display_name: "Owner" }],
      card_editions: [{ id: "edition", title: "Live", players: { display_name: "Wanted Player" } }],
      my_trade_cards: [
        {
          card_id: "copy",
          edition_id: "owned-edition",
          edition_title: "Live Owned Player",
          display_name: "Owned Player",
          is_available: false,
          availability_state: "eligible",
          acquired_at: "2026-10-14",
        },
      ],
      my_collection_cards: [{ player_id: "player" }, { player_id: "player" }],
      player_directory: [
        { id: "player", archetype: "all_rounder" },
        { id: "other", archetype: "all_rounder" },
      ],
      my_club_value: { club_value: 250 },
      profiles: { player_id: "player" },
    }).map(([read, data]) => [read, { data, error: null }]),
  );
  const query = (read: string) => ({
    ...responses[read],
    select() {
      return this;
    },
    order() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return this;
    },
  });
  createClient.mockResolvedValue({ schema: () => ({ from: query, rpc: query }) });
});

it("keeps the full Collection header when summary reads succeed", async () => {
  const html = renderToStaticMarkup(await WantedPage());
  expect(html).toContain("1 of 2 Players · 2 cards");
  expect(html).toContain('aria-label="1 of 2 collected"');
  expect(html).toContain("Club Value 250");
  expect(html).toContain("choose your type");
  expect(console.error).not.toHaveBeenCalled();
});

it.each(["my_collection_cards", "player_directory"])(
  "keeps Trading controls and omits counts/completion when %s fails",
  async (read) => {
    responses[read] = { data: null, error: { message: `${read} unavailable` } };
    const html = renderToStaticMarkup(await WantedPage());
    expect(html).toContain(">Collection</h1>");
    expect(html).toContain('aria-label="Collection view"');
    expect(html).toContain(">Album</span>");
    expect(html).toContain(">Manage</span>");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(">Trading</span>");
    expect(html).not.toMatch(/\d+ of \d+ Players|\d+ cards|collected/);
    expect(html).toContain("Club Value 250");
    expect(html).not.toContain("· Club Value");
    expect(html).toContain("Wanted Player");
    expect(html).toContain(">Remove</button>");
    expect(html).toContain("Add a wanted card");
    expect(html).toContain("Copy message");
    expect(html).toContain("Owned Player");
    expect(html).toContain(">Make available</button>");
    expect(console.error).toHaveBeenCalledWith("trading collection summary read failed", {
      collection: read === "my_collection_cards" ? `${read} unavailable` : undefined,
      roster: read === "player_directory" ? `${read} unavailable` : undefined,
    });
  },
);

it.each(["my_wanted_cards", "get_my_wanted_availability", "card_editions", "my_trade_cards"])(
  "still rejects a core Trading failure in %s",
  async (read) => {
    responses[read] = { data: null, error: { message: `${read} unavailable` } };
    await expect(WantedPage()).rejects.toThrow("Could not load trading preferences.");
    expect(console.error).toHaveBeenCalledWith(
      "trading preferences read failed",
      expect.any(Object),
    );
  },
);

it("still requires an enabled member before reading Trading data", async () => {
  requireUser.mockRejectedValue(new Error("membership denied"));
  await expect(WantedPage()).rejects.toThrow("membership denied");
  expect(createClient).not.toHaveBeenCalled();
});
