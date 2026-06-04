import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, ErrorCode } from "@/lib/api";
import { newsletterSchema, firstZodMessage } from "@/lib/validation";
import type { NewsletterStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/newsletters — 작성 (+선택 즉시 예약) (계약 §3)
 * service_role. scheduled_at 있으면 status='scheduled', 없으면 'draft'.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(ErrorCode.VALIDATION_ERROR, "요청 본문이 올바르지 않습니다.", 400);
    }

    const parsed = newsletterSchema.safeParse(body);
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_ERROR, firstZodMessage(parsed.error), 400);
    }

    const { title, content, scheduled_at } = parsed.data;
    const status: NewsletterStatus = scheduled_at ? "scheduled" : "draft";

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("newsletters")
      .insert({
        title,
        content,
        status,
        scheduled_at: scheduled_at ?? null,
      })
      .select("id, status, scheduled_at")
      .single();

    if (error) {
      return fail(ErrorCode.INTERNAL_ERROR, "뉴스레터 저장에 실패했습니다.", 500);
    }

    return ok(
      {
        id: data.id,
        status: data.status as NewsletterStatus,
        ...(data.scheduled_at ? { scheduled_at: data.scheduled_at } : {}),
      },
      201,
    );
  } catch {
    return fail(ErrorCode.INTERNAL_ERROR, "서버 오류가 발생했습니다.", 500);
  }
}
