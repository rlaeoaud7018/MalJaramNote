import { check, one, type Client } from "./types";

export type Settings = { nickname: string | null; autoDeleteAudio: boolean; notifyHomework: boolean; notifyTime: string };

const toSettings = (r: { nickname: string | null; auto_delete_audio: boolean; notify_homework: boolean; notify_time: string }): Settings => ({
  nickname: r.nickname,
  autoDeleteAudio: r.auto_delete_audio,
  notifyHomework: r.notify_homework,
  notifyTime: r.notify_time.slice(0, 5),
});

export class ProfileRepo {
  constructor(private db: Client) {}

  async getSettings(userId: string): Promise<Settings> {
    const r = await this.db.from("profiles").select("nickname, auto_delete_audio, notify_homework, notify_time").eq("id", userId).single();
    return toSettings(one(r, "profiles.get"));
  }

  async updateSettings(userId: string, s: Partial<Omit<Settings, "nickname">>): Promise<Settings> {
    const patch: Record<string, unknown> = {};
    if (s.autoDeleteAudio !== undefined) patch.auto_delete_audio = s.autoDeleteAudio;
    if (s.notifyHomework !== undefined) patch.notify_homework = s.notifyHomework;
    if (s.notifyTime !== undefined) patch.notify_time = s.notifyTime;
    const r = await this.db
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("nickname, auto_delete_audio, notify_homework, notify_time")
      .single();
    return toSettings(one(r, "profiles.update"));
  }

  // Cron(관리자 클라이언트): 알림 시각이 지금 슬롯인 보호자
  async listDueForReminder(slot: string): Promise<string[]> {
    const r = await this.db.from("profiles").select("id").eq("notify_homework", true).eq("notify_time", `${slot}:00`);
    return (check(r, "profiles.due") ?? []).map((p: { id: string }) => p.id);
  }
}
