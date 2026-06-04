"use client";

import { useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type NewsletterResult = {
  id: string;
  status: string;
  scheduled_at?: string;
};

type ApiResponse =
  | { ok: true; data: NewsletterResult }
  | { ok: false; error: { code: string; message: string } };

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type Pending = "draft" | "schedule" | null;

export default function ComposePage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState(""); // datetime-local 값
  const [pending, setPending] = useState<Pending>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const loading = pending !== null;

  async function postNewsletter(body: {
    title: string;
    content: string;
    scheduled_at?: string;
  }): Promise<ApiResponse> {
    const res = await fetch("/api/admin/newsletters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiResponse;
  }

  function validateBase(): string | null {
    if (!title.trim()) return "제목을 입력하세요.";
    if (!content.trim()) return "본문을 입력하세요.";
    return null;
  }

  async function handleDraft() {
    setStatus({ kind: "idle" });
    const err = validateBase();
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }

    setPending("draft");
    try {
      const json = await postNewsletter({
        title: title.trim(),
        content: content.trim(),
      });
      if (json.ok) {
        setStatus({
          kind: "success",
          message: "임시저장(draft)했습니다.",
        });
      } else {
        setStatus({ kind: "error", message: json.error.message });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
      });
    } finally {
      setPending(null);
    }
  }

  async function handleSchedule() {
    setStatus({ kind: "idle" });
    const err = validateBase();
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    if (!scheduledAt) {
      setStatus({ kind: "error", message: "발송일시를 선택하세요." });
      return;
    }

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      setStatus({ kind: "error", message: "발송일시 형식이 올바르지 않습니다." });
      return;
    }
    if (when.getTime() <= Date.now()) {
      setStatus({ kind: "error", message: "예약 시간은 미래여야 합니다." });
      return;
    }

    setPending("schedule");
    try {
      const json = await postNewsletter({
        title: title.trim(),
        content: content.trim(),
        scheduled_at: when.toISOString(),
      });
      if (json.ok) {
        setStatus({
          kind: "success",
          message: `예약 완료! ${formatLocal(scheduledAt)}에 발송됩니다.`,
        });
      } else {
        setStatus({ kind: "error", message: json.error.message });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6">
      <AdminNav active="compose" />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">뉴스레터 작성</CardTitle>
          <CardDescription>
            임시저장하거나, 발송일시를 지정해 예약 발송할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                placeholder="이번 주 마케팅 트렌드"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">본문</Label>
              <Textarea
                id="content"
                rows={12}
                placeholder="<h1>제목</h1><p>내용...</p>"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={loading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                HTML 또는 일반 텍스트를 입력할 수 있습니다. 발송 시 이메일 본문으로
                사용됩니다.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt">발송일시 (예약 시에만)</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={loading}
                className="w-full sm:w-auto"
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                비워두고 임시저장하면 draft로 보관됩니다. 예약 발송은 미래 시각만
                가능합니다.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleDraft}
                disabled={loading}
                className="sm:flex-1"
              >
                {pending === "draft" ? "저장 중..." : "임시저장(draft)"}
              </Button>
              <Button
                type="button"
                onClick={handleSchedule}
                disabled={loading}
                className="sm:flex-1"
              >
                {pending === "schedule" ? "예약 중..." : "예약 발송"}
              </Button>
            </div>

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
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function formatLocal(datetimeLocal: string): string {
  const d = new Date(datetimeLocal);
  if (Number.isNaN(d.getTime())) return datetimeLocal;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
