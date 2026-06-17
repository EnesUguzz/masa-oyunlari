import { useEffect, useMemo, useState } from "react";
import type { OkeyTile } from "./types.js";

export function tileSig(t: OkeyTile): string {
  return t.kind === "fakeJoker" ? "F" : `${t.color}:${t.value}`;
}

/**
 * Keep the player's custom rack order stable across server updates. Prior order
 * entries that still exist in the new hand (matched by multiset count) keep their
 * place; tiles that are new to the hand are appended at the end.
 */
export function reconcileOrder(prev: readonly string[], handSigs: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const s of handSigs) counts.set(s, (counts.get(s) ?? 0) + 1);
  const kept: string[] = [];
  for (const s of prev) {
    const c = counts.get(s) ?? 0;
    if (c > 0) { kept.push(s); counts.set(s, c - 1); }
  }
  for (const [s, c] of counts) for (let i = 0; i < c; i++) kept.push(s);
  return kept;
}

export interface RackSlot { tile: OkeyTile; handIndex: number; }

/** Lay out hand tiles in the given signature order; duplicates consumed left to right. */
export function orderHand(hand: readonly OkeyTile[], order: readonly string[]): RackSlot[] {
  const used = new Array(hand.length).fill(false);
  const out: RackSlot[] = [];
  for (const s of order) {
    for (let i = 0; i < hand.length; i++) {
      if (!used[i] && tileSig(hand[i]!) === s) { used[i] = true; out.push({ tile: hand[i]!, handIndex: i }); break; }
    }
  }
  for (let i = 0; i < hand.length; i++) if (!used[i]) out.push({ tile: hand[i]!, handIndex: i });
  return out;
}

/** Move the item at display position `from` to position `to`. */
export function reorder(order: readonly string[], from: number, to: number): string[] {
  if (from < 0 || from >= order.length || to < 0 || to >= order.length || from === to) return [...order];
  const a = [...order];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x!);
  return a;
}

export function useRackOrder(hand: OkeyTile[]): { slots: RackSlot[]; move: (from: number, to: number) => void } {
  const handKey = hand.map(tileSig).join(",");
  const [order, setOrder] = useState<string[]>(() => hand.map(tileSig));

  useEffect(() => {
    setOrder((prev) => reconcileOrder(prev, handKey === "" ? [] : handKey.split(",")));
    // handKey captures the hand multiset; reconcile only when it actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey]);

  const slots = useMemo(() => orderHand(hand, order), [handKey, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (from: number, to: number): void => setOrder((o) => reorder(o, from, to));
  return { slots, move };
}
