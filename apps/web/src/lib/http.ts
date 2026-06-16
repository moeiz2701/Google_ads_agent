import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Consistent JSON error envelope for route handlers. */
export function jsonError(status: number, message: string, extra?: unknown) {
  return NextResponse.json(
    { error: message, ...(extra ? { details: extra } : {}) },
    { status },
  );
}

/**
 * Maps a thrown error to an HTTP response without leaking internals. Zod →
 * 400 with field issues; everything else → 500 with a generic message (full
 * error logged server-side).
 */
export function handleRouteError(context: string, err: unknown) {
  if (err instanceof ZodError) {
    return jsonError(400, "Validation failed", err.flatten());
  }
  console.error(`[${context}]`, err);
  return jsonError(500, "Internal error");
}
