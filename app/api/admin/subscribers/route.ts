import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, ErrorCode } from "@/lib/api";
import type { Subscriber } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/subscribers — 가입자 목록 (계약 §2)
 * service_role. created_at desc.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("subscribers")
      .select("id, name, email, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return fail(ErrorCode.INTERNAL_ERROR, "가입자 조회에 실패했습니다.", 500);
    }

    return ok<Subscriber[]>((data ?? []) as Subscriber[], 200);
  } catch {
    return fail(ErrorCode.INTERNAL_ERROR, "가입자 조회에 실패했습니다.", 500);
  }
}
