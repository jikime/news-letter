import { z } from "zod";

/**
 * 입력 검증 스키마. 계약(03-api-contract.md)의 요청 바디와 일치.
 * - 이메일: 형식 검증 + toLowerCase().trim() 정규화.
 * - scheduled_at: ISO8601 + 미래 시각.
 */

/** 미래 시각인지 검증하는 헬퍼. 유효한 날짜이며 now()보다 미래면 true. */
export function isFutureDate(value: string): boolean {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

/** ISO8601 문자열 + 미래 시각 zod 스키마 */
const futureIsoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "유효한 날짜 형식이 아닙니다.",
  })
  .refine((v) => isFutureDate(v), {
    message: "예약 시간은 미래여야 합니다.",
  });

/** POST /api/subscribe */
export const subscribeSchema = z.object({
  name: z.string().trim().min(1, { message: "이름을 입력하세요." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "유효한 이메일을 입력하세요." }),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

/** POST /api/admin/newsletters — 작성 (+선택 즉시 예약) */
export const newsletterSchema = z.object({
  title: z.string().trim().min(1, { message: "제목을 입력하세요." }),
  content: z.string().trim().min(1, { message: "본문을 입력하세요." }),
  scheduled_at: futureIsoDate.optional(),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;

/** POST /api/admin/newsletters/schedule — 기존 글 예약 */
export const scheduleSchema = z.object({
  id: z.string().uuid({ message: "유효한 뉴스레터 id가 아닙니다." }),
  scheduled_at: futureIsoDate,
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;

/** zod 에러에서 첫 메시지를 추출. 검증 실패 응답 message 로 사용. */
export function firstZodMessage(error: z.ZodError): string {
  return error.errors[0]?.message ?? "요청이 올바르지 않습니다.";
}
