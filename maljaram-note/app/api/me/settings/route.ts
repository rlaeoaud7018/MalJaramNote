import { authed, handler } from "@/lib/http";
import { ProfileRepo } from "@/lib/repo/profile-repo";
import { parseInput, readJson } from "@/lib/validation/api-error";
import { SettingsUpdate } from "@/lib/validation/schemas";

// MeRoute · FNC-A-017: 원본 자동 삭제·숙제 알림 설정
export const PATCH = handler(async (req: Request) => {
  const { db, userId } = await authed();
  const input = parseInput(SettingsUpdate, await readJson(req));
  return Response.json(await new ProfileRepo(db).updateSettings(userId, input));
});
