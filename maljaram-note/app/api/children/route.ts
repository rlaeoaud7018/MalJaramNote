import { authed, handler } from "@/lib/http";
import { ChildRepo } from "@/lib/repo/child-repo";
import { ApiError, parseInput, readJson } from "@/lib/validation/api-error";
import { ChildCreate } from "@/lib/validation/schemas";

// ChildrenRoute · FNC-A-004: 아이 등록(보호자당 1명)
export const POST = handler(async (req: Request) => {
  const { db, userId } = await authed();
  const input = parseInput(ChildCreate, await readJson(req));
  const repo = new ChildRepo(db);
  if ((await repo.countByUser(userId)) >= 1) throw new ApiError(409, "CHILD_LIMIT");
  const child = await repo.create(userId, input);
  return Response.json(child, { status: 201 });
});
