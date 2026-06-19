import type { NumberedTile, OkeyTile } from "./types.js";

// Client-side mirror of the server meld rules, used ONLY for live UI feedback
// while building a meld. The server remains the single source of truth and
// re-validates every move. Keep this in sync with server okey.ts/meld.ts/pairs.ts.

const MIN_VALUE = 1;
const MAX_VALUE = 13;

export function isOkeyTile(t: OkeyTile, okey: NumberedTile): boolean {
  return t.kind === "numbered" && t.color === okey.color && t.value === okey.value;
}

/** Concrete numbered tile a tile contributes; null if it is a wildcard (the okey tile). */
export function naturalValue(t: OkeyTile, okey: NumberedTile): NumberedTile | null {
  if (isOkeyTile(t, okey)) return null; // wildcard
  if (t.kind === "fakeJoker") return { kind: "numbered", color: okey.color, value: okey.value };
  return t;
}

function partition(tiles: readonly OkeyTile[], okey: NumberedTile): { naturals: NumberedTile[]; wild: number } {
  const naturals: NumberedTile[] = [];
  let wild = 0;
  for (const t of tiles) {
    const nat = naturalValue(t, okey);
    if (nat === null) wild++;
    else naturals.push(nat);
  }
  return { naturals, wild };
}

export function isValidRun(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  const total = tiles.length;
  if (total < 3) return false;
  const { naturals } = partition(tiles, okey);
  if (naturals.length === 0) return false;
  const color = naturals[0]!.color;
  if (!naturals.every((t) => t.color === color)) return false;
  const values = naturals.map((t) => t.value);
  if (new Set(values).size !== values.length) return false;
  const minNat = Math.min(...values);
  const maxNat = Math.max(...values);
  if (maxNat - minNat + 1 > total) return false;
  const startLow = Math.max(MIN_VALUE, maxNat - total + 1);
  const startHigh = Math.min(minNat, MAX_VALUE - total + 1);
  return startLow <= startHigh;
}

export function isValidSet(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  const total = tiles.length;
  if (total < 3 || total > 4) return false;
  const { naturals, wild } = partition(tiles, okey);
  if (naturals.length === 0) return false;
  const value = naturals[0]!.value;
  if (!naturals.every((t) => t.value === value)) return false;
  const colors = new Set(naturals.map((t) => t.color));
  if (colors.size !== naturals.length) return false;
  return naturals.length + wild <= 4;
}

export function isPair(a: OkeyTile, b: OkeyTile, okey: NumberedTile): boolean {
  const na = naturalValue(a, okey);
  const nb = naturalValue(b, okey);
  if (na === null || nb === null) return true;
  return na.color === nb.color && na.value === nb.value;
}

export function isWildcard(t: OkeyTile, okey: NumberedTile): boolean {
  return isOkeyTile(t, okey);
}

/**
 * Order-sensitive run: tiles read left-to-right must form a strictly ascending
 * consecutive sequence (wildcards fill their position). 7-8-9-10 is valid;
 * 7-8-10-9 is not. Naturals must share one color and stay within 1..13.
 */
export function isOrderedRun(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  if (tiles.length < 3) return false;
  const nats = tiles.map((t) => naturalValue(t, okey));
  const naturals = nats.filter((n): n is NumberedTile => n !== null);
  if (naturals.length === 0) return false;
  const color = naturals[0]!.color;
  if (!naturals.every((n) => n.color === color)) return false;
  const i0 = nats.findIndex((n) => n !== null);
  const v0 = nats[i0]!.value;
  for (let j = 0; j < tiles.length; j++) {
    const expected = v0 + (j - i0);
    if (expected < MIN_VALUE || expected > MAX_VALUE) return false;
    const n = nats[j] ?? null;
    if (n !== null && n.value !== expected) return false;
  }
  return true;
}

/** Greedy optimal pairing (mirrors the server bot): identical tiles pair; wildcards fill singletons. */
export function bestPairs(hand: readonly OkeyTile[], okey: NumberedTile): OkeyTile[][] {
  const wilds: OkeyTile[] = [];
  const byKey = new Map<string, OkeyTile[]>();
  for (const t of hand) {
    if (isWildcard(t, okey)) { wilds.push(t); continue; }
    const nat = naturalValue(t, okey)!;
    const k = `${nat.color}:${nat.value}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(t);
  }
  const pairs: OkeyTile[][] = [];
  const singles: OkeyTile[] = [];
  for (const arr of byKey.values()) {
    let i = 0;
    for (; i + 1 < arr.length; i += 2) pairs.push([arr[i]!, arr[i + 1]!]);
    if (i < arr.length) singles.push(arr[i]!);
  }
  let wi = 0;
  for (const s of singles) { if (wi < wilds.length) { pairs.push([s, wilds[wi]!]); wi++; } }
  for (; wi + 1 < wilds.length; wi += 2) pairs.push([wilds[wi]!, wilds[wi + 1]!]);
  return pairs;
}

export type GroupKind = "run" | "set" | "pair" | "invalid";

/** Order-sensitive classification used for rack groups (runs must be in order). */
export function classifyOrdered(tiles: readonly OkeyTile[], okey: NumberedTile): GroupKind {
  if (tiles.length === 2 && isPair(tiles[0]!, tiles[1]!, okey)) return "pair";
  if (isOrderedRun(tiles, okey)) return "run";
  if (isValidSet(tiles, okey)) return "set";
  return "invalid";
}

/** Classify a staged group for UI feedback. `mode` picks pairs vs melds context. */
export function classifyGroup(tiles: readonly OkeyTile[], okey: NumberedTile, mode: "melds" | "pairs"): GroupKind {
  if (mode === "pairs") {
    return tiles.length === 2 && isPair(tiles[0]!, tiles[1]!, okey) ? "pair" : "invalid";
  }
  if (isValidRun(tiles, okey)) return "run";
  if (isValidSet(tiles, okey)) return "set";
  return "invalid";
}

/** Sum of represented values of a valid run/set; 0 for an invalid group. */
export function meldPoints(tiles: readonly OkeyTile[], okey: NumberedTile): number {
  const { naturals } = partition(tiles, okey);
  if (isValidSet(tiles, okey)) return naturals[0]!.value * tiles.length;
  if (!isValidRun(tiles, okey)) return 0;
  // Wildcards sit at the highest feasible window (matches server runValues).
  const total = tiles.length;
  const values = naturals.map((t) => t.value);
  const start = Math.min(Math.min(...values), MAX_VALUE - total + 1);
  let sum = 0;
  for (let i = 0; i < total; i++) sum += start + i;
  return sum;
}
