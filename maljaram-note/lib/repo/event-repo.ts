import { check, type Client } from "./types";

export class EventRepo {
  constructor(private db: Client) {}

  async insert(userId: string, name: string, props: Record<string, unknown>): Promise<void> {
    check(await this.db.from("event_logs").insert({ user_id: userId, event_name: name, props }), "events.insert");
  }

  // 관리자 클라이언트 전용(event_logs는 사용자 select 불가)
  async countByUser(userId: string, name: string): Promise<number> {
    const r = await this.db.from("event_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("event_name", name);
    if (r.error) check(r, "events.count");
    return r.count ?? 0;
  }
}
