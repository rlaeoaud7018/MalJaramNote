import { authed, handler, idOr404, type Params } from "@/lib/http";
import { AUDIO_BUCKET } from "@/lib/pipeline/audio-janitor";
import { SessionRepo } from "@/lib/repo/session-repo";
import { ApiError } from "@/lib/validation/api-error";

// SessionRoute · FNC-A-012: 회기 상세(요약·숙제·원문·음성 재생 URL 5분)
export const GET = handler(async (_req: Request, { params }: Params<"sessionId">) => {
  const id = idOr404((await params).sessionId, "SESSION_NOT_FOUND");
  const { db } = await authed();
  const { audioPath, ...detail } = await new SessionRepo(db).get(id);
  let audioUrl: string | null = null;
  if (audioPath && detail.status === "DONE") {
    const s = await db.storage.from(AUDIO_BUCKET).createSignedUrl(audioPath, 300);
    audioUrl = s.data?.signedUrl ?? null;
  }
  return Response.json({ ...detail, audioUrl, audioDeleted: !audioPath });
});

// SessionRoute · FNC-A-014: 회기 삭제. 음성 → 행 순서(요약·숙제는 CASCADE)
export const DELETE = handler(async (_req: Request, { params }: Params<"sessionId">) => {
  const id = idOr404((await params).sessionId, "SESSION_NOT_FOUND");
  const { db } = await authed();
  const repo = new SessionRepo(db);
  const row = await repo.getRow(id);
  if (row.audio_path) {
    const { error } = await db.storage.from(AUDIO_BUCKET).remove([row.audio_path]);
    if (error) throw new ApiError(502, "STORAGE_ERROR");
  }
  await repo.delete(id);
  return new Response(null, { status: 204 });
});
