import { describe, expect, it } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import { decompose, tileKey, removeTiles } from "./bot.js";
import { isValidMeld } from "./meld.js";

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

describe("tileKey / removeTiles", () => {
  it("tileKey numbered ve joker için ayırt edici anahtar üretir", () => {
    expect(tileKey(numbered("blue", 7))).toBe("blue:7");
    expect(tileKey(fakeJoker())).toBe("fake");
  });

  it("removeTiles çoklu-küme olarak siler, kopyaları korur", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("red", 5), numbered("blue", 3)];
    const out = removeTiles(hand, [numbered("red", 5)]);
    expect(out).toEqual([numbered("red", 5), numbered("blue", 3)]);
  });
});

describe("decompose ek davranışlar", () => {
  it("maxValue jokeri en yüksek değeri verecek konuma yerleştirir", () => {
    const hand: OkeyTile[] = [numbered("red", 10), numbered("red", 11), fakeJoker()];
    const d = decompose(hand, okey, "maxValue");
    expect(d.value).toBe(33); // 10 + 11 + 12
  });

  it("döndürülen tüm gruplar geçerli per'dir (tam ele yakın)", () => {
    const hand: OkeyTile[] = [
      numbered("red", 1), numbered("red", 2), numbered("red", 3), numbered("red", 4),
      numbered("blue", 6), numbered("blue", 7), numbered("blue", 8),
      numbered("black", 9), numbered("yellow", 9), numbered("red", 9),
      fakeJoker(), numbered("blue", 13),
    ];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.groups.length).toBeGreaterThan(0);
    for (const g of d.groups) expect(isValidMeld(g, okey)).toBe(true);
  });
});
