/**
 * Nansen attribution.
 *
 * Market data in Edgebook comes from the Nansen API. Powered by Nansen API.
 * Endpoint: POST https://api.nansen.ai/api/v1/prediction-market/market-screener
 *
 * This file is a server route. It reads NANSEN_API_KEY from the server
 * environment only and forwards it to Nansen as the apikey header. The key is
 * never returned in a response body and never uses a NEXT_PUBLIC_ name, so it
 * cannot reach the browser.
 */

import { NextResponse } from "next/server";

const NANSEN_SCREENER_URL =
  "https://api.nansen.ai/api/v1/prediction-market/market-screener";

const SCREENER_BODY = JSON.stringify({
  pagination: { page: 1, per_page: 10 },
});

export const dynamic = "force-dynamic";

function readUpstreamError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const value = record.error ?? record.message;
  return typeof value === "string" ? value : null;
}

export async function GET() {
  const apiKey = process.env.NANSEN_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "NANSEN_API_KEY is not set on the server", status: 500 },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(NANSEN_SCREENER_URL, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: SCREENER_BODY,
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        readUpstreamError(payload) ?? "Nansen screener request failed";
      return NextResponse.json(
        { error: message, status: response.status },
        { status: response.status },
      );
    }

    const data = (payload as { data?: unknown } | null)?.data;
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json(
      { error: "Nansen screener request failed", status: 502 },
      { status: 502 },
    );
  }
}
