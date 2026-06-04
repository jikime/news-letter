"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Subscriber = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

type ApiResponse =
  | { ok: true; data: Subscriber[] }
  | { ok: false; error: { code: string; message: string } };

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; rows: Subscriber[] };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function AdminSubscribersPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/admin/subscribers");
        const json: ApiResponse = await res.json();
        if (cancelled) return;

        if (json.ok) {
          setState({ kind: "loaded", rows: json.data });
        } else {
          setState({ kind: "error", message: json.error.message });
        }
      } catch {
        if (cancelled) return;
        setState({
          kind: "error",
          message: "가입자 목록을 불러오지 못했습니다.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-6">
      <AdminNav active="subscribers" />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl">구독자 목록</CardTitle>
              <CardDescription>최신 가입순으로 표시됩니다.</CardDescription>
            </div>
            {state.kind === "loaded" && (
              <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-sm font-medium">
                총 {state.rows.length}명
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {state.kind === "loading" && (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              불러오는 중...
            </p>
          )}

          {state.kind === "error" && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
            >
              {state.message}
            </p>
          )}

          {state.kind === "loaded" && state.rows.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              아직 구독자가 없습니다.
            </p>
          )}

          {state.kind === "loaded" && state.rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead className="whitespace-nowrap">가입일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="break-all">{s.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-[var(--muted-foreground)]">
                      {formatDate(s.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
