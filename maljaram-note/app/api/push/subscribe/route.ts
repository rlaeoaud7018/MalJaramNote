import { authed, handler } from "@/lib/http";
import { PushSubRepo } from "@/lib/repo/push-sub-repo";
import { parseInput, readJson } from "@/lib/validation/api-error";
import { PushSubscribe } from "@/lib/validation/schemas";

// PushRoute · FNC-A-019: Web Push 구독 저장
export const POST = handler(async (req: Request) => {
  const { db, userId } = await authed();
  const sub = parseInput(PushSubscribe, await readJson(req));
  await new PushSubRepo(db).upsert(userId, sub);
  return new Response(null, { status: 201 });
});
