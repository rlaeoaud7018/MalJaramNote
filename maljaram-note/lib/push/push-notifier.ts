import webpush from "web-push";
import { serverEnv } from "@/lib/env";
import { HomeworkRepo } from "@/lib/repo/homework-repo";
import { ProfileRepo } from "@/lib/repo/profile-repo";
import { PushSubRepo, type PushSub } from "@/lib/repo/push-sub-repo";
import type { Client } from "@/lib/repo/types";
import { kstSlot } from "@/lib/time";

type Send = (sub: PushSub, payload: string) => Promise<unknown>;

const defaultSend: Send = (sub, payload) => {
  webpush.setVapidDetails(serverEnv("VAPID_SUBJECT"), serverEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"), serverEnv("VAPID_PRIVATE_KEY"));
  return webpush.sendNotification(sub, payload, { TTL: 60 * 60 });
};

// FNC-O-003: 알림 시각이 된 보호자에게 이번 주 미완료 숙제 수를 보낸다
export class PushNotifier {
  private subs: PushSubRepo;
  constructor(private admin: Client, private send: Send = defaultSend) {
    this.subs = new PushSubRepo(admin);
  }

  async sendDueReminders(now = new Date()): Promise<{ sent: number; skipped: number; removed: number }> {
    const result = { sent: 0, skipped: 0, removed: 0 };
    const users = await new ProfileRepo(this.admin).listDueForReminder(kstSlot(now));
    const homework = new HomeworkRepo(this.admin);

    for (const userId of users) {
      const pending = await homework.pendingCount(userId, now);
      const subs = await this.subs.listByUser(userId);
      if (pending === 0 || subs.length === 0) {
        result.skipped++;
        continue;
      }
      const payload = JSON.stringify({
        title: "오늘 숙제 확인해요",
        body: `이번 주 남은 숙제 ${pending}개가 있어요.`,
        url: "/homework?from=push",
      });
      for (const sub of subs) {
        try {
          await this.send(sub, payload);
          result.sent++;
        } catch (e) {
          if (await this.removeGone(sub, e)) result.removed++;
          else console.error("[push] 발송 실패", (e as Error).message);
        }
      }
    }
    return result;
  }

  // 410/404: 구독이 만료된 기기 → 삭제
  async removeGone(sub: PushSub, e: unknown): Promise<boolean> {
    const status = (e as { statusCode?: number }).statusCode;
    if (status !== 410 && status !== 404) return false;
    await this.subs.remove(sub.endpoint);
    return true;
  }
}
