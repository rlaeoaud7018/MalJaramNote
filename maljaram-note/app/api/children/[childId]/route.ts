import { authed, handler, idOr404, type Params } from "@/lib/http";
import { ChildRepo } from "@/lib/repo/child-repo";
import { parseInput, readJson } from "@/lib/validation/api-error";
import { ChildUpdate } from "@/lib/validation/schemas";

// ChildrenRoute · FNC-A-004: 아이 정보 수정(보낸 필드만)
export const PATCH = handler(async (req: Request, { params }: Params<"childId">) => {
  const id = idOr404((await params).childId, "CHILD_NOT_FOUND");
  const { db } = await authed();
  const input = parseInput(ChildUpdate, await readJson(req));
  return Response.json(await new ChildRepo(db).update(id, input));
});
