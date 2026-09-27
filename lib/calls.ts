/**
 * Client safe calls store.
 *
 * Calls are saved in this browser only, under one shared local storage key.
 * This module never touches the network and never imports server code, so it
 * is safe to use from client components and unit tests.
 */

export const STORAGE_KEY = "edgebook.calls";

export type CallHolder = {
  address: string;
  side: string;
};

export type CallRecord = {
  id: string;
  market_id: string;
  question: string;
  probability: number;
  reason: string;
  commitImplied: number | null;
  commitVolume24h: number | null;
  commitLiquidity: number | null;
  commitTraders24h: number | null;
  holdersTop3: CallHolder[];
  committedAt: string;
  resolved: boolean;
  outcomeYes: boolean | null;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function getDefaultStorage(): StorageLike | null {
  if (typeof window !== "undefined") {
    try {
      const candidate = (
        window as unknown as { localStorage?: StorageLike }
      ).localStorage;
      if (candidate && typeof candidate.getItem === "function") {
        return candidate;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
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

function toProbability(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

function toUnitProbability(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 0 || parsed > 1) {
    return null;
  }
  return parsed;
}

function toCount(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return null;
  }
  return parsed;
}

function toText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function toHolders(value: unknown): CallHolder[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: CallHolder[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const address = record.address;
    const side = record.side;
    if (typeof address !== "string" || address.trim() === "") {
      continue;
    }
    if (typeof side !== "string" || side.trim() === "") {
      continue;
    }
    out.push({ address: address.trim(), side: side.trim() });
    if (out.length >= 3) {
      break;
    }
  }
  return out;
}

/** Normalizes one stored entry. Returns null when the entry cannot be used. */
function normalizeRecord(entry: unknown): CallRecord | null {
  if (typeof entry !== "object" || entry === null) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const id = record.id;
  const marketId = record.market_id;
  const probability = toProbability(record.probability);
  if (
    typeof id !== "string" ||
    id === "" ||
    typeof marketId !== "string" ||
    marketId === "" ||
    probability === null
  ) {
    return null;
  }

  const committedAt =
    typeof record.committedAt === "string" && record.committedAt !== ""
      ? record.committedAt
      : new Date(0).toISOString();

  return {
    id,
    market_id: marketId,
    question: toText(record.question, "Untitled market"),
    probability,
    reason: typeof record.reason === "string" ? record.reason : "",
    commitImplied: toUnitProbability(record.commitImplied),
    commitVolume24h: toCount(record.commitVolume24h),
    commitLiquidity: toCount(record.commitLiquidity),
    commitTraders24h: toCount(record.commitTraders24h),
    holdersTop3: toHolders(record.holdersTop3),
    committedAt,
    resolved: record.resolved === true,
    outcomeYes:
      record.outcomeYes === true
        ? true
        : record.outcomeYes === false
          ? false
          : null,
  };
}

/** Client generated id, readable and unique enough for a local list. */
export function makeId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `call-${stamp}-${random}`;
}

/**
 * Reads saved calls. Tolerates an empty store, malformed JSON, and old
 * shapes, and never throws. Pass a storage object in tests.
 */
export function readCalls(storage?: StorageLike | null): CallRecord[] {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) {
    return [];
  }
  let raw: string | null = null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null || raw.trim() === "") {
    return [];
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { version?: unknown }).version !== "undefined"
    ) {
      return [];
    }
    return [];
  }
  const out: CallRecord[] = [];
  for (const entry of parsed) {
    const normalized = normalizeRecord(entry);
    if (normalized) {
      out.push(normalized);
    }
  }
  return out;
}

/** Appends one call record to the shared store. */
export function writeCall(record: CallRecord, storage?: StorageLike | null): void {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) {
    return;
  }
  const existing = readCalls(store);
  existing.push(record);
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    return;
  }
}
