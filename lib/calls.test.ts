import { describe, expect, it } from "vitest";

import {
  makeId,
  readCalls,
  setResolved,
  STORAGE_KEY,
  updateCall,
  writeCall,
} from "./calls";
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

describe("updateCall", () => {
  it("merges a patch and reads it back from the store", () => {
    const store = memoryStorage();
    const record = sampleCall({ id: "call-a" });
    writeCall(record, store);
    const updated = updateCall("call-a", { reason: "Revised note" }, store);
    expect(updated?.reason).toBe("Revised note");
    expect(readCalls(store)[0]).toEqual({ ...record, reason: "Revised note" });
  });

  it("returns null for a missing id and never throws", () => {
    const store = memoryStorage();
    writeCall(sampleCall({ id: "call-a" }), store);
    expect(updateCall("call-missing", { reason: "nope" }, store)).toBeNull();
    expect(updateCall("", { reason: "nope" }, store)).toBeNull();
    expect(updateCall("call-a", { reason: "nope" }, null)).toBeNull();
    expect(readCalls(store)[0]?.reason).toBe(
      "ETF inflow trend plus shrinking exchange supply.",
    );
  });

  it("does not throw on a malformed store", () => {
    const store = memoryStorage("not json at all");
    expect(updateCall("call-a", { reason: "nope" }, store)).toBeNull();
    expect(setResolved("call-a", true, store)).toBeNull();
  });
});

describe("setResolved", () => {
  it("sets resolved and outcomeYes, and reopens back to open", () => {
    const store = memoryStorage();
    writeCall(sampleCall({ id: "call-a" }), store);

    const settled = setResolved("call-a", true, store);
    expect(settled?.resolved).toBe(true);
    expect(settled?.outcomeYes).toBe(true);
    expect(readCalls(store)[0]?.outcomeYes).toBe(true);

    const no = setResolved("call-a", false, store);
    expect(no?.outcomeYes).toBe(false);

    const reopened = updateCall(
      "call-a",
      { resolved: false, outcomeYes: null },
      store,
    );
    expect(reopened?.resolved).toBe(false);
    expect(reopened?.outcomeYes).toBeNull();
    expect(readCalls(store)[0]?.resolved).toBe(false);
  });

  it("returns null when the id is not in the store", () => {
    const store = memoryStorage();
    writeCall(sampleCall({ id: "call-a" }), store);
    expect(setResolved("call-zzz", true, store)).toBeNull();
  });
});
