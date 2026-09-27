/**
 * Pure formatting helpers shared by the markets surface and the unit tests.
 *
 * Market data in Edgebook comes from the Nansen API. Powered by Nansen API.
 * Numbers arrive from the screener as numbers or as numeric strings, and any
 * field can be missing, so every helper accepts unknown and returns a written
 * result instead of throwing.
 */

export type MarketLike = {
  market_id?: unknown;
  question?: unknown;
  best_bid?: unknown;
  best_ask?: unknown;
  last_trade_price?: unknown;
  volume_24hr?: unknown;
  liquidity?: unknown;
  unique_traders_24h?: unknown;
  tags?: unknown;
  one_day_price_change?: unknown;
  created_at?: unknown;
};

/** Reads a finite number from a number, a numeric string, or null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[\s,$]/g, "");
    if (cleaned === "") {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Formats a USD amount like $1.24M, $9.5K, or $42. Missing input is n/a. */
export function formatUsd(value: unknown): string {
  const amount = toNumber(value);
  if (amount === null) {
    return "n/a";
  }

  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

/** Formats a whole count like 1,240. Missing input is n/a. */
export function formatCount(value: unknown): string {
  const count = toNumber(value);
  if (count === null) {
    return "n/a";
  }
  return count.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * The implied price of a market: the mean of best bid and best ask when both
 * are numbers, else the last trade price, else null.
 */
export function impliedPrice(
  market: MarketLike | null | undefined,
): number | null {
  if (!market || typeof market !== "object") {
    return null;
  }

  const bid = toNumber(market.best_bid);
  const ask = toNumber(market.best_ask);
  if (bid !== null && ask !== null) {
    return (bid + ask) / 2;
  }

  return toNumber(market.last_trade_price);
}

/**
 * Renders a probability as a whole percent, 0.41 becomes 41%. Values inside
 * 0..1 are read as probabilities, values outside that range are read as an
 * already scaled percent, 41 stays 41%. Missing input is n/a.
 */
export function formatPercentFromProbability(value: unknown): string {
  const probability = toNumber(value);
  if (probability === null) {
    return "n/a";
  }

  const scaled =
    probability >= 0 && probability <= 1 ? probability * 100 : probability;
  return `${Math.round(scaled)}%`;
}

/** Formats a 24h move as points, +9.0 pts or -4.2 pts. Missing input is n/a. */
export function formatPointDelta(value: unknown): string {
  const change = toNumber(value);
  if (change === null) {
    return "n/a";
  }

  const points = Math.abs(change) <= 1 ? change * 100 : change;
  const sign = points > 0 ? "+" : points < 0 ? "-" : "";
  return `${sign}${Math.abs(points).toFixed(1)} pts`;
}

/** Direction of a 24h move, so color never carries the meaning alone. */
export function deltaDirection(value: unknown): "up" | "down" | "flat" {
  const change = toNumber(value);
  if (change === null || change === 0) {
    return "flat";
  }
  return change > 0 ? "up" : "down";
}

/** Normalizes the tags field, which may be strings, objects, or a string list. */
export function readTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const entry of value) {
      if (typeof entry === "string") {
        const tag = entry.trim();
        if (tag !== "") {
          out.push(tag);
        }
        continue;
      }
      if (typeof entry === "object" && entry !== null) {
        const record = entry as Record<string, unknown>;
        const candidate =
          record.tag ?? record.name ?? record.label ?? record.slug;
        if (typeof candidate === "string" && candidate.trim() !== "") {
          out.push(candidate.trim());
        }
      }
    }
    return out;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
  }

  return [];
}

/** The market with the largest absolute 24h price change, or null. */
export function pickBiggestMove(
  markets: readonly MarketLike[] | null | undefined,
): MarketLike | null {
  if (!markets || markets.length === 0) {
    return null;
  }

  let best: MarketLike | null = null;
  let bestAbs = -1;

  for (const market of markets) {
    const change =
      market && typeof market === "object"
        ? toNumber(market.one_day_price_change)
        : null;
    if (change === null) {
      continue;
    }
    const abs = Math.abs(change);
    if (abs > bestAbs) {
      bestAbs = abs;
      best = market;
    }
  }

  return best;
}

/** The most frequent tag across the returned markets, with its market count. */
export function pickHotTag(
  markets: readonly MarketLike[] | null | undefined,
): { tag: string; count: number } | null {
  if (!markets || markets.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const market of markets) {
    if (!market || typeof market !== "object") {
      continue;
    }
    for (const tag of readTags(market.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  let best: { tag: string; count: number } | null = null;
  for (const [tag, count] of counts) {
    if (best === null || count > best.count) {
      best = { tag, count };
    }
  }

  return best;
}
