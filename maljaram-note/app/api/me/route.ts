import { authed, handler } from "@/lib/http";
import { AUDIO_BUCKET } from "@/lib/pipeline/audio-janitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, parseInput, readJson } from "@/lib/validation/api-error";
import { DeleteMe } from "@/lib/validation/schemas";

// MeRoute · FNC-A-018: 회원 탈퇴. 음성 파일 → 계정(나머지 데이터는 CASCADE) 순서로 즉시 삭제
export const DELETE = handler(async (req: Request) => {
  const { db, userId } = await authed();
  const { confirm } = parseInput(DeleteMe, await readJson(req));
  if (confirm !== "탈퇴") throw new ApiError(400, "CONFIRM_MISMATCH");

  const admin = createAdminClient();
  const storage = admin.storage.from(AUDIO_BUCKET);
  for (;;) {
    const { data, error } = await storage.list(userId, { limit: 100 });
    if (error) throw new ApiError(502, "STORAGE_ERROR");
    if (!data.length) break;
    const rm = await storage.remove(data.map((f) => `${userId}/${f.name}`));
    if (rm.error) throw new ApiError(502, "STORAGE_ERROR");
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new ApiError(502, "STORAGE_ERROR");
  await db.auth.signOut().catch(() => {});
  return new Response(null, { status: 204 });
});
