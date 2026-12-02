import type { Client } from "@/lib/repo/types";
import { SessionRepo } from "@/lib/repo/session-repo";

export const AUDIO_BUCKET = "audio";

// FNC-P-005: 음성 원본 삭제. 실패해도 회기 상태는 바꾸지 않고 Cron이 30분마다 다시 시도한다
export class AudioJanitor {
  private sessions: SessionRepo;
  constructor(private db: Client) {
    this.sessions = new SessionRepo(db);
  }

  async removeAudio(sessionId: string, path: string): Promise<boolean> {
    const { error } = await this.db.storage.from(AUDIO_BUCKET).remove([path]);
    if (error) {
      console.error(`[audio] 삭제 실패 ${sessionId}: ${error.message}`);
      return false;
    }
    await this.sessions.markAudioDeleted(sessionId);
    return true;
  }

  async retryPending(): Promise<number> {
    let done = 0;
    for (const s of await this.sessions.listPendingAudioDeletion()) {
      if (await this.removeAudio(s.id, s.audio_path)) done++;
    }
    return done;
  }
}
