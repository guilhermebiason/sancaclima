import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";

export function createRequest(
  path: string,
  params: Record<string, string | string[]> = {},
): NextRequest {
  const url = new URL(path, "http://localhost");

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
    } else {
      url.searchParams.set(key, value);
    }
  }

  return new NextRequest(url);
}

export async function readJsonResponse<T = unknown>(
  response: NextResponse,
): Promise<T> {
  assert.ok(
    response.headers.get("content-type")?.includes("application/json"),
    "A resposta deve utilizar JSON.",
  );

  return response.json() as Promise<T>;
}

export function assertStatus(
  response: NextResponse,
  expectedStatus: number,
): void {
  assert.equal(response.status, expectedStatus);
}

export function assertNoStore(response: NextResponse): void {
  assert.equal(
    response.headers.get("Cache-Control"),
    "no-store",
  );
}