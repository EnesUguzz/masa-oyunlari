import { describe, expect, it } from "vitest";
import type { OkeyTile } from "./types.js";
import { tileSig } from "./rack-order.js";
import { sigToTile, initialSlots, reconcileSlots, moveSlot, rowGroups, allGroups } from "./rack-slots.js";

const r5: OkeyTile = { kind: "numbered", color: "red", value: 5 };
const r6: OkeyTile = { kind: "numbered", color: "red", value: 6 };
const r7: OkeyTile = { kind: "numbered", color: "red", value: 7 };
const b3: OkeyTile = { kind: "numbered", color: "blue", value: 3 };
const j: OkeyTile = { kind: "fakeJoker" };

describe("rack-slots", () => {
  it("sigToTile inverts tileSig for numbered tiles and fake jokers", () => {
    expect(sigToTile(tileSig(r5))).toEqual(r5);
    expect(sigToTile(tileSig(b3))).toEqual(b3);
    expect(sigToTile(tileSig(j))).toEqual(j);
  });

  it("initialSlots fills the first slots left to right and leaves gaps", () => {
    const s = initialSlots([tileSig(r5), tileSig(r6)], 4);
    expect(s).toEqual([tileSig(r5), tileSig(r6), null, null]);
  });

  it("reconcileSlots keeps placements, clears gone tiles, appends newcomers", () => {
    const prev = [tileSig(r5), null, tileSig(r6), null];
    // r6 stays in place, r5 dropped (discarded), b3 is new → first empty slot
    const next = reconcileSlots(prev, [tileSig(r6), tileSig(b3)], 4);
    expect(next).toEqual([tileSig(b3), null, tileSig(r6), null]);
  });

  it("reconcileSlots drops a newcomer into the preferred empty slot when given", () => {
    const prev = [tileSig(r5), null, null, null];
    // b3 is new; prefer slot 2 (empty) instead of the first empty (slot 1)
    const next = reconcileSlots(prev, [tileSig(r5), tileSig(b3)], 4, 2);
    expect(next).toEqual([tileSig(r5), null, tileSig(b3), null]);
  });

  it("reconcileSlots falls back to first empty when the preferred slot is occupied", () => {
    const prev = [tileSig(r5), null, tileSig(r6), null];
    // prefer slot 2 but it is occupied by r6 → newcomer goes to first empty (slot 1)
    const next = reconcileSlots(prev, [tileSig(r5), tileSig(r6), tileSig(b3)], 4, 2);
    expect(next).toEqual([tileSig(r5), tileSig(b3), tileSig(r6), null]);
  });

  it("moveSlot moves into an empty slot and swaps into an occupied one", () => {
    const s = [tileSig(r5), null, tileSig(r6), null];
    expect(moveSlot(s, 0, 1)).toEqual([null, tileSig(r5), tileSig(r6), null]);
    expect(moveSlot(s, 0, 2)).toEqual([tileSig(r6), null, tileSig(r5), null]); // swap
  });

  it("rowGroups splits a row into contiguous filled runs", () => {
    const row = [tileSig(r5), tileSig(r6), null, tileSig(r7), null];
    const groups = rowGroups(row, 0, 5);
    expect(groups.length).toBe(2);
    expect(groups[0]!.tiles).toEqual([r5, r6]);
    expect(groups[0]!.slotIndices).toEqual([0, 1]);
    expect(groups[1]!.tiles).toEqual([r7]);
    expect(groups[1]!.slotIndices).toEqual([3]);
  });

  it("allGroups keeps rows separate even when slots are adjacent across rows", () => {
    // 2 rows × 2 cols: row0 = [r5, r6], row1 = [r7, null]
    const slots = [tileSig(r5), tileSig(r6), tileSig(r7), null];
    const groups = allGroups(slots, 2, 2);
    expect(groups.length).toBe(2); // row0 one group, row1 one group — not merged
    expect(groups[0]!.tiles).toEqual([r5, r6]);
    expect(groups[1]!.tiles).toEqual([r7]);
  });
});
