import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InjuryPage from "@/app/(app)/injury/page";
import { checkInInjury } from "@/app/(app)/injury/actions";

const { requireUser, rpc, revalidatePath } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/user", () => ({ requireUser }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ schema: () => ({ rpc }) }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

const injured = {
  injured: true,
  started_on: "2026-10-01",
  checkable_week_start: "2026-10-19",
  checked_in_this_week: false,
  protected_weeks: 1,
  stipend: 100,
};

beforeEach(() => {
  vi.resetAllMocks();
  requireUser.mockResolvedValue({ id: "member" });
});

describe("the rehab tile's /injury destination", () => {
  it("renders the check-in form for the week chosen by SQL", async () => {
    rpc.mockResolvedValue({ data: injured, error: null });
    const html = renderToStaticMarkup(await InjuryPage());
    expect(requireUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("my_injury_status");
    expect(html).toContain('name="week_start" value="2026-10-19"');
    expect(html).toContain('type="submit"');
    expect(html).toContain("Check in</button>");
  });

  it("requires membership before reading injury status", async () => {
    requireUser.mockRejectedValue(new Error("denied"));
    await expect(InjuryPage()).rejects.toThrow("denied");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ injured: false }, "Your player is not in injury mode."],
    [
      { ...injured, checkable_week_start: null, checked_in_this_week: true },
      "Your card is protected this week.",
    ],
    [{ ...injured, checkable_week_start: null }, "Your next rehab check-in opens"],
  ])("handles a stale link with status %j", async (data, message) => {
    rpc.mockResolvedValue({ data, error: null });
    const html = renderToStaticMarkup(await InjuryPage());
    expect(html).toContain(message);
    expect(html).not.toContain('type="submit"');
  });

  it("does not describe a failed read as no injury", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(InjuryPage()).rejects.toThrow("Could not load your injury status");
  });
});

it("refreshes both check-in surfaces after the existing SQL action succeeds", async () => {
  rpc.mockResolvedValue({ data: { checked_in: true, amount: 100 }, error: null });
  const form = new FormData();
  form.set("week_start", "2026-10-19");
  expect((await checkInInjury(null, form))?.ok).toBe(true);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("injury_check_in", { p_week_start: "2026-10-19" });
  expect(revalidatePath.mock.calls).toEqual([["/"], ["/injury"]]);
});
