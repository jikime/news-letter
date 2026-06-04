/**
 * DB row 타입. artifacts/02-db-schema.md 의 컬럼과 1:1 대응.
 * 컬럼명/타입을 임의 변경하지 말 것 (계약 §6 필드명 일치표).
 */

/** newsletters.status 상태 머신: draft → scheduled → sending → sent */
export type NewsletterStatus = "draft" | "scheduled" | "sending" | "sent";

/** send_logs.status */
export type SendStatus = "success" | "failed";

/** subscribers 테이블 row */
export interface Subscriber {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

/** newsletters 테이블 row */
export interface Newsletter {
  id: string;
  title: string;
  content: string;
  status: NewsletterStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

/** send_logs 테이블 row */
export interface SendLog {
  id: string;
  newsletter_id: string;
  subscriber_id: string;
  status: SendStatus;
  error: string | null;
  sent_at: string;
}
