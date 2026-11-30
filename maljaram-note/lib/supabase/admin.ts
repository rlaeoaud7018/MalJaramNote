import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, serverEnv } from "@/lib/env";

// service_role 키는 서버에서만 사용한다(sec-001). RLS를 우회하므로 Cron·탈퇴·사용량 확인에만 쓴다
export function createAdminClient() {
  return createClient(SUPABASE_URL(), serverEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
