import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { Summarizer, SummaryInvalidError } from "@/lib/ai/summarizer";

const valid = {
  activities: ["그림 카드로 2어절 말하기"],
  child_response: "'사과 줘'를 세 번 말했어요.",
  homework: [{ content: "그림책 보며 2어절로 말하기", frequency: "하루 2번" }],
  next_goal: "3어절 문장 시도",
};

function fakeClient(responses: unknown[]) {
  const parse = vi.fn();
  responses.forEach((r) => parse.mockResolvedValueOnce(r));
  const client = { beta: { messages: { parse } } } as unknown as Anthropic;
  return { client, parse };
}

describe("Summarizer (FNC-P-003)", () => {
  it("구조화 출력을 요청하고 검증된 JSON을 돌려준다", async () => {
    const { client, parse } = fakeClient([{ stop_reason: "end_turn", parsed_output: valid }]);
    const out = await new Summarizer(client).summarize("원문", "도윤이", "SPEECH");
    expect(out).toEqual(valid);
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.output_config.effort).toBe("medium");
    expect(req.output_config.format).toBeDefined();
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req).not.toHaveProperty("tool_choice");
    expect(req.system).toContain("도윤이");
    expect(req.system).toContain("언어치료");
  });

  it("스키마 불일치면 1회 다시 요청한다", async () => {
    const { client, parse } = fakeClient([
      { stop_reason: "end_turn", parsed_output: null },
      { stop_reason: "end_turn", parsed_output: valid },
    ]);
    await expect(new Summarizer(client).summarize("원문", "도윤이", "SPEECH")).resolves.toEqual(valid);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("2회 모두 실패하면 SUMMARY_INVALID", async () => {
    const tooMany = { ...valid, homework: Array.from({ length: 11 }, () => valid.homework[0]) };
    const { client, parse } = fakeClient([
      { stop_reason: "end_turn", parsed_output: tooMany },
      { stop_reason: "max_tokens", parsed_output: null },
    ]);
    await expect(new Summarizer(client).summarize("원문", "도윤이", "SPEECH")).rejects.toBeInstanceOf(SummaryInvalidError);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("거절 응답은 재시도하지 않는다", async () => {
    const { client, parse } = fakeClient([{ stop_reason: "refusal", parsed_output: null }]);
    await expect(new Summarizer(client).summarize("원문", "도윤이", "SPEECH")).rejects.toThrow("refusal");
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
