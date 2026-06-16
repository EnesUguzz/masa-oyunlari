import { describe, expect, it } from "vitest";
import type { OkeyTile } from "./types.js";
import { tilesEqual, buildOpenMelds, buildOpenPairs, buildProcess, buildOpenNewMeld, buildDiscard, canDiscard } from "./move-builder.js";

const r5: OkeyTile = { kind: "numbered", color: "red", value: 5 };
const r6: OkeyTile = { kind: "numbered", color: "red", value: 6 };
const j: OkeyTile = { kind: "fakeJoker" };

describe("move-builder", () => {
  it("tilesEqual compares numbered and fake jokers", () => {
    expect(tilesEqual(r5, { kind: "numbered", color: "red", value: 5 })).toBe(true);
    expect(tilesEqual(r5, r6)).toBe(false);
    expect(tilesEqual(j, { kind: "fakeJoker" })).toBe(true);
    expect(tilesEqual(j, r5)).toBe(false);
  });
  it("builds each move shape", () => {
    expect(buildOpenMelds([[r5, r6]])).toEqual({ kind: "openMelds", melds: [[r5, r6]] });
    expect(buildOpenPairs([[r5, r5]])).toEqual({ kind: "openPairs", pairs: [[r5, r5]] });
    expect(buildProcess("m1", [r5])).toEqual({ kind: "processToMeld", meldId: "m1", tiles: [r5] });
    expect(buildOpenNewMeld([r5, r6])).toEqual({ kind: "openNewMeld", tiles: [r5, r6] });
    expect(buildDiscard(r5)).toEqual({ kind: "discard", tile: r5 });
  });
  it("canDiscard requires exactly one tile", () => {
    expect(canDiscard([r5])).toBe(true);
    expect(canDiscard([])).toBe(false);
    expect(canDiscard([r5, r6])).toBe(false);
  });
});
