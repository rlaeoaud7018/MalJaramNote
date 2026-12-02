import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { SUMMARY_MODEL } from "@/lib/env";
import { SummarySchema, type Summary } from "@/lib/validation/schemas";
import { summarySystemPrompt } from "./prompts";

export class SummaryInvalidError extends Error {
  constructor(reason: string) {
    super(`SUMMARY_INVALID: ${reason}`);
  }
}

// FNC-P-003: 원문 → 4섹션 JSON. 구조화 출력(output_config.format)으로 스키마를 강제하고 zod로 한 번 더 검증한다
export class Summarizer {
  constructor(private client: Anthropic = new Anthropic({ maxRetries: 2 })) {}

  get model(): string {
    return SUMMARY_MODEL();
  }

  buildSystemPrompt(alias: string, therapyType: string): string {
    return summarySystemPrompt(alias, therapyType);
  }

  // 스키마 불일치·빈 응답이면 1회 다시 요청, 그래도 실패하면 SummaryInvalidError
  async summarize(transcript: string, alias: string, therapyType: string): Promise<Summary> {
    let last = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.client.beta.messages
        .parse({
          model: this.model,
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium", format: betaZodOutputFormat(SummarySchema) },
          system: this.buildSystemPrompt(alias, therapyType),
          messages: [{ role: "user", content: `<transcript>\n${transcript}\n</transcript>` }],
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        })
        .catch((e: unknown) => {
          // SDK의 파싱·검증 실패는 재요청 대상, API 오류는 그대로 올린다
          if (e instanceof Anthropic.APIError) throw e;
          last = e instanceof Error ? e.message : String(e);
          return null;
        });
      if (!res) continue;
      if (res.stop_reason === "refusal") throw new SummaryInvalidError("refusal");
      const checked = SummarySchema.safeParse(res.parsed_output);
      if (checked.success) return checked.data;
      last = res.stop_reason === "max_tokens" ? "max_tokens" : "schema";
    }
    throw new SummaryInvalidError(last);
  }
}
