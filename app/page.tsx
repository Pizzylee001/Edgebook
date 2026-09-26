"use client";

import { useEffect, useState } from "react";

type Market = {
  market_id: string;
  question: string;
  best_bid: number | null;
  best_ask: number | null;
  last_trade_price: number | null;
};

function impliedPrice(market: Market): string {
  const bid = market.best_bid;
  const ask = market.best_ask;
  if (typeof bid === "number" && typeof ask === "number") {
    return ((bid + ask) / 2).toFixed(3);
  }
  if (typeof market.last_trade_price === "number") {
    return market.last_trade_price.toFixed(3);
  }
  return "n/a";
}

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const value = (payload as { error?: unknown }).error;
  return typeof value === "string" ? value : null;
}

export default function Home() {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/markets", { cache: "no-store" });
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setError(
            readError(payload) ?? `Request failed with status ${response.status}`,
          );
          return;
        }
        setMarkets(Array.isArray(payload) ? (payload as Market[]) : []);
      } catch {
        if (!cancelled) {
          setError("Could not reach /api/markets");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-bg px-6 py-16 font-body text-text">
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg bg-surface p-6">
        <h1 className="font-display text-3xl font-bold uppercase tracking-[0.02em]">
          Edgebook smoke test
        </h1>
        <p className="font-data text-xs uppercase text-text-muted">
          Powered by Nansen API
        </p>
        {error !== null ? (
          <p className="font-data text-sm text-accent">Error: {error}</p>
        ) : markets === null ? (
          <p className="font-data text-sm text-text-muted">
            Loading markets from Nansen...
          </p>
        ) : markets.length === 0 ? (
          <p className="font-data text-sm text-text-muted">
            Nansen returned no markets.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {markets.slice(0, 3).map((market) => (
              <li
                key={market.market_id}
                className="flex items-start justify-between gap-6"
              >
                <span className="text-sm leading-6">{market.question}</span>
                <span className="font-data text-sm tabular-nums text-accent">
                  {impliedPrice(market)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
