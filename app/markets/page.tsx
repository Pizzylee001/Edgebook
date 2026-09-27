"use client";

/**
 * /markets, the discover surface.
 *
 * Live market data comes from /api/markets, a server route that holds the
 * Nansen API key. Market data in Edgebook comes from the Nansen API. Powered by
 * Nansen API.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  deltaDirection,
  formatCount,
  formatPercentFromProbability,
  formatPointDelta,
  formatUsd,
  impliedPrice,
  pickBiggestMove,
  pickHotTag,
  readTags,
  type MarketLike,
} from "@/lib/format";
import { STORAGE_KEY as CALLS_STORAGE_KEY } from "@/lib/calls";

const CAPTION_HEAD =
  "font-body text-[13px] font-medium uppercase tracking-[0.1em] text-text-faint";

const PANEL = "rounded-xl border border-hairline bg-surface";

const PRIMARY_BUTTON =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 font-body text-[14px] font-semibold text-accent-ink transition-colors duration-150 hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const TH =
  "px-4 py-3 font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint";

const TD = "px-4 py-3 align-top";

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function utcStamp(date: Date): string {
  return date.toISOString().slice(11, 19);
}

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const value = (payload as { error?: unknown }).error;
  return typeof value === "string" ? value : null;
}

function textOf(value: unknown): string {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : "Untitled market";
}

function idOf(market: MarketLike, index: number): string {
  const id = market.market_id;
  if (typeof id === "string" && id.trim() !== "") {
    return id;
  }
  if (typeof id === "number") {
    return String(id);
  }
  return `market-${index}`;
}

/** Color for a 24h move. The written direction always sits next to it. */
function changeTone(direction: "up" | "down" | "flat"): string {
  if (direction === "up") {
    return "text-positive";
  }
  if (direction === "down") {
    return "text-negative";
  }
  return "text-text-muted";
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[32px] rounded-full border px-3 font-data text-[11px] font-medium uppercase tracking-[0.1em] transition-colors duration-150 ${FOCUS_RING} ${
        active
          ? "border-accent bg-accent text-accent-ink"
          : "border-hairline text-text-muted hover:border-accent/60 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/** Three-cell live-fact strip with 1px hairline gaps between the cells. */
function FactStrip({
  markets,
  openCalls,
}: {
  markets: readonly MarketLike[];
  openCalls: number;
}) {
  const biggestMove = useMemo(() => pickBiggestMove(markets), [markets]);
  const hotTag = useMemo(() => pickHotTag(markets), [markets]);
  const direction = deltaDirection(biggestMove?.one_day_price_change);
  const move = `${direction === "flat" ? "flat" : direction} ${formatPointDelta(
    biggestMove?.one_day_price_change,
  )}`;

  return (
    <section
      aria-label="Live market facts"
      className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline md:grid-cols-3"
    >
      <article className="flex flex-col gap-2 bg-surface p-4">
        <p className={CAPTION_HEAD}>Biggest move, 24h</p>
        {biggestMove ? (
          <>
            <p className="text-[14.5px] leading-[1.45] text-text">
              {textOf(biggestMove.question)}
            </p>
            <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="flex items-baseline gap-2">
                <span className="font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
                  implied
                </span>
                <span className="font-data text-[24px] font-semibold leading-none tabular-nums text-text">
                  {formatPercentFromProbability(impliedPrice(biggestMove))}
                </span>
              </span>
              <span
                className={`font-data text-[13px] tabular-nums ${changeTone(
                  direction,
                )}`}
              >
                {move}
              </span>
            </div>
          </>
        ) : (
          <p className="font-data text-[13px] text-text-muted">n/a</p>
        )}
      </article>

      <article className="flex flex-col gap-2 bg-surface p-4">
        <p className={CAPTION_HEAD}>Your open calls</p>
        <span className="font-data text-[24px] font-semibold leading-none tabular-nums text-text">
          {formatCount(openCalls)}
        </span>
        <p className="mt-auto text-[13px] leading-[1.5] text-text-muted">
          {openCalls === 0
            ? "No calls logged in this browser yet."
            : "Calls saved in this browser."}
        </p>
      </article>

      <article className="flex flex-col gap-2 bg-surface p-4">
        <p className={CAPTION_HEAD}>Hot category</p>
        {hotTag ? (
          <>
            <span className="font-data text-[24px] font-semibold uppercase leading-none text-text">
              {hotTag.tag}
            </span>
            <p className="mt-auto text-[13px] leading-[1.5] text-text-muted">
              Appears on {hotTag.count} of {markets.length} markets on this page.
            </p>
          </>
        ) : (
          <p className="font-data text-[13px] text-text-muted">
            No tags on this page of markets.
          </p>
        )}
      </article>
    </section>
  );
}

/** Category chips. Selecting filters the table client side, no refetch. */
function Chips({
  tags,
  activeTag,
  onSelect,
}: {
  tags: readonly string[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter markets by category"
      className="flex flex-wrap items-center gap-2"
    >
      <ChipButton active={activeTag === null} onClick={() => onSelect(null)}>
        All
      </ChipButton>
      {tags.map((tag) => (
        <ChipButton
          key={tag}
          active={activeTag === tag}
          onClick={() => onSelect(activeTag === tag ? null : tag)}
        >
          {tag}
        </ChipButton>
      ))}
    </div>
  );
}

function MarketsTable({ rows }: { rows: readonly MarketLike[] }) {
  return (
    <div className={`overflow-hidden ${PANEL}`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Polymarket prediction markets from the Nansen API
          </caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className={TH}>
                Market
              </th>
              <th
                scope="col"
                className={`${TH} text-right`}
                title="Implied probability, the mean of the best bid and best ask, or the last trade price"
              >
                Implied
              </th>
              <th scope="col" className={`${TH} text-right`}>
                24h vol
              </th>
              <th scope="col" className={`${TH} hidden text-right md:table-cell`}>
                Traders 24h
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Your call
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Call
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((market, index) => {
              const id = idOf(market, index);
              const implied = formatPercentFromProbability(impliedPrice(market));
              const tags = readTags(market.tags);

              return (
                <tr
                  key={id}
                  className="border-b border-hairline-soft transition-colors duration-150 last:border-b-0 hover:bg-raised"
                >
                  <td className={`${TD} min-w-[240px]`}>
                    <div className="flex flex-col gap-2">
                      {tags.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-hairline px-2 py-0.5 font-data text-[10px] font-medium uppercase tracking-[0.1em] text-text-faint"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-[14.5px] leading-[1.45] text-text">
                        {textOf(market.question)}
                      </p>
                    </div>
                  </td>
                  <td
                    className={`${TD} text-right font-data text-[13px] tabular-nums ${
                      implied === "n/a" ? "text-text-muted" : "text-text"
                    }`}
                  >
                    {implied}
                  </td>
                  <td
                    className={`${TD} text-right font-data text-[13px] tabular-nums text-text-muted`}
                    title={`Liquidity ${formatUsd(market.liquidity)}`}
                  >
                    {formatUsd(market.volume_24hr)}
                  </td>
                  <td
                    className={`${TD} hidden text-right font-data text-[13px] tabular-nums text-text-muted md:table-cell`}
                  >
                    {formatCount(market.unique_traders_24h)}
                  </td>
                  <td
                    className={`${TD} text-right font-data text-[13px] text-text-faint`}
                  >
                    none
                  </td>
                  <td className={`${TD} text-right`}>
                    <Link
                      href={`/market/${id}`}
                      className={`inline-flex min-h-[44px] items-center justify-end rounded font-body text-[14px] font-semibold text-accent underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface`}
                    >
                      Log a call
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Skeleton rows in the same chrome. Pulse runs only when motion is allowed. */
function SkeletonTable() {
  const bar = "rounded bg-raised motion-safe:animate-pulse";

  return (
    <div className={`overflow-hidden ${PANEL}`} aria-busy="true">
      <div className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-3">
        <div className={`h-3 w-28 ${bar}`} />
        <div className={`h-3 w-20 ${bar}`} />
      </div>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
        <div
          key={row}
          className="flex items-center justify-between gap-6 border-b border-hairline-soft px-4 py-4 last:border-b-0"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className={`h-3 w-24 ${bar}`} />
            <div className={`h-4 w-full max-w-[320px] ${bar}`} />
          </div>
          <div className="hidden gap-6 sm:flex">
            <div className={`h-4 w-12 ${bar}`} />
            <div className={`h-4 w-16 ${bar}`} />
            <div className={`h-4 w-10 ${bar}`} />
          </div>
        </div>
      ))}
      <p className="sr-only">Loading markets from the Nansen API</p>
    </div>
  );
}

/** Empty state: the cause plus a next action, in the same chrome. */
function EmptyPanel({
  total,
  activeTag,
  onClear,
  onRetry,
}: {
  total: number;
  activeTag: string | null;
  onClear: () => void;
  onRetry: () => void;
}) {
  const filtered = activeTag !== null;

  return (
    <div className="rounded-xl border border-dashed border-hairline bg-surface px-6 py-10 text-center">
      <p className="font-display text-[22px] font-semibold uppercase tracking-[0.02em] text-text">
        {filtered ? `No ${activeTag} markets` : "No markets returned"}
      </p>
      <p className="mx-auto mt-2 max-w-[54ch] text-[14.5px] leading-[1.6] text-text-muted">
        {filtered
          ? `Cause: the ${activeTag} filter kept 0 of ${total} markets on this page.`
          : "Cause: the Nansen screener returned no markets for this request."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {filtered ? (
          <button type="button" onClick={onClear} className={PRIMARY_BUTTON}>
            Clear the filter
          </button>
        ) : (
          <button type="button" onClick={onRetry} className={PRIMARY_BUTTON}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/** Error state: the cause, a retry, and a note that saved calls are safe. */
function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className={`${PANEL} flex flex-col gap-2 px-5 py-6`}>
      <p className="font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
        Request failed
      </p>
      <p className="font-display text-[22px] font-semibold uppercase tracking-[0.02em] text-negative">
        Markets did not load
      </p>
      <p className="text-[14.5px] leading-[1.6] text-text-muted">
        Cause: {message}
      </p>
      <p className="text-[13px] leading-[1.6] text-text-muted">
        Saved calls in this browser are safe.
      </p>
      <div className="mt-3">
        <button type="button" onClick={onRetry} className={PRIMARY_BUTTON}>
          Retry
        </button>
      </div>
    </div>
  );
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketLike[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [openCalls, setOpenCalls] = useState(0);
  const [clock, setClock] = useState<string | null>(null);

  const loadMarkets = useCallback(async () => {
    setError(null);
    setMarkets(null);

    try {
      const response = await fetch("/api/markets", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          readError(payload) ?? `Request failed with status ${response.status}`,
        );
        return;
      }

      setMarkets(Array.isArray(payload) ? (payload as MarketLike[]) : []);
    } catch {
      setError("Could not reach /api/markets");
    }
  }, []);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    const tick = () => setClock(utcStamp(new Date()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CALLS_STORAGE_KEY);
      if (raw === null) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setOpenCalls(parsed.length);
      } else if (typeof parsed === "number" && Number.isFinite(parsed)) {
        setOpenCalls(parsed);
      }
    } catch {
      setOpenCalls(0);
    }
  }, []);

  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const market of markets ?? []) {
      for (const tag of readTags(market?.tags)) {
        seen.add(tag);
      }
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [markets]);

  const rows = useMemo(() => {
    const list = markets ?? [];
    if (activeTag === null) {
      return list;
    }
    return list.filter((market) => readTags(market?.tags).includes(activeTag));
  }, [markets, activeTag]);

  const retry = useCallback(() => {
    void loadMarkets();
  }, [loadMarkets]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col px-5 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[clamp(30px,4vw,46px)] font-bold uppercase leading-[1.05] tracking-[0.02em] text-text">
            Markets
          </h1>
          <p className="max-w-[62ch] text-[15.5px] leading-[1.6] text-text-muted">
            Pick a live Polymarket market, then log the probability you believe. The price and the crowd are frozen at the moment you commit.
          </p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2 font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
          <span>Nansen API</span>
          <span className="tabular-nums text-text-muted">
            UTC {clock ?? "--:--:--"}
          </span>
        </div>
      </header>

      <div className="mt-5 h-px w-full bg-hairline" />

      <div className="mt-8">
        <FactStrip markets={markets ?? []} openCalls={openCalls} />
      </div>

      <div className="mt-8 flex flex-col gap-5">
        {markets !== null ? (
          <Chips tags={tags} activeTag={activeTag} onSelect={setActiveTag} />
        ) : null}

        <div className="flex flex-col gap-3">
          <p className="font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
            Market data from the Nansen API
          </p>
          {error !== null ? (
            <ErrorPanel message={error} onRetry={retry} />
          ) : markets === null ? (
            <SkeletonTable />
          ) : rows.length > 0 ? (
            <MarketsTable rows={rows} />
          ) : (
            <EmptyPanel
              total={markets.length}
              activeTag={activeTag}
              onClear={() => setActiveTag(null)}
              onRetry={retry}
            />
          )}
        </div>
      </div>
    </div>
  );
}



