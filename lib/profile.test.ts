import { describe, expect, it } from "vitest";

import { readCalls, setResolved, type CallRecord } from "./calls";
import {
  brierScore,
  calibrationBuckets,
  edgeVsMarket,
  marketBrierScore,
} from "./scoring";

function memoryStore(initial: unknown) {
  const map = new Map<string, string>();
  map.set("edgebook.calls", JSON.stringify(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function base(over: Partial<CallRecord>): CallRecord {
  return {
    id: "c1",
    market_id: "1",
    question: "q",
    probability: 70,
    reason: "",
    commitImplied: 0.5,
    commitVolume24h: null,
    commitLiquidity: null,
    commitTraders24h: null,
    holdersTop3: [],
    committedAt: "2026-01-01T00:00:00.000Z",
    resolved: true,
    outcomeYes: true,
    ...over,
  };
}

function edgeFraction(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0.5;
  }
  const clamped = Math.max(-0.25, Math.min(0.25, value));
  return (clamped + 0.25) / 0.5;
}

function sideOf(probability: number): "yes" | "no" | "even" {
  if (probability > 50) {
    return "yes";
  }
  if (probability < 50) {
    return "no";
  }
  return "even";
}

describe("profile report math", () => {
  it("scores a settled store and returns a finite positive edge", () => {
    const store = memoryStore([
      base({ id: "a", probability: 80, commitImplied: 0.5, outcomeYes: true }),
      base({ id: "b", probability: 30, commitImplied: 0.4, outcomeYes: false }),
      base({ id: "c", probability: 65, commitImplied: 0.6, outcomeYes: true }),
      base({ id: "d", probability: 45, resolved: false, outcomeYes: null }),
    ]);
    const calls = readCalls(store);
    const settled = calls.filter(
      (call) => call.resolved === true && typeof call.outcomeYes === "boolean",
    );
    expect(settled).toHaveLength(3);
    const yours = brierScore(settled);
    const market = marketBrierScore(settled);
    const edge = edgeVsMarket(settled);
    expect(yours).not.toBeNull();
    expect(market).not.toBeNull();
    expect(edge).not.toBeNull();
    expect(Number.isFinite(edge as number)).toBe(true);
    expect((edge as number) - (market as number) + (yours as number)).toBeCloseTo(
      0,
      10,
    );
    const fraction = edgeFraction(edge);
    expect(fraction).toBeGreaterThanOrEqual(0);
    expect(fraction).toBeLessThanOrEqual(1);
    const buckets = calibrationBuckets(settled);
    expect(buckets).toHaveLength(5);
    for (const bucket of buckets) {
      if (bucket.predicted !== null) {
        expect(Number.isFinite(bucket.predicted)).toBe(true);
      }
      if (bucket.actual !== null) {
        expect(Number.isFinite(bucket.actual)).toBe(true);
      }
    }
  });

  it("clamps the dial fraction at both ends of the range", () => {
    expect(edgeFraction(9)).toBe(1);
    expect(edgeFraction(-9)).toBe(0);
    expect(edgeFraction(0)).toBeCloseTo(0.5, 10);
    expect(edgeFraction(null)).toBe(0.5);
  });

  it("returns null scores for an empty store so the page shows n/a", () => {
    const store = memoryStore([]);
    const settled = readCalls(store).filter(
      (call) => call.resolved === true && typeof call.outcomeYes === "boolean",
    );
    expect(settled).toHaveLength(0);
    expect(brierScore(settled)).toBeNull();
    expect(marketBrierScore(settled)).toBeNull();
    expect(edgeVsMarket(settled)).toBeNull();
    expect(calibrationBuckets(settled).every((b) => b.count === 0)).toBe(true);
  });

  it("reads back a store that was settled through the store itself", () => {
    const store = memoryStore([
      base({ id: "z", probability: 72, resolved: false, outcomeYes: null }),
    ]);
    const updated = setResolved("z", true, store);
    expect(updated?.resolved).toBe(true);
    expect(updated?.outcomeYes).toBe(true);
    const reread = readCalls(store);
    expect(reread[0].resolved).toBe(true);
    expect(reread[0].outcomeYes).toBe(true);
  });

  it("treats a call at exactly 50 as holding no side", () => {
    expect(sideOf(50)).toBe("even");
    expect(sideOf(50.0001)).toBe("yes");
    expect(sideOf(49.9999)).toBe("no");
  });
});
