"use client";

/**
 * /journal, the call record.
 *
 * Every call you logged, with the market snapshot frozen at the moment you
 * committed it, and the result once you mark the market settled. This page
 * makes no API calls. It reads and writes the local calls store only, so no
 * Nansen key is ever in play here.
 *
 * Market data in Edgebook comes from the Nansen API. Powered by Nansen API.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { readCalls, setResolved, updateCall, type CallRecord } from "@/lib/calls";
import { formatPercentFromProbability } from "@/lib/format";

const CAPTION_HEAD =
  "font-body text-[13px] font-medium uppercase tracking-[0.1em] text-text-faint";

const PANEL = "rounded-xl border border-hairline bg-surface";

const PRIMARY_BUTTON =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 font-body text-[14px] font-semibold text-accent-ink transition-colors duration-150 hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const TH =
  "px-4 py-3 font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint";

const TD = "px-4 py-3 align-top";

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const CHIP_BUTTON =
  "min-h-[32px] rounded-full border border-hairline px-3 font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted transition-colors duration-150 hover:border-accent/60 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const TEXT_BUTTON =
  "min-h-[32px] rounded font-body text-[13px] font-semibold text-accent underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** The user's side of a call: above 50 is YES, below 50 is NO, 50 is a coin flip. */
function sideOf(probability: number): "yes" | "no" | "even" {
  if (probability > 50) {
    return "yes";
  }
  if (probability < 50) {
    return "no";
  }
  return "even";
}

function gapPoints(call: CallRecord): number | null {
  if (call.commitImplied === null) {
    return null;
  }
  return Math.round(call.probability - call.commitImplied * 100);
}

function gapTone(points: number | null): string {
  if (points === null || points === 0) {
    return "text-text-muted";
  }
  return points > 0 ? "text-positive" : "text-negative";
}

/**
 * The written result. A call at exactly 50 held no side, so it stays
 * factual rather than claiming the user was right or wrong.
 */
function resultOf(call: CallRecord): string {
  if (!call.resolved || call.outcomeYes === null) {
    return "unsettled";
  }
  const side = sideOf(call.probability);
  if (side === "even") {
    return "settled";
  }
  const held = side === "yes" ? "YES" : "NO";
  const correct = call.outcomeYes === (side === "yes");
  return `${correct ? "correct" : "wrong"}, held ${held}`;
}

function statusOf(call: CallRecord): string {
  if (!call.resolved || call.outcomeYes === null) {
    return "open";
  }
  return call.outcomeYes ? "settled, resolved YES" : "settled, resolved NO";
}

function statusTone(call: CallRecord): string {
  return call.resolved && call.outcomeYes !== null
    ? "text-positive"
    : "text-text-muted";
}

function committedStamp(call: CallRecord): string {
  const parsed = new Date(call.committedAt);
  if (Number.isNaN(parsed.getTime())) {
    return call.committedAt;
  }
  return parsed.toISOString().slice(0, 16).replace("T", " ");
}

function CallRow({
  call,
  onSettle,
  onReopen,
}: {
  call: CallRecord;
  onSettle: (id: string, outcomeYes: boolean) => void;
  onReopen: (id: string) => void;
}) {
  const points = gapPoints(call);
  const gapLabel =
    points === null
      ? "n/a"
      : points > 0
        ? `+${points}`
        : points < 0
          ? `${points}`
          : "0";
  const settled = call.resolved && call.outcomeYes !== null;

  return (
    <tr className="border-b border-hairline-soft transition-colors duration-150 last:border-b-0 hover:bg-raised">
      <td className={`${TD} min-w-[220px]`}>
        <p className="text-[14.5px] leading-[1.45] text-text">{call.question}</p>
        <p className="mt-1.5 font-data text-[10.5px] tabular-nums text-text-faint">
          logged {committedStamp(call)} UTC
        </p>
      </td>
      <td className={`${TD} text-right font-data text-[13px] font-medium tabular-nums text-accent`}>
        {Math.round(call.probability)}%
      </td>
      <td className={`${TD} text-right font-data text-[13px] tabular-nums text-text-muted`}>
        {formatPercentFromProbability(call.commitImplied)}
      </td>
      <td className={`${TD} text-right font-data text-[13px] tabular-nums ${gapTone(points)}`}>
        {gapLabel}
      </td>
      <td className={`${TD} font-data text-[11px] font-medium uppercase tracking-[0.1em] ${statusTone(call)}`}>
        {statusOf(call)}
      </td>
      <td className={`${TD} text-[13px] leading-[1.5] ${settled ? "text-text" : "text-text-faint"}`}>
        {resultOf(call)}
      </td>
      <td className={`${TD} text-right`}>
        <MarkSettled call={call} onSettle={onSettle} onReopen={onReopen} />
      </td>
    </tr>
  );
}

function MarkSettled({
  call,
  onSettle,
  onReopen,
}: {
  call: CallRecord;
  onSettle: (id: string, outcomeYes: boolean) => void;
  onReopen: (id: string) => void;
}) {
  const settled = call.resolved && call.outcomeYes !== null;

  if (settled) {
    return (
      <button
        type="button"
        onClick={() => onReopen(call.id)}
        className={TEXT_BUTTON}
      >
        Reopen
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Mark ${call.question} settled`}
      className="flex flex-wrap items-center gap-1.5"
    >
      <button
        type="button"
        onClick={() => onSettle(call.id, true)}
        aria-label={`Mark ${call.question} resolved Yes`}
        className={CHIP_BUTTON}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onSettle(call.id, false)}
        aria-label={`Mark ${call.question} resolved No`}
        className={CHIP_BUTTON}
      >
        No
      </button>
    </div>
  );
}

function SkeletonRows() {
  const bar = "rounded bg-raised motion-safe:animate-pulse";
  return (
    <div className={`overflow-hidden ${PANEL}`} aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-6 border-b border-hairline-soft px-4 py-4 last:border-b-0"
        >
          <div className={`h-4 w-full max-w-[320px] ${bar}`} />
          <div className="flex shrink-0 gap-6">
            <div className={`h-4 w-10 ${bar}`} />
            <div className={`h-4 w-12 ${bar}`} />
            <div className={`h-4 w-20 ${bar}`} />
          </div>
        </div>
      ))}
      <p className="sr-only">Reading saved calls from this browser</p>
    </div>
  );
}

export default function JournalPage() {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);

  const loadCalls = useCallback(() => {
    setCalls(readCalls());
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const handleSettle = useCallback(
    (id: string, outcomeYes: boolean) => {
      setResolved(id, outcomeYes);
      loadCalls();
    },
    [loadCalls],
  );

  const handleReopen = useCallback(
    (id: string) => {
      updateCall(id, { resolved: false, outcomeYes: null });
      loadCalls();
    },
    [loadCalls],
  );

  const ordered = useMemo(() => {
    const list = calls ?? [];
    const byNewest = (a: CallRecord, b: CallRecord) =>
      Date.parse(b.committedAt) - Date.parse(a.committedAt);
    const open = list.filter((call) => !call.resolved).sort(byNewest);
    const settled = list.filter((call) => call.resolved).sort(byNewest);
    return [...open, ...settled];
  }, [calls]);

  const settledCount = useMemo(
    () => (calls ?? []).filter((call) => call.resolved).length,
    [calls],
  );
  const total = calls?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col px-5 py-8 sm:px-6 sm:py-10">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[clamp(30px,4vw,46px)] font-bold uppercase leading-[1.05] tracking-[0.02em] text-text">
              Journal
            </h1>
            <p className="max-w-[62ch] text-[15.5px] leading-[1.6] text-text-muted">
              Every call you logged, with the market price frozen at the moment
              you committed it. Mark a market settled when it resolves, and
              Edgebook scores whether your call beat the price it met.
            </p>
          </div>
          <p className="pt-2 font-data text-[11px] font-medium uppercase tracking-[0.1em] tabular-nums text-text-faint">
            CALLS {total} / SETTLED {settledCount}
          </p>
        </div>
        <div className="mt-5 h-px w-full bg-hairline" />
      </header>

      <div className="mt-8 flex flex-col gap-3">
        <p className="font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
          Market data from the Nansen API
        </p>
        {calls === null ? (
          <SkeletonRows />
        ) : ordered.length === 0 ? (
          <EmptyJournal />
        ) : (
          <div className={`overflow-x-auto ${PANEL}`}>
            <table className="w-full border-collapse">
              <caption className="sr-only">
                Your logged calls with the market price at commit, the gap, and
                the settled result
              </caption>
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className={`${TH} text-left`}>Market</th>
                  <th scope="col" className={`${TH} text-right`}>Your call</th>
                  <th scope="col" className={`${TH} text-right`}>Market at commit</th>
                  <th scope="col" className={`${TH} text-right`}>Gap</th>
                  <th scope="col" className={`${TH} text-left`}>Status</th>
                  <th scope="col" className={`${TH} text-left`}>Result</th>
                  <th scope="col" className={`${TH} text-left`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((call) => (
                  <CallRow
                    key={call.id}
                    call={call}
                    onSettle={handleSettle}
                    onReopen={handleReopen}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[12px] leading-[1.6] text-text-faint">
          Calls are saved in this browser only. Nothing is sent anywhere.
        </p>
      </div>
    </div>
  );
}

function EmptyJournal() {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-surface px-6 py-10 text-center">
      <p className="font-display text-[22px] font-semibold uppercase tracking-[0.02em] text-text">
        No calls yet
      </p>
      <p className="mx-auto mt-2 max-w-[54ch] text-[14.5px] leading-[1.6] text-text-muted">
        Log one from a live market and it appears here with its frozen snapshot.
        Calls live in this browser only.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link href="/markets" className={PRIMARY_BUTTON}>
          Browse markets
        </Link>
      </div>
    </div>
  );
}
