import { authed, handler, idOr404, type Params } from "@/lib/http";
import { EventLogger } from "@/lib/ops/event-logger";
import { SessionRepo } from "@/lib/repo/session-repo";
import { parseInput, readJson } from "@/lib/validation/api-error";
import { SummaryUpdate } from "@/lib/validation/schemas";

// SummaryRoute · FNC-A-013: 요약·숙제 일괄 수정(RPC 트랜잭션)
export const PUT = handler(async (req: Request, { params }: Params<"sessionId">) => {
  const id = idOr404((await params).sessionId, "SESSION_NOT_FOUND");
  const { db, userId } = await authed();
  const input = parseInput(SummaryUpdate, await readJson(req));
  const repo = new SessionRepo(db);
  await repo.getRow(id); // 타인 회기면 404
  await repo.updateSummary(id, input);
  await new EventLogger(db).log(userId, "summary_edited", { sessionId: id });
  const { audioPath, ...detail } = await repo.get(id);
  return Response.json({ ...detail, audioDeleted: !audioPath });
});
