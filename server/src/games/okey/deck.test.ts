import { describe, it, expect } from "vitest";
import { buildDeck, shuffle } from "./deck.js";
import { isFakeJoker, isNumbered, tilesEqual, type OkeyTile } from "./tile.js";
import { SeededRng } from "../../core/rng.js";

function countFakeJokers(deck: readonly OkeyTile[]): number {
  return deck.filter(isFakeJoker).length;
}

describe("deck", () => {
  it("builds exactly 106 tiles: 2 fake jokers + 2 of every numbered tile", () => {
    const deck = buildDeck();
    expect(deck.length).toBe(106);
    expect(countFakeJokers(deck)).toBe(2);
    const numberedTiles = deck.filter(isNumbered);
    expect(numberedTiles.length).toBe(104);
    const counts = new Map<string, number>();
    for (const t of numberedTiles) {
      const key = `${t.color}:${t.value}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(52);
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
  });

  it("shuffle is a permutation (same multiset) and does not mutate input", () => {
    const deck = buildDeck();
    const before = deck.slice();
    const shuffled = shuffle(deck, new SeededRng(1));
    expect(shuffled.length).toBe(106);
    expect(deck).toEqual(before);
    for (const t of before) {
      const inDeck = before.filter((x) => tilesEqual(x, t)).length;
      const inShuf = shuffled.filter((x) => tilesEqual(x, t)).length;
      expect(inShuf).toBe(inDeck);
    }
  });

  it("shuffle is deterministic for a fixed seed", () => {
    const a = shuffle(buildDeck(), new SeededRng(42));
    const b = shuffle(buildDeck(), new SeededRng(42));
    expect(a.every((t, i) => tilesEqual(t, b[i]!))).toBe(true);
  });
});
