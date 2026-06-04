import { Resend } from "resend";

/**
 * Resend 발송 래퍼.
 *
 * - sendNewsletter(to, subject, html): 단일 수신자에게 발송. 실패 시 throw → 호출부가 send_logs.status='failed' 기록.
 * - wrapHtml(content): 본문이 평문일 수 있으므로 최소한의 HTML 골격으로 감싼다.
 *
 * 필요한 환경변수:
 * - RESEND_API_KEY: Resend API 키.
 * - RESEND_FROM: 발신 주소(예: "Marketing Weekly <news@yourdomain.com>").
 *
 * 이 모듈은 서버 라우트에서만 import 한다(클라이언트 번들 노출 금지).
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 설정되지 않았습니다. .env(.example) 와 배포 환경을 확인하세요.`,
    );
  }
  return value;
}

/** 이미 HTML 골격(<html>/<body>)이 있으면 그대로, 아니면 최소 래핑한다. */
export function wrapHtml(content: string): string {
  const looksLikeFullDoc = /<\s*(html|body)[\s>]/i.test(content);
  if (looksLikeFullDoc) return content;

  return [
    "<!doctype html>",
    '<html lang="ko">',
    '<head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "</head>",
    '<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;line-height:1.7;color:#111;">',
    `<div style="max-width:640px;margin:0 auto;">${content}</div>`,
    "</body>",
    "</html>",
  ].join("");
}

/**
 * 단일 수신자에게 뉴스레터를 발송한다.
 * - subject: 뉴스레터 title.
 * - html: 뉴스레터 content(평문이면 wrapHtml로 감싼다).
 * 발송 실패(Resend error 또는 예외) 시 throw 한다.
 */
export async function sendNewsletter(
  to: string,
  subject: string,
  html: string,
): Promise<{ id: string | null }> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("RESEND_FROM");

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html: wrapHtml(html),
  });

  if (error) {
    // 호출부(cron route)가 이 throw를 잡아 send_logs.status='failed' 로 기록한다.
    throw new Error(error.message ?? "Resend 발송에 실패했습니다.");
  }

  return { id: data?.id ?? null };
}
