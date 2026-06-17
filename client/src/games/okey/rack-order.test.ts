import { describe, expect, it } from "vitest";
import type { OkeyTile } from "./types.js";
import { tileSig, reconcileOrder, orderHand, reorder } from "./rack-order.js";

const r5: OkeyTile = { kind: "numbered", color: "red", value: 5 };
const r6: OkeyTile = { kind: "numbered", color: "red", value: 6 };
const b3: OkeyTile = { kind: "numbered", color: "blue", value: 3 };
const j: OkeyTile = { kind: "fakeJoker" };

describe("rack-order", () => {
  it("tileSig distinguishes tiles and treats fake jokers alike", () => {
    expect(tileSig(r5)).not.toBe(tileSig(r6));
    expect(tileSig(j)).toBe(tileSig({ kind: "fakeJoker" }));
  });

  it("reconcileOrder keeps existing tiles in place and appends newcomers", () => {
    const prev = [tileSig(r5), tileSig(r6)];
    const next = reconcileOrder(prev, [tileSig(r6), tileSig(r5), tileSig(b3)]);
    expect(next).toEqual([tileSig(r5), tileSig(r6), tileSig(b3)]); // r5,r6 keep order; b3 appended
  });

  it("reconcileOrder drops removed tiles (e.g. after a discard)", () => {
    const prev = [tileSig(r5), tileSig(r6), tileSig(b3)];
    expect(reconcileOrder(prev, [tileSig(r5), tileSig(b3)])).toEqual([tileSig(r5), tileSig(b3)]);
  });

  it("orderHand lays out the hand by the signature order, mapping to hand indices", () => {
    const hand = [r5, r6, b3];
    const slots = orderHand(hand, [tileSig(b3), tileSig(r5), tileSig(r6)]);
    expect(slots.map((s) => s.tile)).toEqual([b3, r5, r6]);
    expect(slots.map((s) => s.handIndex)).toEqual([2, 0, 1]);
  });

  it("reorder moves a display item from one position to another", () => {
    const o = ["a", "b", "c", "d"];
    expect(reorder(o, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reorder(o, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(reorder(o, 1, 1)).toEqual(["a", "b", "c", "d"]);
  });
});
