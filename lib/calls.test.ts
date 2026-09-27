import { describe, expect, it } from "vitest";

import { makeId, readCalls, STORAGE_KEY, writeCall } from "./calls";
import type { CallRecord } from "./calls";

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  rawSet: (value: string) => void;
};

function memoryStorage(initial?: string | null): MemoryStorage {
  let value: string | null = initial === undefined ? null : initial;
  return {
    getItem: (key: string) => (key === STORAGE_KEY ? value : null),
    setItem: (key: string, next: string) => {
      if (key === STORAGE_KEY) {
        value = next;
      }
    },
    rawSet: (next: string) => {
      value = next;
    },
  };
}

function sampleCall(overrides?: Partial<CallRecord>): CallRecord {
  return {
    id: makeId(),
    market_id: "market-1",
    question: "Will ETH close above $5,000 on Dec 31, 2026?",
    probability: 52,
    reason: "ETF inflow trend plus shrinking exchange supply.",
    commitImplied: 0.41,
    commitVolume24h: 1240000,
    commitLiquidity: 412000,
    commitTraders24h: 1908,
    holdersTop3: [{ address: "0xabc", side: "YES" }],
    committedAt: "2026-09-27T00:00:00.000Z",
    resolved: false,
    outcomeYes: null,
    ...overrides,
  };
}

describe("readCalls", () => {
  it("returns an empty list for an empty store and never throws", () => {
    expect(readCalls(memoryStorage())).toEqual([]);
    expect(readCalls(memoryStorage(""))).toEqual([]);
    expect(readCalls(null)).toEqual([]);
  });

  it("tolerates malformed JSON and foreign shapes", () => {
    expect(readCalls(memoryStorage("not json"))).toEqual([]);
    expect(readCalls(memoryStorage("{\"oops\":true}"))).toEqual([]);
    expect(readCalls(memoryStorage("[1, \"two\", null]"))).toEqual([]);
    expect(readCalls(memoryStorage("[{\"nope\":true}]"))).toEqual([]);
  });
});

describe("writeCall then readCalls", () => {
  it("round trips one record through the shared key", () => {
    const store = memoryStorage();
    const record = sampleCall();
    writeCall(record, store);
    const stored = store.getItem(STORAGE_KEY);
    expect(typeof stored).toBe("string");
    expect(readCalls(store)).toEqual([record]);
  });

  it("fills defaults for a record missing optional fields", () => {
    const store = memoryStorage();
    store.rawSet(
      JSON.stringify([
        { id: "call-legacy", market_id: "m-9", probability: 61 },
      ]),
    );
    expect(readCalls(store)).toEqual([
      {
        id: "call-legacy",
        market_id: "m-9",
        question: "Untitled market",
        probability: 61,
        reason: "",
        commitImplied: null,
        commitVolume24h: null,
        commitLiquidity: null,
        commitTraders24h: null,
        holdersTop3: [],
        committedAt: new Date(0).toISOString(),
        resolved: false,
        outcomeYes: null,
      },
    ]);
  });
});
