import { describe, expect, it, vi } from "vitest";
import { EventLogger } from "@/lib/ops/event-logger";
import { RateLimiter } from "@/lib/ops/rate-limiter";
import { decodeCursor, encodeCursor } from "@/lib/repo/session-repo";
import { ApiError } from "@/lib/validation/api-error";

// supabase-js 쿼리 빌더 흉내: 체이닝 후 await하면 result를 돌려준다
function builder(result: unknown, log: string[] = []) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lte", "insert", "delete", "upsert", "in", "not", "order", "limit"]) {
    b[m] = (...args: unknown[]) => {
      log.push(`${m}:${JSON.stringify(args)}`);
      return b;
    };
  }
  b.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return b;
}

describe("RateLimiter (FNC-O-004)", () => {
  const limiter = (count: number) => new RateLimiter({ from: () => builder({ count, error: null }) } as never);

  it("9건까지 통과, 10건이면 429", async () => {
    await expect(limiter(9).assertQuota("u1")).resolves.toBeUndefined();
    const e = await limiter(10).assertQuota("u1").catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 429, code: "QUOTA_EXCEEDED" });
  });
});

describe("EventLogger (FNC-O-001)", () => {
  it("허용되지 않은 이름은 400 UNKNOWN_EVENT", async () => {
    const logger = new EventLogger({ from: () => builder({ error: null }) } as never);
    await expect(logger.log("u1", "page_view")).rejects.toMatchObject({ status: 400, code: "UNKNOWN_EVENT" });
    await expect(logger.log("u1", "homework_checked", { homeworkId: "h1" })).resolves.toBeUndefined();
  });
});

describe("타임라인 커서", () => {
  it("인코딩·디코딩", () => {
    const c = encodeCursor({ sessionDate: "2026-12-08", createdAt: "2026-12-08T11:02:03.123456+00:00", id: "a91f0c2e-5b7d-4e1a-8c3f-0d9e8b7a6c5d" });
    expect(decodeCursor(c)).toEqual({ date: "2026-12-08", createdAt: "2026-12-08T11:02:03.123456+00:00", id: "a91f0c2e-5b7d-4e1a-8c3f-0d9e8b7a6c5d" });
  });

  it("필터 문법을 끼워 넣은 커서는 거부", () => {
    const bad = Buffer.from("2026-12-08|x),user_id.neq.(0|a91f0c2e-5b7d-4e1a-8c3f-0d9e8b7a6c5d").toString("base64url");
    expect(decodeCursor(bad)).toBeNull();
  });
});
