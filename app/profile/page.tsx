"use client";

/**
 * /profile, the Edge report.
 *
 * Answers one question: does the user's call beat the market price it met?
 * Every number comes from lib/scoring.ts over the settled calls in the local
 * store. This page makes no API calls and imports no server code, so no Nansen
 * key is ever in play. The only Nansen data it shows is the market price
 * snapshotted when the call was committed.
 *
 * Market data in Edgebook comes from the Nansen API. Powered by Nansen API.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { readCalls, type CallRecord } from "@/lib/calls";
import {
  brierScore,
  calibrationBuckets,
  edgeVsMarket,
  marketBrierScore,
  type CalibrationBucket,
} from "@/lib/scoring";

const PANEL_PAD = "rounded-xl border border-hairline bg-surface p-5";

const CAPTION_HEAD =
  "font-body text-[13px] font-medium uppercase tracking-[0.1em] text-text-faint";

const PRIMARY_BUTTON =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 font-body text-[14px] font-semibold text-accent-ink transition-colors duration-150 hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const ACCENT = "#7FD6E6";
const NEGATIVE = "#F0766B";
const MARKET = "#8593A3";
const HAIRLINE = "#232B36";
const FAINT = "#7F8C9C";
const SURFACE = "#0F131A";

/** The span the ring maps edge onto, minus 0.25 to plus 0.25. */
const EDGE_SPAN = 0.25;

/** Buckets under this many calls are too thin to read a shape from. */
const THIN_BUCKET = 3;

/**
 * Formats a number, or "n/a" when it is missing or not finite. Nothing reaches
 * the screen as NaN, Infinity, or undefined.
 */
function num(value: number | null | undefined, digits: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

/** A fixed number with the sign always written. */
function signed(value: number | null | undefined, digits: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  const text = Math.abs(value).toFixed(digits);
  if (value > 0) {
    return `+${text}`;
  }
  if (value < 0) {
    return `-${text}`;
  }
  return text;
}

function edgeTone(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return "text-text-muted";
  }
  return value > 0 ? "text-positive" : "text-negative";
}

function edgeStroke(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return MARKET;
  }
  return value > 0 ? ACCENT : NEGATIVE;
}

/** Maps edge from minus 0.25 to plus 0.25 onto the 0 to 1 sweep of the ring. */
function edgeFraction(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0.5;
  }
  const clamped = Math.max(-EDGE_SPAN, Math.min(EDGE_SPAN, value));
  return (clamped + EDGE_SPAN) / (EDGE_SPAN * 2);
}

/** Your side of a call. Exactly 50 held no side, so it is neither. */
function sideOf(probability: number): "yes" | "no" | "even" {
  if (probability > 50) {
    return "yes";
  }
  if (probability < 50) {
    return "no";
  }
  return "even";
}

function isSettled(call: CallRecord): boolean {
  return call.resolved === true && typeof call.outcomeYes === "boolean";
}

/**
 * Share of settled calls where your side matched the outcome. Calls at
 * exactly 50 held no side, so they are excluded from the sample.
 */
function winRate(settled: readonly CallRecord[]): {
  rate: number | null;
  sample: number;
} {
  let wins = 0;
  let sample = 0;
  for (const call of settled) {
    const side = sideOf(call.probability);
    if (side === "even") {
      continue;
    }
    sample += 1;
    if (call.outcomeYes === (side === "yes")) {
      wins += 1;
    }
  }
  if (sample === 0) {
    return { rate: null, sample: 0 };
  }
  return { rate: wins / sample, sample };
}

/** Settled calls that also carry a frozen market price, the scored sample. */
export default function ProfilePage() {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);

  useEffect(() => {
    setCalls(readCalls());
  }, []);

  const settled = useMemo(() => (calls ?? []).filter(isSettled), [calls]);
  const scored = useMemo(() => pricedSettled(settled), [settled]);
  const yourBrier = useMemo(() => brierScore(settled), [settled]);
  const marketBrier = useMemo(() => marketBrierScore(settled), [settled]);
  const edge = useMemo(() => edgeVsMarket(settled), [settled]);
  const buckets = useMemo(() => calibrationBuckets(settled), [settled]);
  const wins = useMemo(() => winRate(settled), [settled]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col px-5 py-8 sm:px-6 sm:py-10">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[clamp(30px,4vw,46px)] font-bold uppercase leading-[1.05] tracking-[0.02em] text-text">
              Edge
            </h1>
            <p className="max-w-[62ch] text-[15.5px] leading-[1.6] text-text-muted">
              Scored only against the market price frozen when you committed each
              call. Positive edge means your probabilities landed closer to the
              real outcome than the market&apos;s did.
            </p>
          </div>
          <p className="pt-2 font-data text-[11px] font-medium uppercase tracking-[0.1em] tabular-nums text-text-faint">
            SETTLED {settled.length} / SCORED {scored.length}
          </p>
        </div>
        <div className="mt-5 h-px w-full bg-hairline" />
      </header>

      <div className="mt-8 flex flex-col gap-3">
        <p className="font-data text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
          Market data from the Nansen API
        </p>
        {calls === null ? (
          <ProfileSkeleton />
        ) : settled.length === 0 ? (
          <EmptyProfile />
        ) : (
          <div className="grid grid-cols-1 items-start gap-[22px] min-[900px]:grid-cols-[1.35fr_1fr]">
            <div className="flex flex-col gap-[22px]">
              <DialPanel edge={edge} settledCount={settled.length} />
              <CalibrationPanel buckets={buckets} />
            </div>
            <div className="flex flex-col gap-[22px]">
              <Scorecard
                yourBrier={yourBrier}
                marketBrier={marketBrier}
                edge={edge}
                settledCount={settled.length}
                scoredCount={scored.length}
                winRateValue={wins.rate}
                winSample={wins.sample}
              />
              <SamplePanel
                settledCount={settled.length}
                scoredCount={scored.length}
                thinBuckets={buckets.filter(
                  (bucket) => bucket.count > 0 && bucket.count < THIN_BUCKET,
                ).length}
              />
            </div>
          </div>
        )}
        <p className="text-[12px] leading-[1.6] text-text-faint">
          Scoring runs in this browser on the calls you saved. Nothing is sent
          anywhere.
        </p>
      </div>
    </div>
  );
}

/** The signature: a ring filled by edge, clamped into plus or minus 0.25. */
function DialPanel({
  edge,
  settledCount,
}: {
  edge: number | null;
  settledCount: number;
}) {
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - edgeFraction(edge));

  return (
    <section aria-labelledby="edge-dial" className={PANEL_PAD}>
      <h2 id="edge-dial" className={CAPTION_HEAD}>
        Edge vs market
      </h2>
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
        <div className="relative h-[196px] w-[196px] shrink-0">
          <svg
            viewBox="0 0 240 240"
            width="196"
            height="196"
            aria-hidden="true"
            className="-rotate-90"
          >
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke={HAIRLINE}
              strokeWidth="15"
            />
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke={edgeStroke(edge)}
              strokeWidth="15"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{
                transition:
                  "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p
              className={`font-data text-[34px] font-semibold leading-none tabular-nums ${edgeTone(edge)}`}
            >
              {signed(edge, 3)}
            </p>
            <p className="mt-2 font-data text-[10.5px] font-medium uppercase tracking-[0.1em] text-text-faint">
              edge vs market
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-[14px] leading-[1.6] text-text-muted">
            The market&apos;s Brier score minus yours, over{" "}
            <b className="font-data font-semibold tabular-nums text-text">
              {settledCount}
            </b>{" "}
            settled {settledCount === 1 ? "call" : "calls"}.
          </p>
          <p className="text-[13px] leading-[1.6] text-text-faint">
            The ring runs from minus 0.25 to plus 0.25. Center means you scored
            exactly like the market.
          </p>
        </div>
      </div>
    </section>
  );
}


/** Chart geometry in viewBox units. */
const CHART_W = 320;
const CHART_H = 260;
const PLOT_L = 36;
const PLOT_R = 12;
const PLOT_T = 14;
const PLOT_B = 30;
const PLOT_W = CHART_W - PLOT_L - PLOT_R;
const PLOT_H = CHART_H - PLOT_T - PLOT_B;

function plotX(fraction: number): number {
  return PLOT_L + fraction * PLOT_W;
}

function plotY(fraction: number): number {
  return PLOT_T + (1 - fraction) * PLOT_H;
}

type ChartPoint = { x: number; y: number; count: number; label: string };

function CalibrationPanel({ buckets }: { buckets: CalibrationBucket[] }) {
  const points = useMemo<ChartPoint[]>(() => {
    const out: ChartPoint[] = [];
    for (const bucket of buckets) {
      const predicted = bucket.predicted;
      const actual = bucket.actual;
      if (
        predicted === null ||
        actual === null ||
        !Number.isFinite(predicted) ||
        !Number.isFinite(actual)
      ) {
        continue;
      }
      out.push({
        x: plotX(Math.max(0, Math.min(1, predicted / 100))),
        y: plotY(Math.max(0, Math.min(1, actual))),
        count: bucket.count,
        label: bucket.label,
      });
    }
    return out;
  }, [buckets]);

  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const thin = points.filter((point) => point.count < THIN_BUCKET);
  const ticks = [0, 50, 100];

  return (
    <section aria-labelledby="calibration-chart" className={PANEL_PAD}>
      <h2 id="calibration-chart" className={CAPTION_HEAD}>
        Calibration
      </h2>
      <p className="mt-2 text-[13px] leading-[1.6] text-text-muted">
        Your stated probability against how often those calls actually landed
        yes.
      </p>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="mt-3 h-auto w-full"
        role="img"
        aria-label="Calibration chart. Your stated probability on the horizontal axis, the actual yes rate on the vertical axis, one point per probability bucket."
      >
        <rect
          x={PLOT_L}
          y={PLOT_T}
          width={PLOT_W}
          height={PLOT_H}
          fill="none"
          stroke={HAIRLINE}
          strokeWidth="1"
        />
        <line
          x1={plotX(0)}
          y1={plotY(0)}
          x2={plotX(1)}
          y2={plotY(1)}
          stroke={FAINT}
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
        {points.length > 1 ? (
          <polyline
            points={line}
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((point) => (
          <circle
            key={point.label}
            cx={point.x}
            cy={point.y}
            r="4.5"
            fill={MARKET}
            stroke={SURFACE}
            strokeWidth="1.5"
          />
        ))}
        {ticks.map((tick) => (
          <text
            key={`x${tick}`}
            x={plotX(tick / 100)}
            y={CHART_H - 12}
            textAnchor="middle"
            fill={FAINT}
            fontSize="10"
          >
            {tick}
          </text>
        ))}
        <text
          x="12"
          y={plotY(0.5)}
          textAnchor="middle"
          fill={FAINT}
          fontSize="10"
          transform={`rotate(-90 12 ${plotY(0.5)})`}
        >
          actual
        </text>
      </svg>

      <p className="mt-2 text-[12.5px] leading-[1.65] text-text-faint">
        The dashed diagonal is perfect calibration, where your number matches the
        real rate. The accent line is your curve, market colored points are the
        buckets.
        {points.length > 1
          ? ""
          : " One settled bucket cannot draw a curve yet, so the points stand alone."}
        {thin.length > 0
          ? ` ${thin.length} ${
              thin.length === 1 ? "bucket holds" : "buckets hold"
            } fewer than ${THIN_BUCKET} calls, easy to over read.`
          : ""}
      </p>
    </section>
  );
}

function Scorecard({
  yourBrier,
  marketBrier,
  edge,
  settledCount,
  scoredCount,
  winRateValue,
  winSample,
}: {
  yourBrier: number | null;
  marketBrier: number | null;
  edge: number | null;
  settledCount: number;
  scoredCount: number;
  winRateValue: number | null;
  winSample: number;
}) {
  const rows: { label: string; value: string; tone: string }[] = [
    { label: "Your Brier", value: num(yourBrier, 3), tone: "" },
    { label: "Market Brier", value: num(marketBrier, 3), tone: "" },
    { label: "Edge vs market", value: signed(edge, 3), tone: edgeTone(edge) },
    {
      label: "Calls settled",
      value: `${settledCount}, ${scoredCount} priced`,
      tone: "",
    },
    {
      label: "Win rate",
      value:
        winRateValue === null ? "n/a" : `${(winRateValue * 100).toFixed(0)}%`,
      tone: "",
    },
  ];

  return (
    <section aria-labelledby="scorecard" className={PANEL_PAD}>
      <h2 id="scorecard" className={CAPTION_HEAD}>
        Scorecard
      </h2>
      <dl className="mt-3 flex flex-col">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 ${
              index === 0 ? "" : "border-t border-hairline-soft"
            }`}
          >
            <dt className="text-[13px] text-text-muted">{row.label}</dt>
            <dd
              className={`font-data text-[15px] font-medium tabular-nums text-text ${row.tone}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12.5px] leading-[1.65] text-text-faint">
        Lower Brier is better, so edge is the market&apos;s score minus yours.
        {winSample === 0
          ? " Every settled call so far sat at exactly 50, which held no side, so win rate has no sample."
          : ` Win rate counts ${winSample} ${
              winSample === 1 ? "call" : "calls"
            }, excluding any call at exactly 50.`}
      </p>
    </section>
  );
}


/**
 * Stands in for the by category panel. CallRecord carries no tag field, and
 * grouping by question keyword would be guesswork, so this is the honest
 * version: how much sample the report is standing on.
 */
function SamplePanel({
  settledCount,
  scoredCount,
  thinBuckets,
}: {
  settledCount: number;
  scoredCount: number;
  thinBuckets: number;
}) {
  return (
    <section aria-labelledby="sample" className={PANEL_PAD}>
      <h2 id="sample" className={CAPTION_HEAD}>
        Sample
      </h2>
      <p className="mt-2 font-data text-[26px] font-semibold leading-none tabular-nums text-text">
        {settledCount}
      </p>
      <p className="mt-2 text-[13.5px] leading-[1.65] text-text-muted">
        {settledCount === 1 ? "settled call" : "settled calls"}, of which{" "}
        <b className="font-data font-semibold tabular-nums text-text">
          {scoredCount}
        </b>{" "}
        carry a frozen market price and can be scored against it. More settled
        calls sharpen the report and pull the buckets off zero.
      </p>
      {thinBuckets > 0 ? (
        <p className="mt-2 text-[12.5px] leading-[1.65] text-text-faint">
          {thinBuckets} of 5 buckets hold fewer than {THIN_BUCKET} calls, so the
          curve there is a signal with very little behind it.
        </p>
      ) : null}
      <p className="mt-2 text-[12.5px] leading-[1.65] text-text-faint">
        A call carries no category, so Edgebook will not invent one. A by
        category breakdown needs a tag on the record first.
      </p>
    </section>
  );
}

function EmptyProfile() {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-surface px-6 py-10 text-center">
      <p className="font-display text-[22px] font-semibold uppercase tracking-[0.02em] text-text">
        Nothing to score yet
      </p>
      <p className="mx-auto mt-2 max-w-[58ch] text-[14.5px] leading-[1.6] text-text-muted">
        Edge needs settled calls. Mark outcomes in the Journal and the report
        fills in.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link href="/journal" className={PRIMARY_BUTTON}>
          Open the Journal
        </Link>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div
      className="flex flex-col gap-[22px]"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Reading saved calls from this browser.</p>
      <div className={`${PANEL_PAD} flex flex-col gap-4`}>
        <div className="h-3 w-28 rounded bg-raised" />
        <div className="h-[196px] w-[196px] rounded-full border border-hairline" />
      </div>
      <div className="grid grid-cols-1 gap-[22px] min-[900px]:grid-cols-2">
        <div className={PANEL_PAD}>
          <div className="h-3 w-32 rounded bg-raised" />
          <div className="mt-3 h-[220px] w-full rounded bg-raised" />
        </div>
        <div className={PANEL_PAD}>
          <div className="h-3 w-24 rounded bg-raised" />
          <div className="mt-3 h-[120px] w-full rounded bg-raised" />
        </div>
      </div>
    </div>
  );
}

function pricedSettled(settled: readonly CallRecord[]): CallRecord[] {
  return settled.filter(
    (call) =>
      typeof call.commitImplied === "number" &&
      Number.isFinite(call.commitImplied),
  );
}
