import { check, type Client } from "./types";

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

export class PushSubRepo {
  constructor(private db: Client) {}

  // 같은 기기(endpoint)로 다시 구독하면 소유자·키를 갱신
  async upsert(userId: string, s: PushSub): Promise<void> {
    const r = await this.db.from("push_subscriptions").upsert({ user_id: userId, endpoint: s.endpoint, keys: s.keys }, { onConflict: "endpoint" });
    check(r, "push.upsert");
  }

  async listByUser(userId: string): Promise<PushSub[]> {
    const r = await this.db.from("push_subscriptions").select("endpoint, keys").eq("user_id", userId);
    return check(r, "push.list") as PushSub[];
  }

  async remove(endpoint: string): Promise<void> {
    check(await this.db.from("push_subscriptions").delete().eq("endpoint", endpoint), "push.remove");
  }
}
