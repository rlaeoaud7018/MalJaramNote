import { authed, handler, idOr404, type Params } from "@/lib/http";
import { EventLogger } from "@/lib/ops/event-logger";
import { HomeworkRepo } from "@/lib/repo/homework-repo";
import { parseInput, readJson } from "@/lib/validation/api-error";
import { HomeworkCheck } from "@/lib/validation/schemas";

// HomeworkRoute · FNC-A-015: 숙제 완료 체크·해제
export const PATCH = handler(async (req: Request, { params }: Params<"homeworkId">) => {
  const id = idOr404((await params).homeworkId, "HOMEWORK_NOT_FOUND");
  const { db, userId } = await authed();
  const { isDone } = parseInput(HomeworkCheck, await readJson(req));
  const result = await new HomeworkRepo(db).setDone(id, isDone);
  if (isDone) await new EventLogger(db).log(userId, "homework_checked", { homeworkId: id });
  return Response.json(result);
});
