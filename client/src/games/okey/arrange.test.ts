import { describe, expect, it } from "vitest";
import type { NumberedTile, OkeyTile } from "./types.js";
import { tileSig } from "./rack-order.js";
import { sigToTile } from "./rack-slots.js";
import { decompose, arrangeMelds, layoutSlots } from "./arrange.js";
import { classifyOrdered, orderMeldForDisplay } from "./meld-check.js";

const okey: NumberedTile = { kind: "numbered", color: "red", value: 13 };
const t = (color: "red" | "yellow" | "black" | "blue", value: number): NumberedTile => ({ kind: "numbered", color, value });

describe("arrange", () => {
  it("decompose finds the highest-value run", () => {
    const hand: OkeyTile[] = [t("red", 5), t("red", 6), t("red", 7), t("blue", 2)];
    const d = decompose(hand, okey);
    expect(d.groups.length).toBe(1);
    expect(d.value).toBe(18); // 5+6+7
  });

  it("decompose places the okey wildcard to maximize value", () => {
    // red 11,12 + okey → run 11-12-13 (wild as 13) = 36, better than 10-11-12
    const hand: OkeyTile[] = [t("red", 11), t("red", 12), t("red", 13)];
    const d = decompose(hand, okey);
    expect(d.value).toBe(36);
  });

  it("orderMeldForDisplay puts the okey in its gap position (9-okey-11)", () => {
    const meld: OkeyTile[] = [t("red", 9), t("red", 11), t("red", 13)]; // okey(red13) fills 10
    const ordered = orderMeldForDisplay(meld, okey);
    // represented run is 9-10-11; the wildcard (red 13) sits in the middle
    expect(ordered[0]).toEqual(t("red", 9));
    expect(ordered[1]).toEqual(t("red", 13)); // the okey, as 10
    expect(ordered[2]).toEqual(t("red", 11));
  });

  it("layoutSlots separates groups with a gap and keeps them contiguous", () => {
    const g1 = [t("red", 5), t("red", 6), t("red", 7)];
    const g2 = [t("blue", 2), t("blue", 3), t("blue", 4)];
    const slots = layoutSlots([g1, g2], [], 2, 14);
    expect(slots.slice(0, 3).map((s) => s && sigToTile(s))).toEqual(g1);
    expect(slots[3]).toBeNull(); // gap between groups
    expect(slots.slice(4, 7).map((s) => s && sigToTile(s))).toEqual(g2);
  });

  it("arrangeMelds yields rack groups that classify as valid melds", () => {
    const hand: OkeyTile[] = [t("red", 5), t("red", 6), t("red", 7), t("blue", 9)];
    const slots = arrangeMelds(hand, okey, 2, 14);
    expect(slots).not.toBeNull();
    expect(slots!.slice(0, 3).map((s) => sigToTile(s!))).toEqual(hand.slice(0, 3));
    expect(classifyOrdered(slots!.slice(0, 3).map((s) => sigToTile(s!)), okey)).toBe("run");
    // the leftover blue 9 sits after a gap, on its own
    expect(slots![3]).toBeNull();
    expect(slots![4] && tileSig(sigToTile(slots![4]!))).toBe(tileSig(t("blue", 9)));
  });

  it("arrangeMelds returns null when there is no meld to form", () => {
    const hand: OkeyTile[] = [t("red", 5), t("blue", 9), t("black", 2)];
    expect(arrangeMelds(hand, okey, 2, 14)).toBeNull();
  });
});
