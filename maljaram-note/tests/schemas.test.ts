import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, parseInput } from "@/lib/validation/api-error";
import { ChildCreate, EventBody, SessionCreate, SettingsUpdate, SummaryUpdate } from "@/lib/validation/schemas";

const fieldErrors = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(400);
    return (e as ApiError).fieldErrors!;
  }
  throw new Error("검증이 통과되면 안 됨");
};

describe("입력 검증(화면 명세 규칙)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-08T03:00:00Z")); // KST 12-08 12:00
  });
  afterEach(() => vi.useRealTimers());

  it("아이 별칭 1~30자, 미래 생년월 불가", () => {
    expect(fieldErrors(() => parseInput(ChildCreate, { nickname: "" }))).toHaveProperty("nickname");
    expect(fieldErrors(() => parseInput(ChildCreate, { nickname: "가".repeat(31) }))).toHaveProperty("nickname");
    expect(fieldErrors(() => parseInput(ChildCreate, { nickname: "도윤이", birthMonth: "2027-01" }))).toHaveProperty("birthMonth");
    expect(fieldErrors(() => parseInput(ChildCreate, { nickname: "도윤이", birthMonth: "2013-01" }))).toHaveProperty("birthMonth");
    const ok = parseInput(ChildCreate, { nickname: " 도윤이 ", birthMonth: "2022-05" });
    expect(ok).toMatchObject({ nickname: "도윤이", therapyType: "SPEECH" });
  });

  it("회기 날짜는 오늘~30일 전", () => {
    const base = { childId: "7c1e8a52-3f2a-4b8e-9d10-1a2b3c4d5e6f", consentConfirmed: true, fileName: "rec.webm", fileSize: 1000, mimeType: "audio/webm" };
    expect(parseInput(SessionCreate, { ...base, sessionDate: "2026-12-08" }).sessionDate).toBe("2026-12-08");
    expect(parseInput(SessionCreate, { ...base, sessionDate: "2026-11-08" }).sessionDate).toBe("2026-11-08");
    expect(fieldErrors(() => parseInput(SessionCreate, { ...base, sessionDate: "2026-11-07" }))).toHaveProperty("sessionDate");
    expect(fieldErrors(() => parseInput(SessionCreate, { ...base, sessionDate: "2026-12-09" }))).toHaveProperty("sessionDate");
    expect(fieldErrors(() => parseInput(SessionCreate, { ...base, sessionDate: "2026-12-08", mimeType: "video/mp4" }))).toHaveProperty("mimeType");
  });

  it("요약 수정: 숙제 10개·내용 200자·빈도 50자", () => {
    const hw = (n: number) => Array.from({ length: n }, () => ({ content: "그림 카드 읽기" }));
    const base = { activities: [], childResponse: "", nextGoal: "" };
    expect(parseInput(SummaryUpdate, { ...base, homework: hw(10) }).homework).toHaveLength(10);
    expect(fieldErrors(() => parseInput(SummaryUpdate, { ...base, homework: hw(11) }))).toHaveProperty("homework");
    expect(fieldErrors(() => parseInput(SummaryUpdate, { ...base, homework: [{ content: "" }] }))).toHaveProperty("homework.0.content");
    expect(fieldErrors(() => parseInput(SummaryUpdate, { ...base, homework: [{ content: "a", frequency: "x".repeat(51) }] }))).toHaveProperty("homework.0.frequency");
    expect(fieldErrors(() => parseInput(SummaryUpdate, { ...base, childResponse: "x".repeat(1001), homework: [] }))).toHaveProperty("childResponse");
  });

  it("알림 시각은 30분 단위", () => {
    expect(parseInput(SettingsUpdate, { notifyTime: "20:30" })).toEqual({ notifyTime: "20:30" });
    expect(fieldErrors(() => parseInput(SettingsUpdate, { notifyTime: "20:15" }))).toHaveProperty("notifyTime");
  });

  it("이벤트 props는 짧은 값만", () => {
    expect(parseInput(EventBody, { name: "homework_checked", props: { homeworkId: "h1" } }).props).toEqual({ homeworkId: "h1" });
    expect(fieldErrors(() => parseInput(EventBody, { name: "x", props: { transcript: "가".repeat(101) } }))).toHaveProperty("props.transcript");
  });
});
