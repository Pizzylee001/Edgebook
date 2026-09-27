import { describe, expect, it } from "vitest";

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
  toNumber,
} from "./format";

describe("toNumber", () => {
  it("passes numbers through and rejects missing values", () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber("1,240")).toBe(1240);
    expect(toNumber("")).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
    expect(toNumber({})).toBeNull();
  });
});

describe("formatUsd", () => {
  it("formats millions, thousands, and small amounts", () => {
    expect(formatUsd(1240000)).toBe("$1.24M");
    expect(formatUsd(9500)).toBe("$9.5K");
    expect(formatUsd(42)).toBe("$42");
    expect(formatUsd(2500000000)).toBe("$2.50B");
  });

  it("keeps the sign and writes n/a for missing fields", () => {
    expect(formatUsd(-2500000)).toBe("-$2.50M");
    expect(formatUsd(null)).toBe("n/a");
    expect(formatUsd(undefined)).toBe("n/a");
    expect(formatUsd("")).toBe("n/a");
  });

  it("reads a numeric string", () => {
    expect(formatUsd("1,240,000")).toBe("$1.24M");
  });
});

describe("formatCount", () => {
  it("groups thousands and writes n/a for missing fields", () => {
    expect(formatCount(1240)).toBe("1,240");
    expect(formatCount(0)).toBe("0");
    expect(formatCount(null)).toBe("n/a");
  });
});

describe("impliedPrice", () => {
  it("averages bid and ask when both are present", () => {
    expect(impliedPrice({ best_bid: 0.4, best_ask: 0.42 })).toBeCloseTo(0.41);
  });

  it("falls back to the last trade price", () => {
    expect(impliedPrice({ best_bid: 0.4, last_trade_price: 0.37 })).toBe(0.37);
    expect(impliedPrice({ last_trade_price: 0.37 })).toBe(0.37);
  });

  it("returns null when no price field is present", () => {
    expect(impliedPrice({})).toBeNull();
    expect(impliedPrice({ best_bid: null, best_ask: null })).toBeNull();
    expect(impliedPrice(null)).toBeNull();
    expect(impliedPrice(undefined)).toBeNull();
  });
});

describe("formatPercentFromProbability", () => {
  it("renders probabilities in 0..1 as whole percents", () => {
    expect(formatPercentFromProbability(0.41)).toBe("41%");
    expect(formatPercentFromProbability(0)).toBe("0%");
    expect(formatPercentFromProbability(1)).toBe("100%");
    expect(formatPercentFromProbability(0.42)).toBe("42%");
  });

  it("leaves already scaled percents alone and writes n/a when missing", () => {
    expect(formatPercentFromProbability(41)).toBe("41%");
    expect(formatPercentFromProbability(null)).toBe("n/a");
    expect(formatPercentFromProbability(undefined)).toBe("n/a");
  });
});

describe("formatPointDelta", () => {
  it("writes points with a sign", () => {
    expect(formatPointDelta(0.09)).toBe("+9.0 pts");
    expect(formatPointDelta(-0.042)).toBe("-4.2 pts");
    expect(formatPointDelta(0)).toBe("0.0 pts");
    expect(formatPointDelta(5)).toBe("+5.0 pts");
  });

  it("writes n/a when missing", () => {
    expect(formatPointDelta(null)).toBe("n/a");
  });
});

describe("deltaDirection", () => {
  it("reads direction and treats missing values as flat", () => {
    expect(deltaDirection(0.09)).toBe("up");
    expect(deltaDirection(-0.09)).toBe("down");
    expect(deltaDirection(0)).toBe("flat");
    expect(deltaDirection(null)).toBe("flat");
    expect(deltaDirection(undefined)).toBe("flat");
  });
});

describe("readTags", () => {
  it("reads string arrays, object arrays, and comma strings", () => {
    expect(readTags(["Politics"])).toEqual(["Politics"]);
    expect(readTags([{ tag: "Crypto" }])).toEqual(["Crypto"]);
    expect(readTags([{ name: "Sports" }, { label: "Live" }])).toEqual([
      "Sports",
      "Live",
    ]);
    expect(readTags("Politics, Crypto")).toEqual(["Politics", "Crypto"]);
  });

  it("returns an empty list for missing or unusable fields", () => {
    expect(readTags(null)).toEqual([]);
    expect(readTags(undefined)).toEqual([]);
    expect(readTags([null, "", "  "])).toEqual([]);
    expect(readTags(7)).toEqual([]);
  });
});

describe("pickBiggestMove", () => {
  it("picks the largest absolute change, negative included", () => {
    const markets = [
      { market_id: "a", one_day_price_change: 0.04 },
      { market_id: "b", one_day_price_change: -0.31 },
      { market_id: "c", one_day_price_change: 0.12 },
    ];
    expect(pickBiggestMove(markets)?.market_id).toBe("b");
  });

  it("returns null when there is no usable change or no markets", () => {
    expect(pickBiggestMove([])).toBeNull();
    expect(pickBiggestMove(null)).toBeNull();
    expect(
      pickBiggestMove([{ market_id: "a" }, { market_id: "b", one_day_price_change: null }]),
    ).toBeNull();
  });
});

describe("pickHotTag", () => {
  it("returns the most frequent tag with its count", () => {
    const markets = [
      { tags: ["Politics", "Crypto"] },
      { tags: ["Politics"] },
      { tags: ["Sports"] },
    ];
    expect(pickHotTag(markets)).toEqual({ tag: "Politics", count: 2 });
  });

  it("returns null when no market carries a tag", () => {
    expect(pickHotTag([])).toBeNull();
    expect(pickHotTag(null)).toBeNull();
    expect(pickHotTag([{}, { tags: null }])).toBeNull();
  });
});
