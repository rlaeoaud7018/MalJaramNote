import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// AuthRoutes · FNC-A-002: 로그아웃 후 로그인 화면(303: POST → GET)
export async function POST(request: NextRequest) {
  const db = await createServerClient();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
}
