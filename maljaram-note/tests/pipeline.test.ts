import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionRepo = {
  getRow: vi.fn(),
  saveTranscript: vi.fn(),
  saveSummary: vi.fn(),
  markDone: vi.fn(),
  markFailed: vi.fn(),
  markAudioDeleted: vi.fn(),
};
const settings = { autoDeleteAudio: true };

vi.mock("@/lib/repo/session-repo", () => ({ SessionRepo: vi.fn(function () { return sessionRepo; }) }));
vi.mock("@/lib/repo/child-repo", () => ({
  ChildRepo: vi.fn(function () { return { get: vi.fn().mockResolvedValue({ nickname: "도윤이", therapyType: "SPEECH" }) }; }),
}));
vi.mock("@/lib/repo/profile-repo", () => ({
  ProfileRepo: vi.fn(function () { return { getSettings: vi.fn(async () => settings) }; }),
}));

const { SessionPipeline, FAIL } = await import("@/lib/pipeline/session-pipeline");
const { SummaryInvalidError } = await import("@/lib/ai/summarizer");

const summary = { activities: ["카드 놀이"], child_response: "", homework: [], next_goal: "" };

function fakeDb(downloadError = false) {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const download = vi.fn().mockResolvedValue(downloadError ? { data: null, error: new Error("x") } : { data: new Blob(["a"]), error: null });
  return { db: { storage: { from: () => ({ download, remove }) } } as never, remove };
}

describe("SessionPipeline (FNC-P-001)", () => {
  beforeEach(() => {
    Object.values(sessionRepo).forEach((f) => f.mockReset());
    sessionRepo.getRow.mockResolvedValue({ id: "s1", child_id: "c1", user_id: "u1", audio_path: "u1/s1.webm" });
    settings.autoDeleteAudio = true;
  });

  it("받아쓰기 → 요약 → 저장 → 원본 삭제 → DONE", async () => {
    const { db, remove } = fakeDb();
    const transcriber = { transcribe: vi.fn().mockResolvedValue({ text: "원문", durationSec: 486 }) };
    const summarizer = { summarize: vi.fn().mockResolvedValue(summary), model: "claude-opus-5-5" };
    await new SessionPipeline(db, transcriber as never, summarizer as never).run("s1");

    expect(transcriber.transcribe).toHaveBeenCalledWith(expect.any(Blob), "s1.webm", "도윤이");
    expect(sessionRepo.saveTranscript).toHaveBeenCalledWith("s1", "원문", 486);
    expect(sessionRepo.saveSummary).toHaveBeenCalledWith("s1", summary, "claude-opus-5-5", "v2");
    expect(remove).toHaveBeenCalledWith(["u1/s1.webm"]);
    expect(sessionRepo.markAudioDeleted).toHaveBeenCalledWith("s1");
    expect(sessionRepo.markDone).toHaveBeenCalledWith("s1");
    expect(sessionRepo.markFailed).not.toHaveBeenCalled();
  });

  it("자동 삭제 OFF면 원본을 남긴다", async () => {
    settings.autoDeleteAudio = false;
    const { db, remove } = fakeDb();
    const transcriber = { transcribe: vi.fn().mockResolvedValue({ text: "원문", durationSec: 1 }) };
    const summarizer = { summarize: vi.fn().mockResolvedValue(summary), model: "m" };
    await new SessionPipeline(db, transcriber as never, summarizer as never).run("s1");
    expect(remove).not.toHaveBeenCalled();
    expect(sessionRepo.markDone).toHaveBeenCalled();
  });

  it("STT 실패 → FAILED(사용자용 문구)", async () => {
    const { db } = fakeDb();
    const transcriber = { transcribe: vi.fn().mockRejectedValue(new Error("401 invalid key")) };
    await new SessionPipeline(db, transcriber as never, {} as never).run("s1");
    expect(sessionRepo.markFailed).toHaveBeenCalledWith("s1", FAIL.STT);
    expect(sessionRepo.markDone).not.toHaveBeenCalled();
  });

  it("요약 스키마 2회 불일치 → FAILED(SUMMARY_INVALID)", async () => {
    const { db } = fakeDb();
    const transcriber = { transcribe: vi.fn().mockResolvedValue({ text: "원문", durationSec: 1 }) };
    const summarizer = { summarize: vi.fn().mockRejectedValue(new SummaryInvalidError("schema")), model: "m" };
    await new SessionPipeline(db, transcriber as never, summarizer as never).run("s1");
    expect(sessionRepo.markFailed).toHaveBeenCalledWith("s1", FAIL.SUMMARY_INVALID);
    expect(sessionRepo.saveSummary).not.toHaveBeenCalled();
  });

  it("말소리가 없으면 요약하지 않는다", async () => {
    const { db } = fakeDb();
    const transcriber = { transcribe: vi.fn().mockResolvedValue({ text: "", durationSec: 3 }) };
    const summarizer = { summarize: vi.fn(), model: "m" };
    await new SessionPipeline(db, transcriber as never, summarizer as never).run("s1");
    expect(summarizer.summarize).not.toHaveBeenCalled();
    expect(sessionRepo.markFailed).toHaveBeenCalledWith("s1", FAIL.EMPTY);
  });

  it("파일 다운로드 실패 → FAILED", async () => {
    const { db } = fakeDb(true);
    await new SessionPipeline(db, {} as never, {} as never).run("s1");
    expect(sessionRepo.markFailed).toHaveBeenCalledWith("s1", FAIL.STORAGE);
  });
});
