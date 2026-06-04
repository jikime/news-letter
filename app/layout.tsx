import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketing Weekly — 마케팅 뉴스레터",
  description:
    "실무에 바로 쓰는 마케팅 인사이트를 매주 한 통의 이메일로. 지금 구독하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
