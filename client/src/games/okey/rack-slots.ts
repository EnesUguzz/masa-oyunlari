import { useEffect, useState } from "react";
import type { OkeyColor, OkeyTile } from "./types.js";
import { tileSig } from "./rack-order.js";

// The rack (ıstaka) is a fixed grid of slots laid out in rows. Tiles sit in
// slots; an empty slot is a gap that separates groups. A "group" is a run of
// contiguous filled slots within a single row — that is how the player forms
// melds/pairs directly on the rack instead of in a separate staging area.
export const RACK_ROWS = 2;
export const RACK_COLS = 14;
export const RACK_SLOTS = RACK_ROWS * RACK_COLS;

/** Reconstruct the concrete tile from a signature (inverse of tileSig). */
export function sigToTile(sig: string): OkeyTile {
  if (sig === "F") return { kind: "fakeJoker" };
  const i = sig.indexOf(":");
  return { kind: "numbered", color: sig.slice(0, i) as OkeyColor, value: Number(sig.slice(i + 1)) };
}

/** Compact initial layout: hand tiles fill the first slots left to right. */
export function initialSlots(handSigs: readonly string[], slotCount: number): (string | null)[] {
  const next: (string | null)[] = new Array(slotCount).fill(null);
  for (let i = 0; i < handSigs.length && i < slotCount; i++) next[i] = handSigs[i]!;
  return next;
}

/**
 * Reconcile a slot layout against the current hand multiset: tiles still held
 * keep their slot (matched by signature, left to right); slots whose tile is no
 * longer in hand (e.g. after a discard/open) are cleared; tiles new to the hand
 * are dropped into the first empty slots. Keeps the player's custom arrangement
 * stable across server state updates.
 */
export function reconcileSlots(
  prev: readonly (string | null)[],
  handSigs: readonly string[],
  slotCount: number,
): (string | null)[] {
  const counts = new Map<string, number>();
  for (const s of handSigs) counts.set(s, (counts.get(s) ?? 0) + 1);
  const next: (string | null)[] = new Array(slotCount).fill(null);
  for (let i = 0; i < slotCount; i++) {
    const s = prev[i] ?? null;
    if (s !== null) {
      const c = counts.get(s) ?? 0;
      if (c > 0) { next[i] = s; counts.set(s, c - 1); }
    }
  }
  const remaining: string[] = [];
  for (const [s, c] of counts) for (let k = 0; k < c; k++) remaining.push(s);
  let ri = 0;
  for (let i = 0; i < slotCount && ri < remaining.length; i++) {
    if (next[i] === null) next[i] = remaining[ri++]!;
  }
  return next;
}

/** Move the tile at `from` to slot `to`; if `to` is occupied the two swap. */
export function moveSlot(slots: readonly (string | null)[], from: number, to: number): (string | null)[] {
  if (from === to) return [...slots];
  const next = [...slots];
  const tmp = next[to] ?? null;
  next[to] = next[from] ?? null;
  next[from] = tmp;
  return next;
}

export interface RackGroup { startSlot: number; tiles: OkeyTile[]; slotIndices: number[]; }

/** Contiguous runs of filled slots within one row (empty slots separate groups). */
export function rowGroups(slots: readonly (string | null)[], rowStart: number, cols: number): RackGroup[] {
  const groups: RackGroup[] = [];
  let cur: RackGroup | null = null;
  for (let c = 0; c < cols; c++) {
    const idx = rowStart + c;
    const sig = slots[idx] ?? null;
    if (sig === null) { cur = null; continue; }
    if (cur === null) { cur = { startSlot: idx, tiles: [], slotIndices: [] }; groups.push(cur); }
    cur.tiles.push(sigToTile(sig));
    cur.slotIndices.push(idx);
  }
  return groups;
}

/** All contiguous groups across every row. */
export function allGroups(slots: readonly (string | null)[], rows: number, cols: number): RackGroup[] {
  const out: RackGroup[] = [];
  for (let r = 0; r < rows; r++) out.push(...rowGroups(slots, r * cols, cols));
  return out;
}

export function useRackSlots(hand: OkeyTile[]): {
  slots: (string | null)[];
  move: (from: number, to: number) => void;
  setSlots: (next: (string | null)[]) => void;
} {
  const handKey = hand.map(tileSig).join(",");
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    initialSlots(handKey === "" ? [] : handKey.split(","), RACK_SLOTS),
  );
  useEffect(() => {
    const sigs = handKey === "" ? [] : handKey.split(",");
    setSlots((prev) => reconcileSlots(prev, sigs, RACK_SLOTS));
  }, [handKey]);
  const move = (from: number, to: number): void => setSlots((s) => moveSlot(s, from, to));
  return { slots, move, setSlots };
}
