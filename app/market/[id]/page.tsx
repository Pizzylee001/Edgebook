"use client";

/**
 * /market/[id], the detail and Log a Call surface.
 *
 * Live market data comes from /api/market/[id], a server route that holds
 * the Nansen API key. Market data in Edgebook comes from the Nansen API.
 * Powered by Nansen API. Calls are saved in this browser only.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { makeId, writeCall, type CallRecord } from "@/lib/calls";
import {
  formatCount,
  formatPercentFromProbability,
  formatUsd,
  impliedPrice,
  toNumber,
  type MarketLike,
} from "@/lib/format";

type MarketDetailPayload = {
  market: MarketLike & Record<string, unknown>;
  candles: unknown;
  holders: unknown;
  warnings: string[];
};

const CAPTION_HEAD =
  "font-body text-[13px] font-medium uppercase tracking-[0.1em] text-text-faint";

const PANEL = "rounded-xl border border-hairline bg-surface p-5";

const CONFIRMED_PANEL =
  "rounded-xl border border-positive/40 bg-surface p-5";

const GHOST_BUTTON =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-hairline bg-transparent px-4 font-body text-[14px] font-semibold text-text transition-colors duration-150 hover:border-accent/60 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const PRIMARY_BUTTON =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-accent px-4 font-body text-[14px] font-semibold text-accent-ink transition-colors duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const INPUT =
  "w-full rounded-lg border border-hairline bg-raised px-3 py-[11px] font-data text-[15px] text-text tabular-nums focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const value = (payload as { error?: unknown }).error;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function textOf(value: unknown): string {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : "Untitled market";
}

function idText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function toUnit(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null || parsed < 0 || parsed > 1) {
    return null;
  }
  return parsed;
}

function toSnapshotNumber(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed === null || !Number.isFinite(parsed) ? null : parsed;
}

/** Reads candle close values, tolerating several Nansen ohlcv shapes. */
function readCloses(candles: unknown): number[] {
  const list = Array.isArray(candles)
    ? candles
    : typeof candles === "object" &&
        candles !== null &&
        Array.isArray((candles as { data?: unknown }).data)
      ? ((candles as { data?: unknown }).data as unknown[])
      : [];
  const out: number[] = [];
  for (const candle of list) {
    if (typeof candle !== "object" || candle === null) {
      continue;
    }
    const record = candle as Record<string, unknown>;
    const close = toNumber(
      record.close ?? record.close_price ?? record.c ?? record.price,
    );
    if (close !== null && Number.isFinite(close)) {
      out.push(close);
    }
    if (out.length >= 200) {
      break;
    }
  }
  return out;
}

/** Reads a raw holder list, tolerating envelope shapes. */
function readHolders(holders: unknown): Record<string, unknown>[] {
  const list = Array.isArray(holders)
    ? holders
    : typeof holders === "object" &&
        holders !== null &&
        Array.isArray((holders as { data?: unknown }).data)
      ? ((holders as { data?: unknown }).data as unknown[])
      : [];
  return list.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null,
  );
}

function holderSide(holder: Record<string, unknown>): string | null {
  const raw =
    holder.side ?? holder.position_side ?? holder.position ?? holder.outcome;
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const side = raw.trim().toUpperCase();
  if (side.startsWith("YES")) {
    return "YES";
  }
  if (side.startsWith("NO")) {
    return "NO";
  }
  return side;
}

function holderAddress(holder: Record<string, unknown>): string | null {
  const raw =
    holder.address ?? holder.wallet ?? holder.wallet_address ?? holder.account;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

function holderDisplay(holder: Record<string, unknown>): string | null {
  const side = holderSide(holder);
  if (!side) {
    return null;
  }
  const count = toNumber(holder.count ?? holder.holders ?? holder.total);
  if (count !== null) {
    return `${formatCount(count)} ${side}`;
  }
  return side;
}

function PriceChart({ closes }: { closes: number[] }) {
  if (closes.length === 0) {
    return (
      <p className="text-[13px] leading-[1.6] text-text-muted">
        No candle history returned for this market yet. The snapshot below
        still captures the current price.
      </p>
    );
  }
  if (closes.length < 2) {
    return (
      <div className="rounded-lg border border-hairline bg-raised p-4">
        <p className="font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
          Most recent closes
        </p>
        <p className="mt-2 font-data text-[15px] tabular-nums text-text">
          {closes.map((close) => formatPercentFromProbability(close)).join(", ")}
        </p>
      </div>
    );
  }

  const width = 560;
  const height = 190;
  const pad = 8;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min === 0 ? 1 : max - min;
  const points = closes.map((close, index) => {
    const x = pad + (index / (closes.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (close - min) / span) * (height - pad * 2);
    return { x, y };
  });
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${(width - pad).toFixed(1)},${(height - pad).toFixed(1)} L${pad.toFixed(1)},${(height - pad).toFixed(1)} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Market implied probability trend, from ${formatPercentFromProbability(min)} to ${formatPercentFromProbability(max)}.`}
      >
        <defs>
          <linearGradient id="edgebook-market-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8593A3" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8593A3" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 85, 130].map((y) => (
          <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="#18202A" />
        ))}
        <path d={area} fill="url(#edgebook-market-fill)" />
        <path d={line} fill="none" stroke="#8593A3" strokeWidth="2" />
      </svg>
      <div className="mt-2 flex items-center justify-between font-data text-[11px] tabular-nums text-text-faint">
        <span>{formatPercentFromProbability(max)} high</span>
        <span>{closes.length} closes</span>
        <span>{formatPercentFromProbability(min)} low</span>
      </div>
      <p className="mt-2 text-[12px] leading-[1.6] text-text-faint">
        Muted series is the market. Your call is drawn in ice on commit.
      </p>
    </div>
  );
}

function CheckTick({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** ISO time in a readable local form, for example 2026-09-27 13:42 UTC. */
function readableTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  const stamp = parsed.toISOString().slice(0, 16).replace("T", " ");
  return `${stamp} UTC`;
}

function RingDial({ percent }: { percent: number | null }) {
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const empty = percent === null;
  return (
    <div className="relative flex-none">
      <svg viewBox="0 0 150 150" width="118" height="118" aria-hidden="true" className="-rotate-90">
        <circle cx="75" cy="75" r={radius} fill="none" stroke="#232B36" strokeWidth="11" />
        <circle cx="75" cy="75" r={radius} fill="none" stroke="#7FD6E6" strokeWidth="11" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {empty ? (
          <b className="font-data text-[20px] font-semibold text-text-faint">--</b>
        ) : (
          <b className="font-data text-[24px] font-semibold tabular-nums text-text">{Math.round(clamped)}%</b>
        )}
        <span className="font-body text-[10.5px] uppercase tracking-[0.08em] text-text-faint">your call</span>
      </div>
    </div>
  );
}

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = useMemo(() => {
    const raw = params?.id as string | string[] | undefined;
    if (typeof raw === "string") {
      return decodeURIComponent(raw);
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return decodeURIComponent(raw[0] ?? "");
    }
    return "";
  }, [params]);

  const [payload, setPayload] = useState<MarketDetailPayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [probability, setProbability] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [logged, setLogged] = useState<CallRecord | null>(null);

  const load = useCallback(async () => {
    if (!marketId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await fetch(`/api/market/${encodeURIComponent(marketId)}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 404) {
        setPayload(null);
        setNotFound(true);
        return;
      }
      if (!response.ok) {
        setPayload(null);
        setError(readError(body) ?? `Could not load market ${marketId}`);
        return;
      }
      const record = body as Partial<MarketDetailPayload>;
      if (!record || typeof record.market !== "object" || record.market === null) {
        setPayload(null);
        setError(`Could not load market ${marketId}`);
        return;
      }
      setPayload({
        market: record.market as MarketLike & Record<string, unknown>,
        candles: record.candles ?? [],
        holders: record.holders ?? [],
        warnings: Array.isArray(record.warnings) ? record.warnings.filter((entry): entry is string => typeof entry === "string") : [],
      });
    } catch {
      setPayload(null);
      setError(`Could not reach /api/market/${marketId}`);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const market = payload?.market ?? null;
  const implied = useMemo(() => impliedPrice(market), [market]);
  const impliedPercent = implied === null ? null : Math.round(implied * 100);
  const closes = useMemo(() => readCloses(payload?.candles), [payload]);
  const holders = useMemo(() => readHolders(payload?.holders), [payload]);
  const question = market ? textOf(market.question) : "";

  const parsedProbability = useMemo(() => {
    if (probability.trim() === "") {
      return null;
    }
    const parsed = Number(probability);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return null;
    }
    return parsed;
  }, [probability]);

  const gap = parsedProbability !== null && impliedPercent !== null ? Math.round(parsedProbability - impliedPercent) : null;

  const helperLine = impliedPercent === null
    ? "The market has no implied price to compare against yet."
    : parsedProbability === null
      ? "Enter 0 to 100. Your call is separate from the market price above."
      : gap === 0
        ? `The market implies ${impliedPercent}%. You match the market.`
        : gap !== null && gap > 0
          ? `The market implies ${impliedPercent}%. You think it is higher by ${gap} pts.`
          : `The market implies ${impliedPercent}%. You think it is lower by ${Math.abs(gap ?? 0)} pts.`;

  const commit = useCallback(() => {
    setFormError(null);
    setLogged(null);
    if (!market || !marketId) {
      setFormError("Market data is not ready yet. Retry, then commit.");
      return;
    }
    if (parsedProbability === null) {
      setFormError("Enter a probability from 0 to 100 before committing.");
      return;
    }
    const top3 = holders.slice(0, 3).map((holder) => ({
      address: holderAddress(holder) ?? "unknown",
      side: holderSide(holder) ?? "unknown",
    }));
    const record: CallRecord = {
      id: makeId(),
      market_id: marketId,
      question,
      probability: parsedProbability,
      reason: reason.trim(),
      commitImplied: toUnit(implied),
      commitVolume24h: toSnapshotNumber(market.volume_24hr),
      commitLiquidity: toSnapshotNumber(market.liquidity),
      commitTraders24h: toSnapshotNumber(market.unique_traders_24h),
      holdersTop3: top3,
      committedAt: new Date().toISOString(),
      resolved: false,
      outcomeYes: null,
    };
    writeCall(record);
    setLogged(record);
  }, [holders, implied, market, marketId, parsedProbability, question, reason]);

  const resetPanel = useCallback(() => {
    setProbability("");
    setReason("");
    setFormError(null);
    setLogged(null);
  }, []);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-5 py-8 sm:px-6 sm:py-10" aria-busy="true">
        <div className="h-4 w-40 rounded bg-raised motion-safe:animate-pulse" />
        <div className="mt-3 h-9 w-3/4 rounded bg-raised motion-safe:animate-pulse" />
        <div className="mt-5 h-px w-full bg-hairline" />
        <div className="mt-8 grid gap-[22px] min-[900px]:grid-cols-[1.35fr_1fr]">
          <div className="flex flex-col gap-[22px]">
            <div className={`h-[280px] ${PANEL} motion-safe:animate-pulse`} />
            <div className={`h-[220px] ${PANEL} motion-safe:animate-pulse`} />
          </div>
          <div className={`h-[420px] ${PANEL} motion-safe:animate-pulse`} />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-5 py-8 sm:px-6 sm:py-10">
        <h1 className="font-display text-[clamp(30px,4vw,46px)] font-bold uppercase leading-[1.05] tracking-[0.02em] text-text">Market not found</h1>
        <p className="mt-3 max-w-[62ch] text-[15.5px] leading-[1.6] text-text-muted">Nansen did not return a market with id {marketId || "unknown"}. It may have resolved or left the screener page.</p>
        <Link href="/markets" className={`mt-6 inline-flex min-h-[44px] items-center font-body text-[14px] font-semibold text-accent underline-offset-4 hover:underline ${FOCUS_RING}`}>Back to Markets</Link>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-5 py-8 sm:px-6 sm:py-10">
        <h1 className="font-display text-[clamp(30px,4vw,46px)] font-bold uppercase leading-[1.05] tracking-[0.02em] text-text">Could not load this market</h1>
        <p className="mt-3 max-w-[62ch] text-[15.5px] leading-[1.6] text-text-muted">{error ?? "The market response was empty. Saved calls are safe."}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => void load()} className="inline-flex min-h-[44px] items-center rounded-lg border border-hairline px-4 font-body text-[14px] font-semibold text-text transition-colors duration-150 hover:border-accent/60 hover:text-accent">Retry</button>
          <Link href="/markets" className={`inline-flex min-h-[44px] items-center font-body text-[14px] font-semibold text-accent underline-offset-4 hover:underline ${FOCUS_RING}`}>Back to Markets</Link>
        </div>
      </div>
    );
  }

  const holderLines = holders.map(holderDisplay).filter((line): line is string => line !== null).slice(0, 3);
  const gapText = gap === null ? null : gap > 0 ? `+${gap} pts` : gap < 0 ? `${gap} pts` : "0 pts";
  const yourCallText = parsedProbability === null ? "not set" : `${Math.round(parsedProbability)}%`;
  const marketCallText = impliedPercent === null ? "n/a" : `${impliedPercent}%`;
  const loggedGapText =
    logged === null || logged.commitImplied === null
      ? null
      : (() => {
          const diff = Math.round(
            logged.probability - logged.commitImplied * 100,
          );
          return diff > 0 ? `+${diff} pts` : diff < 0 ? `${diff} pts` : "0 pts";
        })();

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col px-5 py-8 sm:px-6 sm:py-10">
      <header>
        <p className="font-data text-[11px] text-text-faint">
          <Link href="/markets" className="text-text-faint underline-offset-4 hover:text-accent hover:underline">Back to Markets</Link>
          <span aria-hidden="true"> / </span>
          <span className="break-all">{idText(market.market_id, marketId)}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-5">
          <h1 className="max-w-[26ch] font-display text-[clamp(26px,3.4vw,40px)] font-bold uppercase leading-[1.05] tracking-[0.02em] text-text">{question}</h1>
          <p className="pt-1 text-right font-data text-[12px] text-text-muted">Implied <span className="tabular-nums text-text">{formatPercentFromProbability(implied)}</span><br /><span className="text-[11px] uppercase tracking-[0.1em] text-text-faint">Live via Nansen</span></p>
        </div>
        <div className="mt-5 h-px w-full bg-hairline" />
      </header>
      {payload && payload.warnings.length > 0 ? (
        <p role="status" className="mt-5 rounded-lg border border-hairline bg-surface px-4 py-3 text-[13px] leading-[1.6] text-text-muted">Partial data: {payload.warnings.join("; ")}. The market and any working panel still show.</p>
      ) : null}
      <div className="mt-6 grid gap-[22px] min-[900px]:grid-cols-[1.35fr_1fr]">
        <div className="order-1 flex min-w-0 flex-col gap-[22px]">
          <section aria-labelledby="price-history" className={PANEL}>
            <h2 id="price-history" className={CAPTION_HEAD}>Price history, 1h candles</h2>
            <div className="mt-3"><PriceChart closes={closes} /></div>
          </section>
          <section aria-labelledby="commit-snapshot" className={PANEL}>
            <h2 id="commit-snapshot" className={CAPTION_HEAD}>Snapshot captured at commit</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-[9px] text-[14px] min-[480px]:grid-cols-[1fr_auto]">
              <dt className="text-text-muted">Market implied price</dt>
              <dd className="font-data tabular-nums text-text min-[480px]:text-right">{formatPercentFromProbability(implied)}</dd>
              <dt className="text-text-muted">Liquidity</dt>
              <dd className="font-data tabular-nums text-text min-[480px]:text-right">{formatUsd(market.liquidity)}</dd>
              <dt className="text-text-muted">24h volume</dt>
              <dd className="font-data tabular-nums text-text min-[480px]:text-right">{formatUsd(market.volume_24hr)}</dd>
              <dt className="text-text-muted">Unique traders 24h</dt>
              <dd className="font-data tabular-nums text-text min-[480px]:text-right">{formatCount(market.unique_traders_24h)}</dd>
              <dt className="text-text-muted">Top holders</dt>
              <dd className="font-data tabular-nums text-text min-[480px]:text-right">{holderLines.length > 0 ? holderLines.join(", ") : "n/a"}</dd>
            </dl>
            <p className="mt-3 text-[12px] leading-[1.6] text-text-faint">These values freeze with your call. Later, Edgebook compares your call against this exact snapshot.</p>
          </section>
        </div>
        <div className="order-2 flex min-w-0 flex-col gap-[22px]">
          {logged ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-[10px] border border-positive/40 bg-positive/10 px-4 py-3"
            >
              <CheckTick size={18} className="mt-[1px] flex-none text-positive" />
              <p className="m-0 text-[13.5px] leading-[1.55] text-text-muted">
                <b className="font-semibold text-positive">Call logged.</b>{" "}
                Frozen to this browser. Your open calls went up by one.
              </p>
            </div>
          ) : null}

          {logged ? (
            <section
              aria-labelledby="log-a-call"
              className={CONFIRMED_PANEL}
            >
              <div className="flex items-center gap-[10px]">
                <CheckTick size={22} className="flex-none text-positive" />
                <h2
                  id="log-a-call"
                  className="m-0 font-display text-[22px] font-semibold uppercase text-positive"
                >
                  Call logged
                </h2>
              </div>
              <p className="mt-1.5 text-[14px] leading-[1.6] text-text-muted">
                You said{" "}
                <b className="font-semibold text-text">
                  {Math.round(logged.probability)}%
                </b>
                . The market implied{" "}
                <b className="font-semibold text-text">
                  {formatPercentFromProbability(logged.commitImplied)}
                </b>
                {loggedGapText === null ? (
                  <>, frozen with your call.</>
                ) : (
                  <>, a gap of {loggedGapText}.</>
                )}{" "}
                Snapshot frozen at{" "}
                {formatPercentFromProbability(logged.commitImplied)} implied.
              </p>
              <dl className="mt-3.5 grid grid-cols-1 gap-x-4 gap-y-[9px] border-y border-hairline py-3.5 text-[13.5px] min-[480px]:grid-cols-[1fr_auto]">
                <dt className="text-text-muted">Your call</dt>
                <dd className="font-data tabular-nums text-accent min-[480px]:text-right">
                  {Math.round(logged.probability)}%
                </dd>
                <dt className="text-text-muted">Market at commit</dt>
                <dd className="font-data tabular-nums text-text min-[480px]:text-right">
                  {formatPercentFromProbability(logged.commitImplied)}
                </dd>
                <dt className="text-text-muted">Liquidity frozen</dt>
                <dd className="font-data tabular-nums text-text min-[480px]:text-right">
                  {formatUsd(logged.commitLiquidity)}
                </dd>
                <dt className="text-text-muted">Traders 24h</dt>
                <dd className="font-data tabular-nums text-text min-[480px]:text-right">
                  {formatCount(logged.commitTraders24h)}
                </dd>
                <dt className="text-text-muted">Logged at</dt>
                <dd className="font-data tabular-nums text-text min-[480px]:text-right">
                  {readableTime(logged.committedAt)}
                </dd>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={resetPanel}
                  className={GHOST_BUTTON}
                >
                  Log another call
                </button>
                <Link
                  href="/markets"
                  className={`inline-flex min-h-[44px] items-center font-body text-[14px] font-semibold text-accent underline-offset-4 hover:underline ${FOCUS_RING}`}
                >
                  Back to Markets
                </Link>
              </div>
            </section>
          ) : (
          <section aria-labelledby="log-a-call" className={PANEL}>
            <h2 id="log-a-call" className={CAPTION_HEAD}>Log a call</h2>
            <p className="mt-3 text-[14px] leading-[1.5] text-text-muted">{question}</p>
            <p className="mt-2.5 font-data text-[12px] leading-[1.5] tabular-nums text-text-muted">
              Market implies{" "}
              <b className="font-semibold text-text">
                {formatPercentFromProbability(implied)}
              </b>{" "}
              &middot; liquidity {formatUsd(market.liquidity)}
            </p>
            <label htmlFor="probability" className="mt-4 block text-[13px] text-text-muted">Your probability, percent</label>
            <input id="probability" type="number" min={0} max={100} value={probability} onChange={(event) => setProbability(event.target.value)} placeholder="e.g. 52" className={`mt-[7px] ${INPUT}`} />
            <p className="mt-[6px] text-[12px] leading-[1.6] text-text-faint">{helperLine}</p>
            <label htmlFor="reason" className="mt-4 block text-[13px] text-text-muted">One line of reasoning</label>
            <textarea id="reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="One line on why you differ from the market." className={`mt-[7px] ${INPUT}`} />
            <div className="mt-[18px] flex items-center gap-[18px]">
              <RingDial percent={parsedProbability} />
              <p className="m-0 font-data text-[12px] leading-[1.7] tabular-nums text-text-muted">
                market <b className="font-semibold text-text">{marketCallText}</b>
                <br />
                your call{" "}
                <b className="font-semibold text-text">{yourCallText}</b>
                {gapText === null ? null : (
                  <>
                    <br />
                    gap <b className="font-semibold text-text">{gapText}</b>
                  </>
                )}
              </p>
            </div>
            <button type="button" onClick={commit} className={`mt-4 ${PRIMARY_BUTTON}`}>Commit call and snapshot market</button>
            {formError ? (<p role="alert" className="mt-2 text-[12px] leading-[1.6] text-negative">{formError}</p>) : null}
            <p className="mt-3 text-[12px] leading-[1.6] text-text-faint">Saved in this browser only. No sign in, no wallet, no server storage. Market data from the Nansen API.</p>
          </section>
          )}
        </div>
      </div>
      <Link href="/markets" className={`mt-8 inline-flex min-h-[44px] items-center self-start font-body text-[14px] font-semibold text-accent underline-offset-4 hover:underline ${FOCUS_RING}`}>Back to Markets</Link>
    </div>
  );
}


