import type { Summary } from "@/lib/validation/schemas";
import { HW_COLS, toHomework, type Homework } from "./homework-repo";
import { check, notFound, type Client, type SessionStatus } from "./types";

export type SessionRow = {
  id: string;
  child_id: string;
  user_id: string;
  session_date: string;
  status: SessionStatus;
  audio_path: string | null;
  duration_sec: number | null;
  transcript: string | null;
  error_message: string | null;
  updated_at: string;
  created_at: string;
};

export type SummaryView = { activities: string[]; childResponse: string; nextGoal: string; edited: boolean };

export type SessionDetail = {
  id: string;
  childId: string;
  sessionDate: string;
  status: SessionStatus;
  durationSec: number | null;
  errorMessage: string | null;
  audioPath: string | null;
  transcript: string | null;
  summary: SummaryView | null;
  homework: Homework[];
};

export type TimelineItem = { id: string; sessionDate: string; status: SessionStatus; firstActivity: string | null; createdAt: string };

// 커서 = "session_date|created_at|id" (정렬 키 그대로)
export const encodeCursor = (i: { sessionDate: string; createdAt: string; id: string }) =>
  Buffer.from(`${i.sessionDate}|${i.createdAt}|${i.id}`).toString("base64url");
export function decodeCursor(c: string): { date: string; createdAt: string; id: string } | null {
  const parts = Buffer.from(c, "base64url").toString().split("|");
  // 필터 문자열에 그대로 들어가므로 형식을 엄격히 확인한다
  if (parts.length !== 3 || !/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) return null;
  if (!/^[\d\-T:.+Z]+$/.test(parts[1]) || !/^[0-9a-f-]{36}$/.test(parts[2])) return null;
  return { date: parts[0], createdAt: parts[1], id: parts[2] };
}

export class SessionRepo {
  constructor(private db: Client) {}

  async create(s: { id: string; userId: string; childId: string; sessionDate: string; audioPath: string }): Promise<void> {
    const r = await this.db.from("sessions").insert({
      id: s.id,
      user_id: s.userId,
      child_id: s.childId,
      session_date: s.sessionDate,
      consent_confirmed: true,
      audio_path: s.audioPath,
    });
    check(r, "sessions.create");
  }

  // FNC-A-011: 회기 날짜 최신순 → 등록 최신순, 커서 기반 20개
  async list(childId: string, size: number, cursor: string | null): Promise<{ items: TimelineItem[]; nextCursor: string | null }> {
    let q = this.db
      .from("sessions")
      .select("id, session_date, status, created_at, session_summaries(activities)")
      .eq("child_id", childId)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(size + 1);
    const c = cursor ? decodeCursor(cursor) : null;
    if (c) {
      q = q.or(
        `session_date.lt.${c.date},and(session_date.eq.${c.date},created_at.lt."${c.createdAt}"),and(session_date.eq.${c.date},created_at.eq."${c.createdAt}",id.lt.${c.id})`,
      );
    }
    const rows = check(await q, "sessions.list") as {
      id: string;
      session_date: string;
      status: SessionStatus;
      created_at: string;
      session_summaries: { activities: string[] } | { activities: string[] }[] | null;
    }[];
    const items = rows.slice(0, size).map((r) => {
      const s = Array.isArray(r.session_summaries) ? r.session_summaries[0] : r.session_summaries;
      return { id: r.id, sessionDate: r.session_date, status: r.status, firstActivity: s?.activities?.[0] ?? null, createdAt: r.created_at };
    });
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > size && last ? encodeCursor(last) : null };
  }

  async getRow(id: string): Promise<SessionRow> {
    const r = await this.db
      .from("sessions")
      .select("id, child_id, user_id, session_date, status, audio_path, duration_sec, transcript, error_message, updated_at, created_at")
      .eq("id", id)
      .maybeSingle();
    return check(r, "sessions.get") ?? notFound("SESSION_NOT_FOUND");
  }

  async get(id: string): Promise<SessionDetail> {
    const row = await this.getRow(id);
    const [s, h] = await Promise.all([
      this.db.from("session_summaries").select("activities, child_response, next_goal, edited").eq("session_id", id).maybeSingle(),
      this.db.from("homework").select(HW_COLS).eq("session_id", id).order("sort_order"),
    ]);
    const sum = check(s, "summaries.get");
    return {
      id: row.id,
      childId: row.child_id,
      sessionDate: row.session_date,
      status: row.status,
      durationSec: row.duration_sec,
      errorMessage: row.error_message,
      audioPath: row.audio_path,
      transcript: row.transcript,
      summary: sum
        ? { activities: sum.activities ?? [], childResponse: sum.child_response ?? "", nextGoal: sum.next_goal ?? "", edited: sum.edited }
        : null,
      homework: (check(h, "homework.bySession") as Parameters<typeof toHomework>[0][]).map(toHomework),
    };
  }

  // 조건부 update로 처리 권한 선점(E-11). 0행이면 다른 요청이 이미 처리 중
  async claimForProcessing(id: string): Promise<boolean> {
    const r = await this.db
      .from("sessions")
      .update({ status: "TRANSCRIBING", processing_started_at: new Date().toISOString(), processing_done_at: null, error_message: null })
      .eq("id", id)
      .in("status", ["UPLOADED", "FAILED"])
      .not("audio_path", "is", null)
      .select("id");
    return (check(r, "sessions.claim") ?? []).length === 1;
  }

  async setStatus(id: string, status: SessionStatus): Promise<void> {
    check(await this.db.from("sessions").update({ status }).eq("id", id), "sessions.status");
  }

  async saveTranscript(id: string, transcript: string, durationSec: number | null): Promise<void> {
    const r = await this.db
      .from("sessions")
      .update({ transcript, duration_sec: durationSec, status: "SUMMARIZING" })
      .eq("id", id);
    check(r, "sessions.transcript");
  }

  // FNC-P-004: RPC 한 번(트랜잭션)으로 요약·숙제 저장
  async saveSummary(id: string, summary: Summary, model: string, promptVersion: string): Promise<void> {
    const r = await this.db.rpc("save_summary", { p_session_id: id, p_summary: summary, p_model: model, p_prompt: promptVersion });
    check(r, "rpc.save_summary");
  }

  // FNC-A-013: id 없는 숙제=추가, 빠진 숙제=삭제
  async updateSummary(id: string, payload: unknown): Promise<void> {
    const r = await this.db.rpc("update_summary", { p_session_id: id, p_payload: payload });
    if (r.error?.message.includes("SESSION_NOT_FOUND")) notFound("SESSION_NOT_FOUND");
    check(r, "rpc.update_summary");
  }

  async markDone(id: string): Promise<void> {
    const r = await this.db.from("sessions").update({ status: "DONE", processing_done_at: new Date().toISOString() }).eq("id", id);
    check(r, "sessions.done");
  }

  async markFailed(id: string, message: string): Promise<void> {
    const r = await this.db
      .from("sessions")
      .update({ status: "FAILED", error_message: message, processing_done_at: new Date().toISOString() })
      .eq("id", id);
    check(r, "sessions.failed");
  }

  async markAudioDeleted(id: string): Promise<void> {
    const r = await this.db.from("sessions").update({ audio_path: null, audio_deleted_at: new Date().toISOString() }).eq("id", id);
    check(r, "sessions.audioDeleted");
  }

  async delete(id: string): Promise<void> {
    check(await this.db.from("sessions").delete().eq("id", id), "sessions.delete");
  }

  // Cron: 자동 삭제 ON인데 원본이 남은 DONE 회기(FNC-P-005 재시도)
  async listPendingAudioDeletion(limit = 50): Promise<{ id: string; audio_path: string }[]> {
    const r = await this.db
      .from("sessions")
      .select("id, audio_path, profiles!inner(auto_delete_audio)")
      .eq("status", "DONE")
      .not("audio_path", "is", null)
      .eq("profiles.auto_delete_audio", true)
      .limit(limit);
    return check(r, "sessions.pendingAudio") as unknown as { id: string; audio_path: string }[];
  }

  async audioPathsByUser(userId: string): Promise<string[]> {
    const r = await this.db.from("sessions").select("audio_path").eq("user_id", userId).not("audio_path", "is", null);
    return (check(r, "sessions.audioPaths") as { audio_path: string }[]).map((x) => x.audio_path);
  }
}
