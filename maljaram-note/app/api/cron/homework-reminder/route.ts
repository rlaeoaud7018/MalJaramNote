import { handler } from "@/lib/http";
import { AudioJanitor } from "@/lib/pipeline/audio-janitor";
import { PushNotifier } from "@/lib/push/push-notifier";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/validation/api-error";

export const dynamic = "force-dynamic";

// CronReminderRoute · FNC-O-003: 30분마다 Vercel Cron이 호출. 숙제 알림 + 원본 삭제 재시도
export const GET = handler(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new ApiError(401, "UNAUTHORIZED");

  const admin = createAdminClient();
  const push = await new PushNotifier(admin).sendDueReminders();
  const audioRetried = await new AudioJanitor(admin).retryPending();
  return Response.json({ ...push, audioRetried });
});
