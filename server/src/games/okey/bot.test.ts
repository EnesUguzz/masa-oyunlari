import { describe, expect, it } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import { decompose } from "./bot.js";

const okey: NumberedTile = numbered("red", 13); // wildcard = red13; fakeJoker da wild

describe("decompose", () => {
  it("bir run'ı tek grup olarak bulur", () => {
    const hand: OkeyTile[] = [numbered("red", 4), numbered("red", 5), numbered("red", 6)];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.groups).toHaveLength(1);
    expect(d.tilesUsed).toBe(3);
    expect(d.value).toBe(15);
  });

  it("bir set'i bulur", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("blue", 5), numbered("black", 5)];
    const d = decompose(hand, okey, "maxValue");
    expect(d.groups).toHaveLength(1);
    expect(d.tilesUsed).toBe(3);
    expect(d.value).toBe(15);
  });

  it("joker'i wildcard olarak per tamamlamada kullanır", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("red", 6), fakeJoker()];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.tilesUsed).toBe(3);
    expect(d.groups).toHaveLength(1);
  });

  it("çözülemeyen elde boş döner", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("blue", 9), numbered("black", 2)];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.groups).toHaveLength(0);
    expect(d.tilesUsed).toBe(0);
    expect(d.value).toBe(0);
  });

  it("iki ayrı per'i birlikte bulur", () => {
    const hand: OkeyTile[] = [
      numbered("red", 4), numbered("red", 5), numbered("red", 6),
      numbered("blue", 7), numbered("blue", 8), numbered("blue", 9),
    ];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.tilesUsed).toBe(6);
    expect(d.groups).toHaveLength(2);
  });
});
