/**
 * Pure scoring helpers for the Edge report.
 *
 * Each helper works over resolved calls only, where resolved is true and
 * outcomeYes is a boolean. Every function returns null, or an empty list for
 * buckets, when there are no resolved calls, and never returns NaN.
 */

import type { CallRecord } from "./calls";

export type CalibrationBucket = {
  label: string;
  low: number;
  high: number;
  predicted: number | null;
  actual: number | null;
  count: number;
};

const BUCKETS: { label: string; low: number; high: number }[] = [
  { label: "0 to 20", low: 0, high: 20 },
  { label: "20 to 40", low: 20, high: 40 },
  { label: "40 to 60", low: 40, high: 60 },
  { label: "60 to 80", low: 60, high: 80 },
  { label: "80 to 100", low: 80, high: 100 },
];

type ResolvedCall = {
  probability: number;
  commitImplied: number | null;
  outcomeYes: boolean;
};

function resolvedCalls(calls: readonly CallRecord[] | null | undefined): ResolvedCall[] {
  if (!Array.isArray(calls)) {
    return [];
  }
  const out: ResolvedCall[] = [];
  for (const call of calls) {
    if (!call || typeof call !== "object") {
      continue;
    }
    if (call.resolved !== true) {
      continue;
    }
    if (call.outcomeYes !== true && call.outcomeYes !== false) {
      continue;
    }
    const probability =
      typeof call.probability === "number" &&
      Number.isFinite(call.probability) &&
      call.probability >= 0 &&
      call.probability <= 100
        ? call.probability
        : null;
    if (probability === null) {
      continue;
    }
    const commitImplied =
      typeof call.commitImplied === "number" &&
      Number.isFinite(call.commitImplied) &&
      call.commitImplied >= 0 &&
      call.commitImplied <= 1
        ? call.commitImplied
        : null;
    out.push({ probability, commitImplied, outcomeYes: call.outcomeYes });
  }
  return out;
}

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  const result = sum / values.length;
  return Number.isFinite(result) ? result : null;
}

/** Mean squared error of your stated probabilities against outcomes. */
export function brierScore(
  calls: readonly CallRecord[] | null | undefined,
): number | null {
  const resolved = resolvedCalls(calls);
  if (resolved.length === 0) {
    return null;
  }
  const errors = resolved.map((call) => {
    const outcome = call.outcomeYes ? 1 : 0;
    return (call.probability / 100 - outcome) ** 2;
  });
  return mean(errors);
}

/** Mean squared error of the frozen market implied prices. */
export function marketBrierScore(
  calls: readonly CallRecord[] | null | undefined,
): number | null {
  const resolved = resolvedCalls(calls).filter(
    (call) => call.commitImplied !== null,
  );
  if (resolved.length === 0) {
    return null;
  }
  const errors = resolved.map((call) => {
    const outcome = call.outcomeYes ? 1 : 0;
    return ((call.commitImplied ?? 0) - outcome) ** 2;
  });
  return mean(errors);
}

/** Market Brier minus your Brier. Positive means your calls beat the market. */
export function edgeVsMarket(
  calls: readonly CallRecord[] | null | undefined,
): number | null {
  const yours = brierScore(calls);
  const market = marketBrierScore(calls);
  if (yours === null || market === null) {
    return null;
  }
  const edge = market - yours;
  return Number.isFinite(edge) ? edge : null;
}

/**
 * Groups resolved calls into five probability buckets with the mean stated
 * probability, the actual yes rate, and the count. Empty buckets keep null
 * means and a count of zero.
 */
export function calibrationBuckets(
  calls: readonly CallRecord[] | null | undefined,
): CalibrationBucket[] {
  const resolved = resolvedCalls(calls);
  return BUCKETS.map((bucket, index) => {
    const last = index === BUCKETS.length - 1;
    const members = resolved.filter((call) =>
      last
        ? call.probability >= bucket.low && call.probability <= bucket.high
        : call.probability >= bucket.low && call.probability < bucket.high,
    );
    const count = members.length;
    if (count === 0) {
      return {
        label: bucket.label,
        low: bucket.low,
        high: bucket.high,
        predicted: null,
        actual: null,
        count: 0,
      };
    }
    return {
      label: bucket.label,
      low: bucket.low,
      high: bucket.high,
      predicted: mean(members.map((call) => call.probability)),
      actual: mean(members.map((call) => (call.outcomeYes ? 1 : 0))),
      count,
    };
  });
}
