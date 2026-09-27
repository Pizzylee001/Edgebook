import { describe, expect, it } from "vitest";

import type { CallRecord } from "./calls";
import {
  brierScore,
  calibrationBuckets,
  edgeVsMarket,
  marketBrierScore,
} from "./scoring";

function call(overrides: Partial<CallRecord> & { id: string }): CallRecord {
  return {
    market_id: "m-1",
    question: "Sample question",
    probability: 50,
    reason: "",
    commitImplied: 0.5,
    commitVolume24h: null,
    commitLiquidity: null,
    commitTraders24h: null,
    holdersTop3: [],
    committedAt: "2026-09-27T00:00:00.000Z",
    resolved: false,
    outcomeYes: null,
    ...overrides,
  };
}

describe("scoring with no resolved calls", () => {
  it("returns null and empty bucket counts instead of NaN", () => {
    expect(brierScore([])).toBeNull();
    expect(marketBrierScore([])).toBeNull();
    expect(edgeVsMarket([])).toBeNull();
    expect(brierScore(null)).toBeNull();
    expect(brierScore([call({ id: "a", resolved: false, outcomeYes: null })])).toBeNull();
    const buckets = calibrationBuckets([]);
    expect(buckets).toHaveLength(5);
    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
    expect(buckets.every((bucket) => bucket.predicted === null)).toBe(true);
  });
});

describe("brierScore", () => {
  it("averages squared error on hand checked calls", () => {
    const calls = [
      call({ id: "a", probability: 100, resolved: true, outcomeYes: true }),
      call({ id: "b", probability: 0, resolved: true, outcomeYes: false }),
      call({ id: "c", probability: 50, resolved: true, outcomeYes: true }),
    ];
    expect(brierScore(calls)).toBeCloseTo((0 + 0 + 0.25) / 3, 10);
  });

  it("skips unresolved calls", () => {
    const calls = [
      call({ id: "a", probability: 100, resolved: true, outcomeYes: false }),
      call({ id: "b", probability: 90, resolved: false, outcomeYes: null }),
    ];
    expect(brierScore(calls)).toBeCloseTo(1, 10);
  });
});

describe("marketBrierScore and edgeVsMarket", () => {
  it("scores frozen implied prices and subtracts your error", () => {
    const calls = [
      call({
        id: "a",
        probability: 80,
        commitImplied: 0.6,
        resolved: true,
        outcomeYes: true,
      }),
      call({
        id: "b",
        probability: 20,
        commitImplied: 0.4,
        resolved: true,
        outcomeYes: false,
      }),
    ];
    expect(marketBrierScore(calls)).toBeCloseTo((0.16 + 0.16) / 2, 10);
    expect(brierScore(calls)).toBeCloseTo((0.04 + 0.04) / 2, 10);
    expect(edgeVsMarket(calls)).toBeCloseTo(0.12, 10);
  });

  it("returns null when no resolved call carries an implied price", () => {
    const calls = [
      call({
        id: "a",
        probability: 80,
        commitImplied: null,
        resolved: true,
        outcomeYes: true,
      }),
    ];
    expect(marketBrierScore(calls)).toBeNull();
    expect(edgeVsMarket(calls)).toBeNull();
  });
});

describe("calibrationBuckets", () => {
  it("places calls in buckets with predicted mean and yes rate", () => {
    const calls = [
      call({ id: "a", probability: 10, resolved: true, outcomeYes: false }),
      call({ id: "b", probability: 30, resolved: true, outcomeYes: true }),
      call({ id: "c", probability: 35, resolved: true, outcomeYes: false }),
      call({ id: "d", probability: 90, resolved: true, outcomeYes: true }),
    ];
    const buckets = calibrationBuckets(calls);
    expect(buckets).toHaveLength(5);
    expect(buckets[0]).toMatchObject({ count: 1, predicted: 10, actual: 0 });
    expect(buckets[1]).toMatchObject({
      count: 2,
      predicted: 32.5,
      actual: 0.5,
    });
    expect(buckets[2]).toMatchObject({ count: 0, predicted: null, actual: null });
    expect(buckets[4]).toMatchObject({ count: 1, predicted: 90, actual: 1 });
  });
});
