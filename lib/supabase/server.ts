import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트 팩토리.
 *
 * - createServiceClient(): service_role 키. 관리/발송 라우트 전용. RLS 우회.
 * - createAnonClient(): 공개 anon 키. 구독 insert 등 공개 경로용.
 *
 * service_role 키는 절대 클라이언트 번들로 새지 않아야 한다.
 * 이 모듈은 서버 라우트(route handler)에서만 import 한다.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 설정되지 않았습니다. .env(.example) 를 확인하세요.`,
    );
  }
  return value;
}

/** service_role 키 기반 클라이언트. 서버 라우트 전용. RLS를 우회한다. */
export function createServiceClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/** anon 키 기반 클라이언트. 공개 구독 insert 등에 사용. */
export function createAnonClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
