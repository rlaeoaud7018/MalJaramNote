import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/validation/api-error";

export type Client = SupabaseClient;

export type SessionStatus = "UPLOADED" | "TRANSCRIBING" | "SUMMARIZING" | "DONE" | "FAILED";

// Supabase 오류는 그대로 노출하지 않고 로그만 남긴다
export function check<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) {
    console.error(`[db] ${what}: ${r.error.message}`);
    throw new Error(`DB_ERROR:${what}`);
  }
  return r.data;
}

export function notFound(code: "CHILD_NOT_FOUND" | "SESSION_NOT_FOUND" | "HOMEWORK_NOT_FOUND"): never {
  throw new ApiError(404, code);
}

// .single() 결과용: 오류가 없으면 행이 반드시 있다
export function one<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  const data = check(r, what);
  if (data === null) throw new Error(`DB_ERROR:${what}:empty`);
  return data;
}
