import type { OkeyTile, NumberedTile } from "./tile.js";
import { isWildcard } from "./okey.js";
import { isValidMeld } from "./meld.js";
import { meldValue } from "./points.js";

export interface Decomposition {
  groups: OkeyTile[][];
  value: number;
  tilesUsed: number;
}

export type DecomposeGoal = "maxValue" | "maxTilesUsed";

const COLOR_ORDER: Record<string, number> = { red: 0, yellow: 1, black: 2, blue: 3 };
const NODE_CAP = 50000;

export function tileKey(t: OkeyTile): string {
  return t.kind === "fakeJoker" ? "fake" : `${t.color}:${t.value}`;
}

export function removeTiles(hand: readonly OkeyTile[], remove: readonly OkeyTile[]): OkeyTile[] {
  const counts = new Map<string, number>();
  for (const t of remove) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
  const out: OkeyTile[] = [];
  for (const t of hand) {
    const k = tileKey(t);
    const c = counts.get(k) ?? 0;
    if (c > 0) counts.set(k, c - 1);
    else out.push(t);
  }
  return out;
}

function cmpNatural(a: NumberedTile, b: NumberedTile): number {
  if (a.value !== b.value) return a.value - b.value;
  return (COLOR_ORDER[a.color] ?? 0) - (COLOR_ORDER[b.color] ?? 0);
}

function combinations<T>(arr: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [head, ...rest] = arr;
  const withHead = combinations(rest, k - 1).map((c) => [head as T, ...c]);
  const without = combinations(rest, k);
  return [...withHead, ...without];
}

export function decompose(
  tiles: readonly OkeyTile[],
  okey: NumberedTile,
  goal: DecomposeGoal,
): Decomposition {
  const n = tiles.length;
  const used: boolean[] = new Array(n).fill(false);
  const wildFlag: boolean[] = tiles.map((t) => isWildcard(t, okey));
  const natOrder: number[] = tiles
    .map((_, i) => i)
    .filter((i) => !wildFlag[i])
    .sort((a, b) => cmpNatural(tiles[a] as NumberedTile, tiles[b] as NumberedTile));

  const best = { groups: [] as OkeyTile[][], value: 0, tilesUsed: 0 };
  const cur: OkeyTile[][] = [];
  let curValue = 0;
  let curTiles = 0;
  let nodes = 0;

  const isBetter = (v: number, t: number): boolean => {
    if (goal === "maxValue") return v > best.value || (v === best.value && t > best.tilesUsed);
    return t > best.tilesUsed || (t === best.tilesUsed && v > best.value);
  };

  const unusedWilds = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) if (wildFlag[i] && !used[i]) out.push(i);
    return out;
  };
  const firstUnusedNatural = (): number => {
    for (const i of natOrder) if (!used[i]) return i;
    return -1;
  };
  const natAt = (color: string, value: number): number => {
    for (const i of natOrder) {
      if (used[i]) continue;
      const t = tiles[i] as NumberedTile;
      if (t.color === color && t.value === value) return i;
    }
    return -1;
  };

  const meldsContaining = (anchor: number): number[][] => {
    const a = tiles[anchor] as NumberedTile;
    const result: number[][] = [];
    const wilds = unusedWilds();

    // sets: aynı değer, farklı renkler
    const byColor = new Map<string, number>();
    for (const i of natOrder) {
      if (used[i] || i === anchor) continue;
      const u = tiles[i] as NumberedTile;
      if (u.value === a.value && u.color !== a.color && !byColor.has(u.color)) byColor.set(u.color, i);
    }
    const otherColorNats = [...byColor.values()];
    for (let o = 0; o <= otherColorNats.length; o++) {
      for (const others of combinations(otherColorNats, o)) {
        for (let w = 0; w <= wilds.length; w++) {
          const size = 1 + o + w;
          if (size < 3 || size > 4) continue;
          const meld = [anchor, ...others, ...wilds.slice(0, w)];
          if (isValidMeld(meld.map((i) => tiles[i]!), okey)) result.push(meld);
        }
      }
    }

    // runs: aynı renk, ardışık değerler, anchor dahil
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
    const anchor = firstUnusedNatural();
    if (anchor === -1) return;

    // Branch A: anchor leftover
    used[anchor] = true;
    recurse();
    used[anchor] = false;

    // Branch B: anchor içeren her per
    for (const meld of meldsContaining(anchor)) {
      const tilesArr = meld.map((i) => tiles[i]!);
      const v = meldValue(tilesArr, okey);
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
  };

  recurse();
  return { groups: best.groups, value: best.value, tilesUsed: best.tilesUsed };
}
