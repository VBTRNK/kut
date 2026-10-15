import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { applyPackSettings } from "@/app/(app)/admin/economy/actions";
import EconomyPage from "@/app/(app)/admin/economy/page";
const { requireAdmin, rpc } = vi.hoisted(() => ({ requireAdmin: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ schema: () => ({ rpc }) }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    "tfh-pack": "250",
    "tfh-silver-pack": "1",
    "tfh-gold-pack": "750",
    revision: "2",
    silver_active: "true",
    gold_active: "false",
  }))
    data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  requireAdmin.mockResolvedValue({ id: "admin" });
});
it("authorizes before reading submitted prices or calling SQL", async () => {
  requireAdmin.mockRejectedValue(new Error("denied"));
  await expect(applyPackSettings(null, form())).rejects.toThrow("denied");
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["", "0", "1.5", "1000001", "NaN"])(
  "rejects invalid price %s without a write",
  async (value) => {
    const data = form();
    data.set("tfh-silver-pack", value);
    expect((await applyPackSettings(null, data))?.error).toContain("whole coins");
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("rejects missing revision and malformed availability", async () => {
  const data = form();
  data.delete("revision");
  expect((await applyPackSettings(null, data))?.error).toBeTruthy();
  data.set("revision", "2");
  data.set("gold_active", "yes");
  expect((await applyPackSettings(null, data))?.error).toBeTruthy();
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["applied", "unchanged", "conflict"])(
  "passes a warning override atomically and preserves %s",
  async (status) => {
    const result = { status, revision: 3, packs: {} };
    rpc
      .mockResolvedValueOnce({ data: result, error: null })
      .mockResolvedValueOnce({ data: { measured_at: "fresh" }, error: null });
    const state = await applyPackSettings(null, form());
    expect(rpc.mock.calls[0]).toEqual([
      "admin_apply_pack_settings",
      {
        p_expected_revision: 2,
        p_regular_price: 250,
        p_silver_price: 1,
        p_gold_price: 750,
        p_silver_active: true,
        p_gold_active: false,
      },
    ]);
    expect(state?.result).toEqual(result);
    expect(state?.economy).toEqual({ measured_at: "fresh" });
  },
);
it("keeps the write outcome when the subsequent measurement fails", async () => {
  rpc
    .mockResolvedValueOnce({ data: { status: "applied", revision: 3, packs: {} }, error: null })
    .mockResolvedValueOnce({ data: null, error: { code: "error" } });
  expect((await applyPackSettings(null, form()))?.result?.status).toBe("applied");
});
it("degrades safely when the old schema has no admin RPC", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  const html = renderToStaticMarkup(await EconomyPage());
  expect(requireAdmin).toHaveBeenCalledOnce();
  expect(html).toContain("unavailable on this schema");
  expect(html).not.toContain("Apply changes");
  expect((await applyPackSettings(null, form()))?.error).toContain("unavailable on this schema");
});
it("does not mislabel other read failures as an old schema", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  await expect(EconomyPage()).rejects.toThrow("Could not load pack economy");
});
