import { type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { ok, fail, ErrorCode } from "@/lib/api";
import { subscribeSchema, firstZodMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/subscribe — 공개 구독 (계약 §1)
 * anon 클라이언트로 insert. email UNIQUE 위반(23505) → 409 CONFLICT.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(ErrorCode.VALIDATION_ERROR, "요청 본문이 올바르지 않습니다.", 400);
    }

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_ERROR, firstZodMessage(parsed.error), 400);
    }

    const { name, email } = parsed.data;
    const supabase = createAnonClient();

    // anon은 INSERT 정책만 있고 SELECT 정책이 없다(가입자 목록 비공개).
    // 따라서 insert 후 .select()로 행을 돌려받으면 RLS(42501)에 막힌다.
    // id를 서버에서 생성해 명시적으로 넣고 select-back을 생략한다 → 최소권한 유지 + {id} 반환.
    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("subscribers")
      .insert({ id, name, email });

    if (error) {
      // 23505 = unique_violation (subscribers_email_key)
      if (error.code === "23505") {
        return fail(ErrorCode.CONFLICT, "이미 구독 중인 이메일입니다.", 409);
      }
      return fail(ErrorCode.INTERNAL_ERROR, "구독 처리에 실패했습니다.", 500);
    }

    return ok({ id }, 201);
  } catch {
    return fail(ErrorCode.INTERNAL_ERROR, "서버 오류가 발생했습니다.", 500);
  }
}
