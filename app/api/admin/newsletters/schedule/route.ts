import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, ErrorCode } from "@/lib/api";
import { scheduleSchema, firstZodMessage } from "@/lib/validation";
import type { NewsletterStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/newsletters/schedule — 기존 글 예약 (계약 §4)
 * service_role. draft/scheduled → scheduled 로 update.
 * sending/sent → 422 INVALID_STATE. 대상 없음 → 404.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(ErrorCode.VALIDATION_ERROR, "요청 본문이 올바르지 않습니다.", 400);
    }

    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_ERROR, firstZodMessage(parsed.error), 400);
    }

    const { id, scheduled_at } = parsed.data;
    const supabase = createServiceClient();

    // 1) 대상 글 조회
    const { data: current, error: selectError } = await supabase
      .from("newsletters")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (selectError) {
      return fail(ErrorCode.INTERNAL_ERROR, "뉴스레터 조회에 실패했습니다.", 500);
    }
    if (!current) {
      return fail(ErrorCode.NOT_FOUND, "뉴스레터를 찾을 수 없습니다.", 404);
    }

    const status = current.status as NewsletterStatus;

    // 2) 상태 전이 가능 여부: draft/scheduled 만 (재)예약 허용
    if (status === "sending" || status === "sent") {
      return fail(
        ErrorCode.INVALID_STATE,
        "발송 중이거나 완료된 글은 예약할 수 없습니다.",
        422,
      );
    }

    // 3) update. status 가운데 변경되지 않았음을 한 번 더 보장(낙관적 가드).
    const { data: updated, error: updateError } = await supabase
      .from("newsletters")
      .update({ scheduled_at, status: "scheduled" })
      .eq("id", id)
      .in("status", ["draft", "scheduled"])
      .select("id, status, scheduled_at")
      .maybeSingle();

    if (updateError) {
      return fail(ErrorCode.INTERNAL_ERROR, "예약 저장에 실패했습니다.", 500);
    }
    if (!updated) {
      // 조회와 update 사이 상태가 바뀐 경우(동시성)
      return fail(
        ErrorCode.INVALID_STATE,
        "발송 중이거나 완료된 글은 예약할 수 없습니다.",
        422,
      );
    }

    return ok(
      {
        id: updated.id,
        status: updated.status as NewsletterStatus,
        scheduled_at: updated.scheduled_at,
      },
      200,
    );
  } catch {
    return fail(ErrorCode.INTERNAL_ERROR, "서버 오류가 발생했습니다.", 500);
  }
}
