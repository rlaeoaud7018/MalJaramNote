import { weekRange, type Range } from "@/lib/time";
import { check, notFound, type Client } from "./types";

export type Homework = {
  id: string;
  sessionId: string;
  sessionDate: string;
  content: string;
  frequency: string | null;
  isDone: boolean;
  doneAt: string | null;
};

type Row = {
  id: string;
  session_id: string;
  content: string;
  frequency: string | null;
  is_done: boolean;
  done_at: string | null;
  sessions: { session_date: string } | { session_date: string }[] | null;
};

const dateOf = (s: Row["sessions"]) => (Array.isArray(s) ? s[0]?.session_date : s?.session_date) ?? "";

export const toHomework = (r: Row): Homework => ({
  id: r.id,
  sessionId: r.session_id,
  sessionDate: dateOf(r.sessions),
  content: r.content,
  frequency: r.frequency,
  isDone: r.is_done,
  doneAt: r.done_at,
});

export const HW_COLS = "id, session_id, content, frequency, is_done, done_at, sort_order, sessions!inner(session_date)";

export class HomeworkRepo {
  constructor(private db: Client) {}

  // FNC-A-016: 기간별 목록(회기 날짜 최신순 → 표시 순서). userId로 한 번 더 거른다(관리자 클라이언트에서도 안전)
  async listByRange(userId: string, range: Range, now = new Date()): Promise<Homework[]> {
    let q = this.db.from("homework").select(HW_COLS).eq("user_id", userId);
    const w = weekRange(range, now);
    if (w) q = q.gte("sessions.session_date", w.from).lte("sessions.session_date", w.to);
    const r = await q.order("created_at", { ascending: false }).order("sort_order");
    const rows = check(r, "homework.list") as Row[];
    // 조인 컬럼으로는 상위 행을 정렬할 수 없어 회기 날짜순은 여기서 맞춘다(안정 정렬이라 회기 안 순서 유지)
    return rows.map(toHomework).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  }

  async setDone(id: string, isDone: boolean): Promise<Pick<Homework, "id" | "isDone" | "doneAt">> {
    const r = await this.db
      .from("homework")
      .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id, is_done, done_at")
      .maybeSingle();
    const row = check(r, "homework.setDone") ?? notFound("HOMEWORK_NOT_FOUND");
    return { id: row.id, isDone: row.is_done, doneAt: row.done_at };
  }

  // Cron: 이번 주 미완료 숙제 수
  async pendingCount(userId: string, now = new Date()): Promise<number> {
    const w = weekRange("this_week", now)!;
    const r = await this.db
      .from("homework")
      .select("id, sessions!inner(session_date)", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_done", false)
      .gte("sessions.session_date", w.from)
      .lte("sessions.session_date", w.to);
    if (r.error) check(r, "homework.pending");
    return r.count ?? 0;
  }
}
