import { authed, handler, idOr404, type Params } from "@/lib/http";
import { SessionRepo } from "@/lib/repo/session-repo";

// StatusRoute · FNC-A-010: 처리 단계 폴링
export const GET = handler(async (_req: Request, { params }: Params<"sessionId">) => {
  const id = idOr404((await params).sessionId, "SESSION_NOT_FOUND");
  const { db } = await authed();
  const s = await new SessionRepo(db).getRow(id);
  return Response.json(
    { status: s.status, updatedAt: s.updated_at, errorMessage: s.error_message, audioDeleted: !s.audio_path },
    { headers: { "cache-control": "no-store" } },
  );
});
