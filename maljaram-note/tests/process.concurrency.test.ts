import { beforeEach, describe, expect, it, vi } from "vitest";

// DB의 조건부 update(status in UPLOADED/FAILED)를 메모리로 흉내 낸다
const row = { id: "", status: "UPLOADED", audio_path: "u1/s1.webm" as string | null };
const run = vi.fn().mockResolvedValue(undefined);
const afterTasks: (() => unknown)[] = [];

vi.mock("next/server", () => ({ after: (fn: () => unknown) => afterTasks.push(fn) }));
vi.mock("@/lib/http", async (orig) => ({
  ...(await orig<typeof import("@/lib/http")>()),
  authed: async () => ({ db: {}, userId: "u1" }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/pipeline/session-pipeline", () => ({ SessionPipeline: vi.fn(function () { return { run }; }) }));
vi.mock("@/lib/repo/session-repo", async () => {
  const { ApiError } = await import("@/lib/validation/api-error");
  return {
    SessionRepo: vi.fn(function () {
      return {
        getRow: async (id: string) => {
          if (id !== row.id) throw new ApiError(404, "SESSION_NOT_FOUND");
          return { ...row };
        },
        claimForProcessing: async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          if (!["UPLOADED", "FAILED"].includes(row.status) || !row.audio_path) return false;
          row.status = "TRANSCRIBING";
          return true;
        },
      };
    }),
  };
});

const { POST } = await import("@/app/api/sessions/[sessionId]/process/route");
const ID = "a91f0c2e-5b7d-4e1a-8c3f-0d9e8b7a6c5d";
const call = (id = ID) => POST(new Request(`http://t/api/sessions/${id}/process`, { method: "POST" }), { params: Promise.resolve({ sessionId: id }) });

describe("POST /api/sessions/{id}/process", () => {
  beforeEach(() => {
    Object.assign(row, { id: ID, status: "UPLOADED", audio_path: "u1/s1.webm" });
    run.mockClear();
    afterTasks.length = 0;
  });

  it("202 응답 본문은 TRANSCRIBING", async () => {
    const res = await call();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "TRANSCRIBING" });
  });

  it("FAILED 회기는 다시 처리할 수 있다", async () => {
    row.status = "FAILED";
    expect((await call()).status).toBe(202);
  });

  it("원본이 삭제된 회기는 410", async () => {
    row.audio_path = null;
    const res = await call();
    expect(res.status).toBe(410);
    expect((await res.json()).error.code).toBe("AUDIO_DELETED");
  });

  it("타인·없는 회기는 404", async () => {
    expect((await call("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await call("not-a-uuid")).status).toBe(404);
  });
});
