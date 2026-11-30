import { createServerClient, currentUserId, type Db } from "@/lib/supabase/server";
import { ApiError, toResponse } from "@/lib/validation/api-error";

// 로그인 사용자 권한(RLS) 클라이언트와 ID. middleware를 통과했더라도 한 번 더 확인한다
export async function authed(): Promise<{ db: Db; userId: string }> {
  const db = await createServerClient();
  const userId = await currentUserId(db);
  if (!userId) throw new ApiError(401, "UNAUTHORIZED");
  return { db, userId };
}

// 라우트 핸들러 공통 오류 처리
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return toResponse(e);
    }
  };
}

export type Params<K extends string> = { params: Promise<Record<K, string>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 경로 ID가 UUID가 아니면 DB까지 가지 않고 404
export function idOr404(id: string, code: "CHILD_NOT_FOUND" | "SESSION_NOT_FOUND" | "HOMEWORK_NOT_FOUND"): string {
  if (!UUID.test(id)) throw new ApiError(404, code);
  return id;
}
