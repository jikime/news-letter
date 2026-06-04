import Link from "next/link";

import { cn } from "@/lib/utils";

type AdminNavProps = {
  active: "subscribers" | "compose";
};

const ITEMS: { key: AdminNavProps["active"]; label: string; href: string }[] = [
  { key: "subscribers", label: "구독자 목록", href: "/admin" },
  { key: "compose", label: "뉴스레터 작성", href: "/admin/compose" },
];

export function AdminNav({ active }: AdminNavProps) {
  return (
    <div className="mb-8 space-y-4">
      <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
        데모용 공개 화면 — 운영 시 인증 필요
      </span>

      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Marketing Weekly
          <span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">
            관리자
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active === item.key
                  ? "bg-[var(--secondary)] font-medium text-[var(--secondary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
