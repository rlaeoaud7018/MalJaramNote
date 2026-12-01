import { z } from "zod";

// 15 API 명세서 · 공통 오류 응답
const MESSAGES: Record<string, string> = {
  INVALID_INPUT: "입력값을 확인해 주세요.",
  UNAUTHORIZED: "로그인이 필요합니다.",
  CONSENT_REQUIRED: "치료사 녹음 동의를 확인해 주세요.",
  CHILD_NOT_FOUND: "아이 정보를 찾을 수 없어요.",
  SESSION_NOT_FOUND: "회기를 찾을 수 없어요.",
  HOMEWORK_NOT_FOUND: "숙제를 찾을 수 없어요.",
  CHILD_LIMIT: "아이는 한 명만 등록할 수 있어요.",
  ALREADY_PROCESSING: "이미 처리 중이에요.",
  AUDIO_DELETED: "음성 원본이 삭제되어 다시 처리할 수 없어요.",
  FILE_TOO_LARGE: "25MB 이하 파일만 올릴 수 있어요.",
  QUOTA_EXCEEDED: "테스트 기간 처리 횟수(10회)를 모두 사용했어요.",
  AI_PROVIDER_ERROR: "AI 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
  STORAGE_ERROR: "파일 저장소에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
  CONFIRM_MISMATCH: "'탈퇴'를 정확히 입력해 주세요.",
  UNKNOWN_EVENT: "허용되지 않은 이벤트입니다.",
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(MESSAGES[code] ?? code);
  }
}

export function apiError(status: number, code: string, fieldErrors?: Record<string, string>): Response {
  const error: Record<string, unknown> = { code, message: MESSAGES[code] ?? code };
  if (fieldErrors) error.fieldErrors = fieldErrors;
  return Response.json({ error }, { status });
}

// zod 검증. 실패하면 400 INVALID_INPUT{fieldErrors}를 던진다
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  throw new ApiError(400, "INVALID_INPUT", fieldErrors);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "INVALID_INPUT", { _: "JSON 본문이 필요합니다." });
  }
}

// 라우트 공통: ApiError는 응답으로, 그 밖의 오류는 로그 후 500
export function toResponse(e: unknown): Response {
  if (e instanceof ApiError) return apiError(e.status, e.code, e.fieldErrors);
  console.error(e);
  return Response.json({ error: { code: "INTERNAL", message: "일시적인 오류가 발생했어요." } }, { status: 500 });
}
