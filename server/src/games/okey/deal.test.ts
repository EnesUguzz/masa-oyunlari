import { describe, it, expect } from "vitest";
import { buildDeck, shuffle } from "./deck.js";
import { deal } from "./deal.js";
import { isNumbered, tilesEqual, fakeJoker, numbered, type OkeyTile } from "./tile.js";
import { SeededRng } from "../../core/rng.js";

function flattenAll(r: ReturnType<typeof deal>): OkeyTile[] {
  return [...r.hands.flat(), r.indicator, ...r.drawPile];
}

describe("deal", () => {
  it("deals 22/21/21/21, a numbered indicator, and the remaining draw pile", () => {
    const r = deal(shuffle(buildDeck(), new SeededRng(3)));
    expect(r.hands.map((h) => h.length)).toEqual([22, 21, 21, 21]);
    expect(r.startingPlayerIndex).toBe(0);
    expect(isNumbered(r.indicator)).toBe(true);
    expect(r.drawPile.length).toBe(20);
  });

  it("conserves all 106 tiles (no loss/duplication) and does not mutate input", () => {
    const deck = shuffle(buildDeck(), new SeededRng(9));
    const before = deck.slice();
    const r = deal(deck);
    expect(deck).toEqual(before);
    const all = flattenAll(r);
    expect(all.length).toBe(106);
    for (const t of before) {
      const inInput = before.filter((x) => tilesEqual(x, t)).length;
      const inOutput = all.filter((x) => tilesEqual(x, t)).length;
      expect(inOutput).toBe(inInput);
    }
  });

  it("skips fake jokers when choosing the indicator", () => {
    const deck: OkeyTile[] = [fakeJoker(), ...buildDeck().filter((t) => !(t.kind === "fakeJoker"))];
    deck.push(fakeJoker());
    expect(deck.length).toBe(106);
    const r = deal(deck);
    expect(isNumbered(r.indicator)).toBe(true);
  });

  it("throws when the deck size is not 106", () => {
    expect(() => deal([numbered("red", 1)])).toThrow();
  });
});
