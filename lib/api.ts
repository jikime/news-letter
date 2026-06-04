import { NextResponse } from "next/server";

/**
 * 통일 응답 헬퍼.
 * 성공: { ok: true, data }
 * 실패: { ok: false, error: { code, message } }
 *
 * 계약: artifacts/03-api-contract.md §0
 */

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: { code: string; message: string };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** 공통 에러 코드 (계약 §0) */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INVALID_STATE: "INVALID_STATE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status: number,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status },
  );
}
