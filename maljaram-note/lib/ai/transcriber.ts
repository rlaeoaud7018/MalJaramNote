import OpenAI, { toFile } from "openai";
import { GLOSSARY } from "./glossary";

export type Transcript = { text: string; durationSec: number | null };

// FNC-P-002: Whisper 받아쓰기. 429·5xx는 SDK가 지수 백오프로 2회 재시도
export class Transcriber {
  constructor(private client: OpenAI = new OpenAI({ maxRetries: 2, timeout: 120_000 })) {}

  buildPrompt(alias: string): string {
    return `${alias}. ${GLOSSARY.join(", ")}.`;
  }

  async transcribe(audio: Blob, fileName: string, alias: string): Promise<Transcript> {
    const res = await this.client.audio.transcriptions.create({
      file: await toFile(audio, fileName),
      model: "whisper-1",
      language: "ko",
      prompt: this.buildPrompt(alias),
      response_format: "verbose_json",
    });
    return { text: res.text.trim(), durationSec: typeof res.duration === "number" ? Math.round(res.duration) : null };
  }
}
