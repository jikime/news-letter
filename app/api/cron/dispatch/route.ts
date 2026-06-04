import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, ErrorCode } from "@/lib/api";
import { sendNewsletter } from "@/lib/email/resend";

/**
 * GET /api/cron/dispatch — 스케줄러(발송 엔진)
 *
 * 계약: artifacts/03-api-contract.md §5, 중복방지: artifacts/01-architecture.md §4.
 *
 * 절대 규칙 — 중복발송 방지(3겹 방어선):
 *  (1) 런타임 잠금: 조건부 UPDATE(status='scheduled' & scheduled_at<=now() → 'sending')의
 *      영향 행 수로만 발송 권한을 획득한다. 0행이면 다른 실행이 이미 잡은 것 → skip.
 *  (2) 데이터 보장: send_logs(newsletter_id, subscriber_id) UNIQUE + onConflict ignore.
 *      루프가 부분 재실행되어도 가입자별 정확히 1회.
 *  (3) 완료 마감: status='sent', sent_at=now(). 이후 (1)에서 영원히 0행 → 재발송 불가.
 *
 * 인증: Authorization: Bearer ${CRON_SECRET} 불일치 → 401.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Resend rate limit 완화용 가입자 간 대기(ms). 순차 발송 사이 간격. */
const SEND_INTERVAL_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type NewsletterRow = { id: string; title: string; content: string };
type SubscriberRow = { id: string; email: string; name: string | null };

export async function GET(request: Request): Promise<Response> {
  // --- 인증: CRON_SECRET 검증 (무단 외부 호출 차단) ---
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return fail(
      ErrorCode.UNAUTHORIZED,
      "유효하지 않은 cron 시크릿입니다.",
      401,
    );
  }

  try {
    const supabase = createServiceClient();

    // a. 발송 시각이 도래한 예약 글 조회.
    const { data: dueRows, error: dueErr } = await supabase
      .from("newsletters")
      .select("id, title, content")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (dueErr) {
      return fail(
        ErrorCode.INTERNAL_ERROR,
        "발송 대상 조회에 실패했습니다.",
        500,
      );
    }

    const due: NewsletterRow[] = dueRows ?? [];
    if (due.length === 0) {
      return ok({ processed: 0, sent: 0, failed: 0 });
    }

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const newsletter of due) {
      // b. ★ 잠금 — 조건부 UPDATE의 영향 행 수로 단일 발송자 선출.
      //    .select('id') 로 실제 갱신된 행을 확인한다.
      //    Postgres는 이 UPDATE를 원자적으로 처리하므로,
      //    cron이 중복 실행되어도 단 하나의 호출만 행을 받는다.
      const { data: lockedRows, error: lockErr } = await supabase
        .from("newsletters")
        .update({ status: "sending" })
        .eq("id", newsletter.id)
        .eq("status", "scheduled")
        .lte("scheduled_at", new Date().toISOString())
        .select("id");

      if (lockErr) {
        // 이 글에 대한 잠금 시도 실패 → 다음 글로. status는 건드리지 않았으므로 안전.
        continue;
      }

      // 영향 행 0건 = 다른 실행이 이미 'sending'/'sent'로 전환 → skip(중복발송 방지 핵심).
      if (!lockedRows || lockedRows.length === 0) {
        continue;
      }

      processed += 1;

      // c. 가입자 전건 조회.
      const { data: subRows, error: subErr } = await supabase
        .from("subscribers")
        .select("id, email, name");

      const subscribers: SubscriberRow[] = subErr ? [] : (subRows ?? []);

      // d. 가입자별 순차 발송 + send_logs 기록(rate limit 고려해 간격 둠).
      for (const sub of subscribers) {
        let status: "success" | "failed" = "success";
        let errorMessage: string | null = null;

        try {
          await sendNewsletter(sub.email, newsletter.title, newsletter.content);
        } catch (err) {
          status = "failed";
          errorMessage =
            err instanceof Error ? err.message : "알 수 없는 발송 오류";
        }

        // send_logs UNIQUE(newsletter_id, subscriber_id) → onConflict 무시로 재시도 안전.
        await supabase
          .from("send_logs")
          .upsert(
            {
              newsletter_id: newsletter.id,
              subscriber_id: sub.id,
              status,
              error: errorMessage,
            },
            {
              onConflict: "newsletter_id,subscriber_id",
              ignoreDuplicates: true,
            },
          );

        if (status === "success") {
          sent += 1;
        } else {
          failed += 1;
        }

        if (SEND_INTERVAL_MS > 0) {
          await sleep(SEND_INTERVAL_MS);
        }
      }

      // e. 마감 — 전건 처리 후 'sent'로 확정(실패 건이 있어도 글은 마감, 재발송은 운영 결정).
      await supabase
        .from("newsletters")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", newsletter.id);
    }

    return ok({ processed, sent, failed });
  } catch {
    return fail(
      ErrorCode.INTERNAL_ERROR,
      "스케줄러 실행 중 오류가 발생했습니다.",
      500,
    );
  }
}
