import type { NumberedTile, OkeyColor, OkeyTile } from "./types.js";
import { naturalValue, isValidRun, isValidSet, meldPoints, orderMeldForDisplay, bestPairs } from "./meld-check.js";
import { tileSig } from "./rack-order.js";

// Client-side rack arrangement helper. "Seri Diz" / "Çift Diz" do NOT open the
// hand — they only re-lay the player's own tiles on the rack into the highest
// scoring runs/sets (or pairs), so the player can review and then press "Aç".
// This mirrors the server's `decompose` (which stays the source of truth for the
// actual opening move); kept in sync intentionally.

const COLOR_ORDER: Record<OkeyColor, number> = { red: 0, yellow: 1, black: 2, blue: 3 };
const NODE_CAP = 200000;

function isValidMeld(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  return isValidRun(tiles, okey) || isValidSet(tiles, okey);
}

function cmpNatural(a: NumberedTile, b: NumberedTile): number {
  if (a.value !== b.value) return a.value - b.value;
  return COLOR_ORDER[a.color] - COLOR_ORDER[b.color];
}

function combinations<T>(arr: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [head, ...rest] = arr;
  const withHead = combinations(rest, k - 1).map((c) => [head as T, ...c]);
  const without = combinations(rest, k);
  return [...withHead, ...without];
}

export interface Decomposition { groups: OkeyTile[][]; value: number; tilesUsed: number; }

/** Best decomposition into runs/sets maximizing total represented value. */
export function decompose(tiles: readonly OkeyTile[], okey: NumberedTile): Decomposition {
  const n = tiles.length;
  const used: boolean[] = new Array(n).fill(false);
  const nat: (NumberedTile | null)[] = tiles.map((t) => naturalValue(t, okey));
  const wildFlag: boolean[] = nat.map((x) => x === null);
  const natOrder: number[] = tiles
    .map((_, i) => i)
    .filter((i) => !wildFlag[i])
    .sort((a, b) => cmpNatural(nat[a]!, nat[b]!));

  const best = { groups: [] as OkeyTile[][], value: 0, tilesUsed: 0 };
  const cur: OkeyTile[][] = [];
  let curValue = 0;
  let curTiles = 0;
  let nodes = 0;

  const isBetter = (v: number, t: number): boolean => v > best.value || (v === best.value && t > best.tilesUsed);

  const unusedWilds = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) if (wildFlag[i] && !used[i]) out.push(i);
    return out;
  };
  const firstUnusedNatural = (): number => {
    for (const i of natOrder) if (!used[i]) return i;
    return -1;
  };
  const natAt = (color: OkeyColor, value: number): number => {
    for (const i of natOrder) {
      if (used[i]) continue;
      const t = nat[i]!;
      if (t.color === color && t.value === value) return i;
    }
    return -1;
  };
  const remainingValuePotential = (): number => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      v += wildFlag[i] ? 13 : nat[i]!.value;
    }
    return v;
  };

  const meldsContaining = (anchor: number): number[][] => {
    const a = nat[anchor]!;
    const result: number[][] = [];
    const wilds = unusedWilds();

    const byColor = new Map<OkeyColor, number>();
    for (const i of natOrder) {
      if (used[i] || i === anchor) continue;
      const u = nat[i]!;
      if (u.value === a.value && u.color !== a.color && !byColor.has(u.color)) byColor.set(u.color, i);
    }
    const otherColorNats = [...byColor.values()];
    for (let o = 0; o <= otherColorNats.length; o++) {
      const combos = combinations(otherColorNats, o);
      for (const others of combos) {
        for (let w = 0; w <= wilds.length; w++) {
          const size = 1 + o + w;
          if (size < 3 || size > 4) continue;
          const meld = [anchor, ...others, ...wilds.slice(0, w)];
          if (isValidMeld(meld.map((i) => tiles[i]!), okey)) result.push(meld);
        }
      }
    }

    for (let lo = Math.max(1, a.value - 12); lo <= a.value; lo++) {
      for (let hi = Math.max(a.value, lo + 2); hi <= 13; hi++) {
        const picks: number[] = [];
        let need = 0;
        for (let v = lo; v <= hi; v++) {
          if (v === a.value) { picks.push(anchor); continue; }
          const idx = natAt(a.color, v);
          if (idx !== -1) picks.push(idx);
          else need++;
        }
        if (need > wilds.length) continue;
        const meld = [...picks, ...wilds.slice(0, need)];
        if (meld.length < 3) continue;
        if (isValidMeld(meld.map((i) => tiles[i]!), okey)) result.push(meld);
      }
    }
    return result;
  };

  const recurse = (): void => {
    nodes++;
    if (isBetter(curValue, curTiles)) {
      best.value = curValue;
      best.tilesUsed = curTiles;
      best.groups = cur.map((g) => [...g]);
    }
    if (nodes > NODE_CAP) return;
    if (curValue + remainingValuePotential() < best.value) return;

    const anchor = firstUnusedNatural();
    if (anchor === -1) return;

    for (const meld of meldsContaining(anchor)) {
      const tilesArr = meld.map((i) => tiles[i]!);
      const v = meldPoints(tilesArr, okey);
      for (const i of meld) used[i] = true;
      cur.push(tilesArr);
      curValue += v;
      curTiles += meld.length;
      recurse();
      curValue -= v;
      curTiles -= meld.length;
      cur.pop();
      for (const i of meld) used[i] = false;
    }

    used[anchor] = true;
    recurse();
    used[anchor] = false;
  };

  recurse();
  return { groups: best.groups, value: best.value, tilesUsed: best.tilesUsed };
}

/** Tiles in `hand` not present in any group (matched by multiset). */
function leftoverTiles(hand: readonly OkeyTile[], groups: readonly OkeyTile[][]): OkeyTile[] {
  const counts = new Map<string, number>();
  for (const g of groups) for (const t of g) counts.set(tileSig(t), (counts.get(tileSig(t)) ?? 0) + 1);
  const out: OkeyTile[] = [];
  for (const t of hand) {
    const k = tileSig(t);
    const c = counts.get(k) ?? 0;
    if (c > 0) counts.set(k, c - 1);
    else out.push(t);
  }
  return out;
}

function tryLayout(
  groups: readonly OkeyTile[][],
  leftovers: readonly OkeyTile[],
  rows: number,
  cols: number,
  gapLeftovers: boolean,
): (string | null)[] | null {
  const slots: (string | null)[] = new Array(rows * cols).fill(null);
  let r = 0;
  let c = 0;
  const place = (tiles: readonly OkeyTile[], gapBefore: boolean): boolean => {
    if (gapBefore && c > 0) c++;
    if (c + tiles.length > cols) { r++; c = 0; }
    if (r >= rows) return false;
    for (const t of tiles) { slots[r * cols + c] = tileSig(t); c++; }
    return true;
  };
  // Meld groups must always be isolated by a gap so they read as separate melds.
  for (const g of groups) if (!place(g, true)) return null;
  // Leftovers: gap each (roomy hands) or pack them after one gap (tight hands).
  let first = true;
  for (const t of leftovers) {
    if (!place([t], gapLeftovers || first)) return null;
    first = false;
  }
  return slots;
}

/**
 * Lay groups (each contiguous, in order) into a rows×cols slot grid. Meld groups
 * are always separated by a one-slot gap. Leftovers are gapped too when they fit
 * (so they read as singletons); otherwise they are packed contiguously after a
 * single gap. Only if the meld groups themselves cannot fit do we compact-fill.
 */
export function layoutSlots(groups: readonly OkeyTile[][], leftovers: readonly OkeyTile[], rows: number, cols: number): (string | null)[] {
  const gapped = tryLayout(groups, leftovers, rows, cols, true);
  if (gapped) return gapped;
  const packed = tryLayout(groups, leftovers, rows, cols, false);
  if (packed) return packed;

  // Last resort: compact, no gaps (groups-first so melds stay contiguous blocks).
  const all = [...groups.flat(), ...leftovers];
  const compact: (string | null)[] = new Array(rows * cols).fill(null);
  for (let i = 0; i < all.length && i < rows * cols; i++) compact[i] = tileSig(all[i]!);
  return compact;
}

/**
 * "Seri Diz": arrange the hand into the highest-value runs/sets on the rack.
 * Returns null when there is no meld to form (nothing to do — leave the rack as is).
 */
export function arrangeMelds(hand: readonly OkeyTile[], okey: NumberedTile, rows: number, cols: number): (string | null)[] | null {
  const d = decompose(hand, okey);
  if (d.groups.length === 0) return null;
  const ordered = d.groups.map((g) => orderMeldForDisplay(g, okey));
  return layoutSlots(ordered, leftoverTiles(hand, d.groups), rows, cols);
}

/**
 * "Çift Diz": arrange the hand into the best pairs on the rack.
 * Returns null when no pair can be formed.
 */
export function arrangePairs(hand: readonly OkeyTile[], okey: NumberedTile, rows: number, cols: number): (string | null)[] | null {
  const pairs = bestPairs(hand, okey);
  if (pairs.length === 0) return null;
  return layoutSlots(pairs, leftoverTiles(hand, pairs), rows, cols);
}
