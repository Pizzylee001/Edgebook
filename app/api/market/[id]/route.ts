/**
 * Nansen attribution.
 *
 * Market data in Edgebook comes from the Nansen API. Powered by Nansen API.
 * Endpoints:
 * POST https://api.nansen.ai/api/v1/prediction-market/market-screener
 * POST https://api.nansen.ai/api/v1/prediction-market/ohlcv
 * POST https://api.nansen.ai/api/v1/prediction-market/top-holders
 *
 * This file is a server route. It reads NANSEN_API_KEY from the server
 * environment only and forwards it to Nansen as the apikey header. The key is
 * never returned in a response body and never uses a NEXT_PUBLIC_ name, so it
 * cannot reach the browser.
 */

import { NextResponse } from "next/server";

const NANSEN_SCREENER_URL =
  "https://api.nansen.ai/api/v1/prediction-market/market-screener";
const NANSEN_OHLCV_URL =
  "https://api.nansen.ai/api/v1/prediction-market/ohlcv";
const NANSEN_HOLDERS_URL =
  "https://api.nansen.ai/api/v1/prediction-market/top-holders";

export const dynamic = "force-dynamic";

function readUpstreamError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const value = record.error ?? record.message;
  return typeof value === "string" ? value : null;
}

function readDataList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === "object" && payload !== null) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data;
    }
  }
  return [];
}

function readRawList(payload: unknown): unknown {
  if (typeof payload === "object" && payload !== null) {
    const data = (payload as { data?: unknown }).data;
    if (data !== undefined) {
      return data;
    }
  }
  return payload;
}

async function postNansen(url: string, apiKey: string, body: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  return { response, payload };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.NANSEN_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "NANSEN_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  const marketId = typeof id === "string" ? id.trim() : "";
  if (marketId === "") {
    return NextResponse.json(
      { error: "Missing market id", found: false },
      { status: 404 },
    );
  }

  const screenerBody = JSON.stringify({
    pagination: { page: 1, per_page: 100 },
  });
  const ohlcvBody = JSON.stringify({
    market_id: marketId,
    pagination: { page: 1, per_page: 200 },
  });
  const holdersBody = JSON.stringify({
    market_id: marketId,
    pagination: { page: 1, per_page: 10 },
  });

  let settled: PromiseSettledResult<{
    response: Response;
    payload: unknown;
  }>[];
  try {
    settled = await Promise.allSettled([
      postNansen(NANSEN_SCREENER_URL, apiKey, screenerBody),
      postNansen(NANSEN_OHLCV_URL, apiKey, ohlcvBody),
      postNansen(NANSEN_HOLDERS_URL, apiKey, holdersBody),
    ]);
  } catch {
    return NextResponse.json(
      { error: "Nansen market detail request failed" },
      { status: 502 },
    );
  }

  const warnings: string[] = [];
  const [screenerSettled, ohlcvSettled, holdersSettled] = settled;

  if (screenerSettled.status === "rejected") {
    return NextResponse.json(
      { error: "Nansen market detail request failed" },
      { status: 502 },
    );
  }
  if (!screenerSettled.value.response.ok) {
    const message =
      readUpstreamError(screenerSettled.value.payload) ??
      "Nansen screener request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const markets = readDataList(screenerSettled.value.payload);
  const market = markets.find((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return false;
    }
    const candidate = (entry as { market_id?: unknown }).market_id;
    return String(candidate ?? "") === marketId;
  });

  if (market === undefined) {
    return NextResponse.json(
      { error: `Market ${marketId} was not found`, found: false },
      { status: 404 },
    );
  }

  let candles: unknown = [];
  if (ohlcvSettled.status === "rejected") {
    warnings.push("Price history (ohlcv) request failed");
  } else if (!ohlcvSettled.value.response.ok) {
    const message =
      readUpstreamError(ohlcvSettled.value.payload) ??
      "Price history (ohlcv) request failed";
    warnings.push(message);
  } else {
    candles = readRawList(ohlcvSettled.value.payload);
  }

  let holders: unknown = [];
  if (holdersSettled.status === "rejected") {
    warnings.push("Top holders request failed");
  } else if (!holdersSettled.value.response.ok) {
    const message =
      readUpstreamError(holdersSettled.value.payload) ??
      "Top holders request failed";
    warnings.push(message);
  } else {
    holders = readRawList(holdersSettled.value.payload);
  }

  return NextResponse.json({ market, candles, holders, warnings });
}
