import { authed, handler } from "@/lib/http";
import { EventLogger } from "@/lib/ops/event-logger";
import { parseInput, readJson } from "@/lib/validation/api-error";
import { EventBody } from "@/lib/validation/schemas";

// EventsRoute · FNC-O-001: 클라이언트 이벤트 기록
export const POST = handler(async (req: Request) => {
  const { db, userId } = await authed();
  const { name, props } = parseInput(EventBody, await readJson(req));
  await new EventLogger(db).log(userId, name, props);
  return new Response(null, { status: 204 });
});
