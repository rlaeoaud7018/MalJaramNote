import { authed, handler } from "@/lib/http";
import { HomeworkRepo } from "@/lib/repo/homework-repo";
import { parseInput } from "@/lib/validation/api-error";
import { HomeworkRange } from "@/lib/validation/schemas";

// HomeworkRoute · FNC-A-016: 기간별 숙제와 진행률
export const GET = handler(async (req: Request) => {
  const { db, userId } = await authed();
  const range = parseInput(HomeworkRange, new URL(req.url).searchParams.get("range") ?? undefined);
  const items = await new HomeworkRepo(db).listByRange(userId, range);
  return Response.json({ items, progress: { done: items.filter((h) => h.isDone).length, total: items.length } });
});
