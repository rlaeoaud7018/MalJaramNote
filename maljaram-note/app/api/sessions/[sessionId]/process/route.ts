import { after } from "next/server";
import { authed, handler, idOr404, type Params } from "@/lib/http";
import { SessionPipeline } from "@/lib/pipeline/session-pipeline";
import { SessionRepo } from "@/lib/repo/session-repo";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/validation/api-error";

export const maxDuration = 300;

// ProcessRoute · FNC-P-001·006: 처리 시작·재처리
export const POST = handler(async (_req: Request, { params }: Params<"sessionId">) => {
  const id = idOr404((await params).sessionId, "SESSION_NOT_FOUND");
  const { db } = await authed();
  const repo = new SessionRepo(db);

  const row = await repo.getRow(id); // 타인 회기면 404
  if (!row.audio_path) throw new ApiError(410, "AUDIO_DELETED");

  // 조건부 update로 처리 권한 선점(E-11 중복 실행 방지)
  if (!(await repo.claimForProcessing(id))) throw new ApiError(409, "ALREADY_PROCESSING");

  // 202 먼저 응답, 처리는 응답 뒤에 이어서 실행(E-03 504 해결). 사용자 토큰 만료와 무관하게 관리자 클라이언트로 처리
  after(() => new SessionPipeline(createAdminClient()).run(id));
  return Response.json({ status: "TRANSCRIBING" }, { status: 202 });
});
