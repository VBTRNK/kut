import { beforeEach, expect, it, vi } from "vitest";
import {
  saveSessionReport,
  type ReportState,
} from "@/app/(app)/sessions/[sessionId]/report/actions";
import { SAFE_HANDS_CATEGORY_ID, SKIP } from "@/lib/session-reports/kudos-ballot";

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

function form() {
  const data = new FormData();
  Object.entries({
    sessionId: "00000358-0000-4000-8000-000000000001",
    idempotencyKey: "00000358-0000-4000-8000-000000000002",
    sessionDate: "2026-11-01",
    revision: "2",
    goals: "0",
    categoryIds: SAFE_HANDS_CATEGORY_ID,
    [`category-${SAFE_HANDS_CATEGORY_ID}`]: SKIP,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({ data: { revision: 3, rewarded: true }, error: null });
});
it("authorizes before saving", async () => {
  requireUser.mockRejectedValue(new Error("denied"));
  await expect(saveSessionReport({ error: null }, form())).rejects.toThrow("denied");
  expect(rpc).not.toHaveBeenCalled();
});
it("requires an explicit count and complete ballot even with a legacy draft intent", async () => {
  const data = form();
  data.set("intent", "draft");
  data.set("goals", "");
  expect((await saveSessionReport({ error: null }, data)).error).toContain("including zero");
  data.set("goals", "0");
  data.set(`category-${SAFE_HANDS_CATEGORY_ID}`, "");
  expect((await saveSessionReport({ error: null }, data)).error).toContain("every kudos category");
  expect(rpc).not.toHaveBeenCalled();
});
it("always submits, accepts zero and Skip, and returns the saved values", async () => {
  const data = form();
  data.set("intent", "draft");
  const result = await saveSessionReport({ error: null }, data);
  expect(rpc).toHaveBeenCalledWith(
    "submit_session_report",
    expect.objectContaining({
      p_goals: 0,
      p_intent: "submit",
      p_expected_revision: 2,
      p_nominations: { [SAFE_HANDS_CATEGORY_ID]: null },
    }),
  );
  expect(result).toEqual({
    error: null,
    saved: true,
    rewarded: true,
    revision: 3,
    savedValues: { goals: 0, ballot: { [SAFE_HANDS_CATEGORY_ID]: SKIP } },
  });
  expect(revalidatePath).toHaveBeenCalledTimes(2);
});
it("keeps high-count confirmation", async () => {
  const data = form();
  data.set("goals", "10");
  expect((await saveSessionReport({ error: null }, data)).error).toContain("Confirm 10 G+A");
  expect(rpc).not.toHaveBeenCalled();
  data.set("confirmGoals", "yes");
  expect((await saveSessionReport({ error: null }, data)).saved).toBe(true);
});
it("asks members to refresh after an unrecognised server rejection", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "nominee must be another attendee" } });
  expect((await saveSessionReport({ error: null }, form())).error).toBe(
    "Could not save the report. Refresh and try again.",
  );
});
it.each(["conflict", "error", "network", "missing"])(
  "preserves the last saved baseline and revision after %s",
  async (failure) => {
    const previous: ReportState = {
      error: null,
      saved: true,
      revision: 2,
      savedValues: { goals: 1, ballot: { [SAFE_HANDS_CATEGORY_ID]: SKIP } },
    };
    if (failure === "conflict")
      rpc.mockResolvedValue({ data: { conflict: true, revision: 9 }, error: null });
    if (failure === "error")
      rpc.mockResolvedValue({ data: null, error: { message: "reports are closed" } });
    if (failure === "network") rpc.mockRejectedValue(new Error("offline"));
    if (failure === "missing") rpc.mockResolvedValue({ data: null, error: null });
    const result = await saveSessionReport(previous, form());
    expect(result).toMatchObject({ saved: false, revision: 2, savedValues: previous.savedValues });
    expect(result.error).toMatch(/Refresh|closed|connection/);
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);
