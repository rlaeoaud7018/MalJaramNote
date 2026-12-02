import { PROMPT_VERSION } from "@/lib/env";
import { Summarizer, SummaryInvalidError } from "@/lib/ai/summarizer";
import { Transcriber } from "@/lib/ai/transcriber";
import { ChildRepo } from "@/lib/repo/child-repo";
import { ProfileRepo } from "@/lib/repo/profile-repo";
import { SessionRepo } from "@/lib/repo/session-repo";
import type { Client } from "@/lib/repo/types";
import { AUDIO_BUCKET, AudioJanitor } from "./audio-janitor";

// 실패 사유는 보호자에게 그대로 보이므로 쉬운 문구로 저장한다(FNC-P-006)
export const FAIL = {
  STORAGE: "녹음 파일을 불러오지 못했어요. 다시 시도해 주세요.",
  STT: "받아쓰기 중 문제가 생겼어요. 다시 시도해 주세요.",
  EMPTY: "녹음에서 말소리를 찾지 못했어요. 녹음 상태를 확인해 주세요.",
  SUMMARY_INVALID: "요약을 만들지 못했어요. 다시 시도해 주세요.",
  SUMMARY: "요약 중 문제가 생겼어요. 다시 시도해 주세요.",
  UNKNOWN: "처리 중 문제가 생겼어요. 다시 시도해 주세요.",
} as const;

class StepError extends Error {
  constructor(public userMessage: string, cause: unknown) {
    super(userMessage, { cause });
  }
}

async function step<T>(message: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw e instanceof StepError ? e : new StepError(message, e);
  }
}

// FNC-P-001: 다운로드 → 받아쓰기 → 요약 → 저장 → (원본 삭제) → DONE
// 처리 권한 선점(claim)은 라우트에서 사용자 권한으로 끝낸 뒤, 백그라운드에서 관리자 클라이언트로 실행한다
export class SessionPipeline {
  private sessions: SessionRepo;
  constructor(
    private db: Client,
    private transcriber = new Transcriber(),
    private summarizer = new Summarizer(),
  ) {
    this.sessions = new SessionRepo(db);
  }

  async run(sessionId: string): Promise<void> {
    try {
      const s = await this.sessions.getRow(sessionId);
      const child = await new ChildRepo(this.db).get(s.child_id);
      const path = s.audio_path!;

      const audio = await step(FAIL.STORAGE, async () => {
        const { data, error } = await this.db.storage.from(AUDIO_BUCKET).download(path);
        if (error || !data) throw error ?? new Error("empty");
        return data;
      });

      const t = await step(FAIL.STT, () => this.transcriber.transcribe(audio, path.split("/").pop()!, child.nickname));
      if (!t.text) throw new StepError(FAIL.EMPTY, null);
      await this.sessions.saveTranscript(sessionId, t.text, t.durationSec);

      const summary = await step(FAIL.SUMMARY, async () => {
        try {
          return await this.summarizer.summarize(t.text, child.nickname, child.therapyType);
        } catch (e) {
          if (e instanceof SummaryInvalidError) throw new StepError(FAIL.SUMMARY_INVALID, e);
          throw e;
        }
      });
      await this.sessions.saveSummary(sessionId, summary, this.summarizer.model, PROMPT_VERSION);

      const settings = await new ProfileRepo(this.db).getSettings(s.user_id);
      if (settings.autoDeleteAudio) await new AudioJanitor(this.db).removeAudio(sessionId, path);

      await this.sessions.markDone(sessionId);
    } catch (e) {
      await this.fail(sessionId, e);
    }
  }

  async fail(sessionId: string, e: unknown): Promise<void> {
    console.error(`[pipeline] ${sessionId} 실패`, e instanceof StepError ? e.cause ?? e : e);
    const message = e instanceof StepError ? e.userMessage : FAIL.UNKNOWN;
    try {
      await this.sessions.markFailed(sessionId, message);
    } catch (e2) {
      console.error(`[pipeline] ${sessionId} FAILED 저장 실패`, e2);
    }
  }
}
