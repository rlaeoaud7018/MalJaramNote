// 서버 전용 환경 변수. 없으면 바로 알 수 있게 예외를 던진다
export function serverEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경 변수 ${name}가 설정되지 않았습니다`);
  return v;
}

export const SUPABASE_URL = () => serverEnv("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () => serverEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SUMMARY_MODEL = () => process.env.SUMMARY_MODEL || "claude-opus-5-5";
export const PROMPT_VERSION = "v2";
