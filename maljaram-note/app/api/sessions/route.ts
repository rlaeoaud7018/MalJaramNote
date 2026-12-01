import { authed, handler } from "@/lib/http";
import { EventLogger } from "@/lib/ops/event-logger";
import { RateLimiter } from "@/lib/ops/rate-limiter";
import { AUDIO_BUCKET } from "@/lib/pipeline/audio-janitor";
import { ChildRepo } from "@/lib/repo/child-repo";
import { SessionRepo } from "@/lib/repo/session-repo";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, parseInput, readJson } from "@/lib/validation/api-error";
import { MAX_AUDIO_BYTES, SessionCreate } from "@/lib/validation/schemas";
import { z } from "zod";

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3" };

// SessionsRoute · FNC-A-009: 회기 생성 + Signed Upload URL. 음성은 브라우저가 Storage로 직접 올린다
export const POST = handler(async (req: Request) => {
  const { db, userId } = await authed();
  const body = (await readJson(req)) as Record<string, unknown>;
  // 동의·크기는 명세상 별도 코드로 응답하므로 형식 검증보다 먼저 본다
  if (body?.consentConfirmed !== true) throw new ApiError(403, "CONSENT_REQUIRED");
  if (typeof body.fileSize === "number" && body.fileSize > MAX_AUDIO_BYTES) throw new ApiError(413, "FILE_TOO_LARGE");
  const input = parseInput(SessionCreate, body);

  await new ChildRepo(db).get(input.childId); // 타인 아이면 404
  await new RateLimiter(createAdminClient()).assertQuota(userId);

  const sessionId = crypto.randomUUID();
  const path = `${userId}/${sessionId}.${EXT[input.mimeType]}`;
  const sessions = new SessionRepo(db);
  await sessions.create({ id: sessionId, userId, childId: input.childId, sessionDate: input.sessionDate, audioPath: path });

  const signed = await db.storage.from(AUDIO_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    await sessions.delete(sessionId).catch(() => {});
    throw new ApiError(502, "STORAGE_ERROR");
  }
  await new EventLogger(db).log(userId, "session_uploaded", { sessionId });

  // Supabase Signed Upload URL의 유효 시간은 2시간으로 고정되어 있다
  return Response.json({ sessionId, upload: { path, signedUrl: signed.data.signedUrl, expiresIn: 7200 } }, { status: 201 });
});

const ListQuery = z.object({
  childId: z.uuid({ error: "아이 ID가 올바르지 않아요." }),
  cursor: z.string().max(300).optional(),
  size: z.coerce.number().int().min(1).max(50).default(20),
});

// SessionsRoute · FNC-A-011: 회기 타임라인
export const GET = handler(async (req: Request) => {
  const { db } = await authed();
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const input = parseInput(ListQuery, q);
  await new ChildRepo(db).get(input.childId);
  return Response.json(await new SessionRepo(db).list(input.childId, input.size, input.cursor ?? null));
});
