"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ApiResponse =
  | { ok: true; data: { id: string } }
  | { ok: false; error: { code: string; message: string } };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALUES = [
  {
    title: "매주 큐레이션",
    desc: "쏟아지는 마케팅 소식 중 실무에 필요한 것만 골라 매주 한 통으로.",
  },
  {
    title: "실무 적용 템플릿",
    desc: "바로 복사해 쓰는 카피·캠페인·퍼널 템플릿을 함께 드립니다.",
  },
  {
    title: "5분이면 충분",
    desc: "출근길 커피 한 잔 시간이면 이번 주 핵심 인사이트를 끝냅니다.",
  },
];

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function LandingPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle" });

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setStatus({ kind: "error", message: "이름을 입력하세요." });
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setStatus({ kind: "error", message: "유효한 이메일을 입력하세요." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });
      const json: ApiResponse = await res.json();

      if (json.ok) {
        setStatus({
          kind: "success",
          message: "구독 완료! 메일함을 확인하세요.",
        });
        setName("");
        setEmail("");
      } else {
        setStatus({ kind: "error", message: json.error.message });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* 배경 그라데이션 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[var(--secondary)] via-[var(--background)] to-[var(--background)]"
      />

      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-6 sm:py-20">
        {/* 브랜드 */}
        <div className="mb-10 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight">
            Marketing Weekly
          </span>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
            매주 화요일 발송
          </span>
        </div>

        {/* 히어로 */}
        <section className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            마케터를 위한
            <br className="hidden sm:block" /> 매주 한 통의 인사이트
          </h1>
          <p className="mt-5 text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg">
            트렌드 분석, 실전 캠페인 회고, 바로 쓰는 템플릿까지. 흩어진 마케팅
            정보를 한 통의 이메일로 정리해 드립니다. 지금 무료로 구독하세요.
          </p>
        </section>

        {/* 핵심 가치 카드 */}
        <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {VALUES.map((v) => (
            <Card key={v.title} className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">{v.title}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {v.desc}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        {/* 구독 폼 */}
        <section className="mt-12">
          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle className="text-xl">무료로 구독하기</CardTitle>
              <CardDescription>
                이름과 이메일만 입력하면 끝. 언제든 구독을 해지할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "구독 처리 중..." : "구독하기"}
                </Button>

                {status.kind === "success" && (
                  <p
                    role="status"
                    className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
                  >
                    {status.message}
                  </p>
                )}
                {status.kind === "error" && (
                  <p
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    {status.message}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </section>

        {/* 푸터 */}
        <footer className="mt-16 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <span>© {new Date().getFullYear()} Marketing Weekly</span>
          <Link href="/admin" className="underline-offset-4 hover:underline">
            관리자
          </Link>
        </footer>
      </div>
    </main>
  );
}
