# Okey 101 Rule Primitives (1a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, variant-agnostic Okey 101 rule primitives under `server/src/games/okey/` — tile model, deck/shuffle, deal, okey/wildcard, meld (run/set) and pair validation, and opening-threshold checks — all pure and unit-tested, with no networking or game state.

**Architecture:** A standalone pure module. Game-specific types (`OkeyTile`) live here, not in `shared/`. The only core dependency is the injectable `Rng` (`server/src/core/rng.js`) for shuffling and `InvalidMoveError` (`server/src/core/errors/index.js`) for the one throwing path. Opening thresholds are parameters (default 101 points / 5 pairs) so katlamalı/katlamasız escalation can be layered in 1b without touching these primitives. Wildcards (2 fake jokers + the 2 okey-valued tiles) substitute freely; a meld must keep ≥1 natural tile. Run `1` is low-only with no wrap.

**Tech Stack:** TypeScript (strict, NodeNext, `noUncheckedIndexedAccess`), Vitest, pnpm. Server package `@masa/server`.

**Canonical rules:** `docs/okey-101-rules.md`. **Spec:** `docs/superpowers/specs/2026-06-15-okey-101-rule-primitives-design.md`.

---

## File Structure

```
server/src/games/okey/
├── tile.ts        # OkeyColor, OkeyTile (numbered|fakeJoker), constructors, equality
├── okey.ts        # determineOkey, isOkeyTile, isWildcard
├── deck.ts        # buildDeck (106), shuffle(rng)
├── deal.ts        # deal -> hands (22/21/21/21) + indicator + drawPile
├── meld.ts        # isValidRun/Set/Meld, meldRepresentedValues (validation + valuation)
├── pairs.ts       # isPair, isAllPairs, canOpenWithPairs
├── points.ts      # tileValue, meldValue, meldsTotal, canOpenWithMelds
└── index.ts       # barrel re-export
```

All imports use explicit `.js` extensions (NodeNext). No `any`. Tests are `*.test.ts` next to each module, run by the existing server Vitest config.

Common test command form:
`pnpm --filter @masa/server test --run src/games/okey/<name>.test.ts`

---

## Task 1: Tile model (`tile.ts`)

**Files:**
- Create: `server/src/games/okey/tile.ts`
- Test: `server/src/games/okey/tile.test.ts`

- [ ] **Step 1: Write the failing test** — `server/src/games/okey/tile.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  numbered,
  fakeJoker,
  isNumbered,
  isFakeJoker,
  tilesEqual,
  OKEY_COLORS,
} from "./tile.js";

describe("tile", () => {
  it("constructs a numbered tile and narrows it", () => {
    const t = numbered("red", 5);
    expect(t).toEqual({ kind: "numbered", color: "red", value: 5 });
    expect(isNumbered(t)).toBe(true);
    expect(isFakeJoker(t)).toBe(false);
  });

  it("rejects out-of-range values", () => {
    expect(() => numbered("red", 0)).toThrow();
    expect(() => numbered("red", 14)).toThrow();
    expect(() => numbered("red", 1.5)).toThrow();
  });

  it("constructs a fake joker", () => {
    const j = fakeJoker();
    expect(isFakeJoker(j)).toBe(true);
    expect(isNumbered(j)).toBe(false);
  });

  it("tilesEqual compares structurally; two fake jokers are equal", () => {
    expect(tilesEqual(numbered("red", 5), numbered("red", 5))).toBe(true);
    expect(tilesEqual(numbered("red", 5), numbered("blue", 5))).toBe(false);
    expect(tilesEqual(numbered("red", 5), numbered("red", 6))).toBe(false);
    expect(tilesEqual(fakeJoker(), fakeJoker())).toBe(true);
    expect(tilesEqual(fakeJoker(), numbered("red", 5))).toBe(false);
  });

  it("exposes the four colors", () => {
    expect(OKEY_COLORS).toEqual(["red", "yellow", "black", "blue"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/tile.test.ts`
Expected: FAIL (module `./tile.js` not found).

- [ ] **Step 3: Write the implementation** — `server/src/games/okey/tile.ts`

```ts
export type OkeyColor = "red" | "yellow" | "black" | "blue";

export interface NumberedTile {
  readonly kind: "numbered";
  readonly color: OkeyColor;
  readonly value: number; // 1..13
}

export interface FakeJoker {
  readonly kind: "fakeJoker";
}

export type OkeyTile = NumberedTile | FakeJoker;

export const OKEY_COLORS: readonly OkeyColor[] = ["red", "yellow", "black", "blue"];
export const MIN_VALUE = 1;
export const MAX_VALUE = 13;

export function numbered(color: OkeyColor, value: number): NumberedTile {
  if (!Number.isInteger(value) || value < MIN_VALUE || value > MAX_VALUE) {
    throw new RangeError(`Tile value must be ${MIN_VALUE}..${MAX_VALUE}, got ${value}`);
  }
  return { kind: "numbered", color, value };
}

export function fakeJoker(): FakeJoker {
  return { kind: "fakeJoker" };
}

export function isNumbered(t: OkeyTile): t is NumberedTile {
  return t.kind === "numbered";
}

export function isFakeJoker(t: OkeyTile): t is FakeJoker {
  return t.kind === "fakeJoker";
}

export function tilesEqual(a: OkeyTile, b: OkeyTile): boolean {
  if (a.kind === "fakeJoker" && b.kind === "fakeJoker") return true;
  if (a.kind === "numbered" && b.kind === "numbered") {
    return a.color === b.color && a.value === b.value;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/tile.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/tile.ts server/src/games/okey/tile.test.ts
git commit -m "feat(okey): add tile model"
```
(End the message with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.)

---

## Task 2: Okey & wildcard (`okey.ts`)

**Files:**
- Create: `server/src/games/okey/okey.ts`
- Test: `server/src/games/okey/okey.test.ts`

- [ ] **Step 1: Write the failing test** — `server/src/games/okey/okey.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import { determineOkey, isOkeyTile, isWildcard } from "./okey.js";

describe("okey", () => {
  it("okey is the indicator + 1, same color", () => {
    expect(determineOkey(numbered("red", 5))).toEqual(numbered("red", 6));
  });

  it("wraps 13 -> 1 keeping color", () => {
    expect(determineOkey(numbered("blue", 13))).toEqual(numbered("blue", 1));
  });

  it("isOkeyTile matches only the exact okey tile", () => {
    const okey = numbered("red", 6);
    expect(isOkeyTile(numbered("red", 6), okey)).toBe(true);
    expect(isOkeyTile(numbered("red", 7), okey)).toBe(false);
    expect(isOkeyTile(numbered("blue", 6), okey)).toBe(false);
    expect(isOkeyTile(fakeJoker(), okey)).toBe(false);
  });

  it("isWildcard = fake joker OR the okey tile (4 wildcards total)", () => {
    const okey = numbered("red", 6);
    expect(isWildcard(fakeJoker(), okey)).toBe(true);
    expect(isWildcard(numbered("red", 6), okey)).toBe(true);
    expect(isWildcard(numbered("red", 5), okey)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/okey.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation** — `server/src/games/okey/okey.ts`

```ts
import type { NumberedTile, OkeyTile } from "./tile.js";
import { MAX_VALUE, MIN_VALUE, isNumbered } from "./tile.js";

export function determineOkey(indicator: NumberedTile): NumberedTile {
  const value = indicator.value === MAX_VALUE ? MIN_VALUE : indicator.value + 1;
  return { kind: "numbered", color: indicator.color, value };
}

export function isOkeyTile(tile: OkeyTile, okey: NumberedTile): boolean {
  return isNumbered(tile) && tile.color === okey.color && tile.value === okey.value;
}

export function isWildcard(tile: OkeyTile, okey: NumberedTile): boolean {
  return tile.kind === "fakeJoker" || isOkeyTile(tile, okey);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/okey.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/okey.ts server/src/games/okey/okey.test.ts
git commit -m "feat(okey): add okey determination and wildcard predicate"
```

---

## Task 3: Deck & shuffle (`deck.ts`)

**Files:**
- Create: `server/src/games/okey/deck.ts`
- Test: `server/src/games/okey/deck.test.ts`

- [ ] **Step 1: Write the failing test** — `server/src/games/okey/deck.test.ts`

```ts
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
    // every (color, value) appears exactly twice
    const numberedTiles = deck.filter(isNumbered);
    expect(numberedTiles.length).toBe(104);
    const counts = new Map<string, number>();
    for (const t of numberedTiles) {
      const key = `${t.color}:${t.value}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(52); // 4 colors * 13 values
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
  });

  it("shuffle is a permutation (same multiset) and does not mutate input", () => {
    const deck = buildDeck();
    const before = deck.slice();
    const shuffled = shuffle(deck, new SeededRng(1));
    expect(shuffled.length).toBe(106);
    expect(deck).toEqual(before); // input untouched
    // same multiset: every tile in shuffled exists in deck with equal count
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/deck.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation** — `server/src/games/okey/deck.ts`

```ts
import type { Rng } from "../../core/rng.js";
import type { OkeyTile } from "./tile.js";
import { OKEY_COLORS, MIN_VALUE, MAX_VALUE, fakeJoker, numbered } from "./tile.js";

export function buildDeck(): OkeyTile[] {
  const deck: OkeyTile[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const color of OKEY_COLORS) {
      for (let value = MIN_VALUE; value <= MAX_VALUE; value++) {
        deck.push(numbered(color, value));
      }
    }
  }
  deck.push(fakeJoker(), fakeJoker());
  return deck; // 2 * (4 * 13) + 2 = 106
}

/** Fisher-Yates using the injected RNG. Pure: returns a new array. */
export function shuffle(deck: readonly OkeyTile[], rng: Rng): OkeyTile[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/deck.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/deck.ts server/src/games/okey/deck.test.ts
git commit -m "feat(okey): add 106-tile deck builder and seeded shuffle"
```

---

## Task 4: Deal (`deal.ts`)

**Files:**
- Create: `server/src/games/okey/deal.ts`
- Test: `server/src/games/okey/deal.test.ts`

- [ ] **Step 1: Write the failing test** — `server/src/games/okey/deal.test.ts`

```ts
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
    expect(r.drawPile.length).toBe(20); // 106 - 1 indicator - 85 dealt
  });

  it("conserves all 106 tiles (no loss/duplication) and does not mutate input", () => {
    const deck = shuffle(buildDeck(), new SeededRng(9));
    const before = deck.slice();
    const r = deal(deck);
    expect(deck).toEqual(before); // input untouched
    const all = flattenAll(r);
    expect(all.length).toBe(106);
    for (const t of before) {
      const inInput = before.filter((x) => tilesEqual(x, t)).length;
      const inOutput = all.filter((x) => tilesEqual(x, t)).length;
      expect(inOutput).toBe(inInput);
    }
  });

  it("skips fake jokers when choosing the indicator", () => {
    // Hand-craft a deck whose first tile is a fake joker.
    const deck: OkeyTile[] = [fakeJoker(), ...buildDeck().filter((t) => !(t.kind === "fakeJoker"))];
    deck.push(fakeJoker()); // restore 2 jokers, total 106
    expect(deck.length).toBe(106);
    const r = deal(deck);
    expect(isNumbered(r.indicator)).toBe(true);
  });

  it("throws when the deck size is not 106", () => {
    expect(() => deal([numbered("red", 1)])).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/deal.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation** — `server/src/games/okey/deal.ts`

```ts
import type { NumberedTile, OkeyTile } from "./tile.js";
import { isNumbered } from "./tile.js";

export interface DealResult {
  hands: OkeyTile[][]; // 4 hands; hands[0] = starting player (22), the rest 21
  indicator: NumberedTile;
  drawPile: OkeyTile[];
  startingPlayerIndex: 0;
}

const DECK_SIZE = 106;
const HAND_SIZES = [22, 21, 21, 21] as const;

/**
 * Partition a shuffled 106-tile deck into 4 hands, an indicator, and the draw
 * pile. The indicator is the first numbered tile (fake jokers are skipped, since
 * the gösterge is always a numbered tile). Pure: does not mutate the input.
 */
export function deal(shuffledDeck: readonly OkeyTile[]): DealResult {
  if (shuffledDeck.length !== DECK_SIZE) {
    throw new RangeError(`deal expects ${DECK_SIZE} tiles, got ${shuffledDeck.length}`);
  }
  const pile = shuffledDeck.slice();

  const indicatorIdx = pile.findIndex(isNumbered);
  const indicator = indicatorIdx === -1 ? undefined : pile[indicatorIdx];
  if (indicator === undefined || !isNumbered(indicator)) {
    throw new Error("deck has no numbered tile to use as indicator");
  }
  pile.splice(indicatorIdx, 1);

  const hands: OkeyTile[][] = [];
  for (const size of HAND_SIZES) {
    hands.push(pile.splice(0, size));
  }

  return { hands, indicator, drawPile: pile, startingPlayerIndex: 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/deal.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/deal.ts server/src/games/okey/deal.test.ts
git commit -m "feat(okey): add deal (hands/indicator/draw pile) with conservation"
```

---

## Task 5: Meld validation (`meld.ts`)

This is the most intricate unit. Wildcards are classified by `isWildcard` (so a real okey-valued tile counts as a wildcard, NOT a natural). A run is valued by the highest feasible consecutive window (wildcards represent the highest possible tiles); a set is valued at its common number.

**Files:**
- Create: `server/src/games/okey/meld.ts`
- Test: `server/src/games/okey/meld.test.ts`

- [ ] **Step 1: Write the failing test** — `server/src/games/okey/meld.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import { isValidRun, isValidSet, isValidMeld, meldRepresentedValues } from "./meld.js";

const OKEY = numbered("black", 1); // okey is black 1 -> wildcards: fake jokers + black 1

describe("isValidRun", () => {
  it("accepts a same-color consecutive run of length >= 3", () => {
    expect(isValidRun([numbered("red", 5), numbered("red", 6), numbered("red", 7)], OKEY)).toBe(true);
    expect(isValidRun([numbered("red", 11), numbered("red", 12), numbered("red", 13)], OKEY)).toBe(true);
  });

  it("rejects wrap-around: 1 is low only, no 13-1 link", () => {
    expect(isValidRun([numbered("red", 12), numbered("red", 13), numbered("red", 1)], OKEY)).toBe(false);
    expect(
      isValidRun([numbered("red", 11), numbered("red", 12), numbered("red", 13), numbered("red", 1)], OKEY),
    ).toBe(false);
    expect(isValidRun([numbered("red", 13), numbered("red", 1), numbered("red", 2)], OKEY)).toBe(false);
  });

  it("rejects mixed colors, duplicates, and length < 3", () => {
    expect(isValidRun([numbered("red", 5), numbered("blue", 6), numbered("red", 7)], OKEY)).toBe(false);
    expect(isValidRun([numbered("red", 5), numbered("red", 5), numbered("red", 6)], OKEY)).toBe(false);
    expect(isValidRun([numbered("red", 5), numbered("red", 6)], OKEY)).toBe(false);
  });

  it("fills gaps and ends with wildcards (fake joker and the okey tile)", () => {
    // R5 [joker] R7 -> joker = R6
    expect(isValidRun([numbered("red", 5), fakeJoker(), numbered("red", 7)], OKEY)).toBe(true);
    // R5 R6 + okey-tile(black1) as wildcard -> represents R7
    expect(isValidRun([numbered("red", 5), numbered("red", 6), numbered("black", 1)], OKEY)).toBe(true);
  });

  it("rejects a run made entirely of wildcards", () => {
    expect(isValidRun([fakeJoker(), fakeJoker(), fakeJoker()], OKEY)).toBe(false);
  });
});

describe("isValidSet", () => {
  it("accepts same-number distinct-color sets of size 3 or 4", () => {
    expect(isValidSet([numbered("red", 7), numbered("yellow", 7), numbered("black", 7)], OKEY)).toBe(true);
    expect(
      isValidSet(
        [numbered("red", 7), numbered("yellow", 7), numbered("black", 7), numbered("blue", 7)],
        OKEY,
      ),
    ).toBe(true);
  });

  it("rejects duplicate colors, mixed numbers, and size > 4", () => {
    expect(isValidSet([numbered("red", 7), numbered("red", 7), numbered("yellow", 7)], OKEY)).toBe(false);
    expect(isValidSet([numbered("red", 7), numbered("yellow", 8), numbered("black", 7)], OKEY)).toBe(false);
    expect(
      isValidSet(
        [numbered("red", 7), numbered("yellow", 7), numbered("black", 7), numbered("blue", 7), fakeJoker()],
        OKEY,
      ),
    ).toBe(false);
  });

  it("fills a missing color with a wildcard", () => {
    expect(isValidSet([numbered("red", 7), numbered("yellow", 7), fakeJoker()], OKEY)).toBe(true);
  });
});

describe("meldRepresentedValues", () => {
  it("returns the represented value multiset for a plain run", () => {
    expect(meldRepresentedValues([numbered("red", 5), numbered("red", 6), numbered("red", 7)], OKEY)).toEqual([5, 6, 7]);
  });

  it("forces a wildcard to the gap value", () => {
    // R5 [joker] R7 -> [5,6,7]
    expect(meldRepresentedValues([numbered("red", 5), fakeJoker(), numbered("red", 7)], OKEY)).toEqual([5, 6, 7]);
  });

  it("places trailing wildcards at the highest feasible values (max sum)", () => {
    // R6 R7 + joker -> [6,7,8], not [5,6,7]
    expect(meldRepresentedValues([numbered("red", 6), numbered("red", 7), fakeJoker()], OKEY)).toEqual([6, 7, 8]);
  });

  it("values a set at its common number", () => {
    expect(meldRepresentedValues([numbered("red", 7), numbered("yellow", 7), fakeJoker()], OKEY)).toEqual([7, 7, 7]);
  });

  it("returns null for an invalid meld", () => {
    expect(meldRepresentedValues([numbered("red", 5), numbered("blue", 9)], OKEY)).toBeNull();
  });
});

describe("isValidMeld", () => {
  it("is true for a valid run or set, false otherwise", () => {
    expect(isValidMeld([numbered("red", 5), numbered("red", 6), numbered("red", 7)], OKEY)).toBe(true);
    expect(isValidMeld([numbered("red", 7), numbered("yellow", 7), numbered("black", 7)], OKEY)).toBe(true);
    expect(isValidMeld([numbered("red", 5), numbered("blue", 9)], OKEY)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/meld.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation** — `server/src/games/okey/meld.ts`

```ts
import type { NumberedTile, OkeyTile } from "./tile.js";
import { MAX_VALUE, MIN_VALUE, isNumbered } from "./tile.js";
import { isWildcard } from "./okey.js";

function partition(
  tiles: readonly OkeyTile[],
  okey: NumberedTile,
): { naturals: NumberedTile[]; wild: number } {
  const naturals: NumberedTile[] = [];
  let wild = 0;
  for (const t of tiles) {
    if (isWildcard(t, okey)) {
      wild++;
      continue;
    }
    // A non-wildcard tile is always a plain numbered tile.
    if (isNumbered(t)) naturals.push(t);
  }
  return { naturals, wild };
}

/** Represented values if `tiles` form a valid run, else null. */
function runValues(tiles: readonly OkeyTile[], okey: NumberedTile): number[] | null {
  const total = tiles.length;
  if (total < 3) return null;
  const { naturals, wild } = partition(tiles, okey);
  if (naturals.length === 0) return null; // need at least one natural tile

  const color = naturals[0]!.color;
  if (!naturals.every((t) => t.color === color)) return null;

  const values = naturals.map((t) => t.value);
  if (new Set(values).size !== values.length) return null; // no duplicates

  const minNat = Math.min(...values);
  const maxNat = Math.max(...values);
  if (maxNat - minNat + 1 > total) return null; // naturals span wider than the run length

  // A run is a consecutive window [start, start+total-1] within [1,13] that
  // contains every natural value. Choose the highest feasible window so wildcards
  // represent the highest tiles (max sum).
  const startLow = Math.max(MIN_VALUE, maxNat - total + 1);
  const startHigh = Math.min(minNat, MAX_VALUE - total + 1);
  if (startLow > startHigh) return null;

  const start = startHigh;
  const result: number[] = [];
  for (let v = start; v < start + total; v++) result.push(v);
  return result;
}

/** Represented values if `tiles` form a valid set, else null. */
function setValues(tiles: readonly OkeyTile[], okey: NumberedTile): number[] | null {
  const total = tiles.length;
  if (total < 3 || total > 4) return null;
  const { naturals, wild } = partition(tiles, okey);
  if (naturals.length === 0) return null;

  const value = naturals[0]!.value;
  if (!naturals.every((t) => t.value === value)) return null;

  const colors = new Set(naturals.map((t) => t.color));
  if (colors.size !== naturals.length) return null; // distinct colors among naturals
  if (naturals.length + wild > 4) return null; // at most 4 colors

  return Array.from({ length: total }, () => value);
}

export function meldRepresentedValues(
  tiles: readonly OkeyTile[],
  okey: NumberedTile,
): number[] | null {
  return runValues(tiles, okey) ?? setValues(tiles, okey);
}

export function isValidRun(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  return runValues(tiles, okey) !== null;
}

export function isValidSet(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  return setValues(tiles, okey) !== null;
}

export function isValidMeld(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  return isValidRun(tiles, okey) || isValidSet(tiles, okey);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/meld.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/meld.ts server/src/games/okey/meld.test.ts
git commit -m "feat(okey): add meld (run/set) validation with wildcard substitution"
```

---

## Task 6: Pairs (`pairs.ts`)

**Files:**
- Create: `server/src/games/okey/pairs.ts`
- Test: `server/src/games/okey/pairs.test.ts`

- [ ] **Step 1: Write the failing test** — `server/src/games/okey/pairs.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { numbered, fakeJoker, type OkeyTile } from "./tile.js";
import { isPair, isAllPairs, canOpenWithPairs } from "./pairs.js";

const OKEY = numbered("black", 1); // wildcards: fake jokers + black 1

describe("isPair", () => {
  it("is true for two identical numbered tiles", () => {
    expect(isPair(numbered("red", 7), numbered("red", 7), OKEY)).toBe(true);
  });
  it("is false for same number but different color", () => {
    expect(isPair(numbered("red", 7), numbered("blue", 7), OKEY)).toBe(false);
  });
  it("is true when either tile is a wildcard (fake joker or okey tile)", () => {
    expect(isPair(fakeJoker(), numbered("red", 7), OKEY)).toBe(true);
    expect(isPair(numbered("black", 1), numbered("red", 7), OKEY)).toBe(true);
    expect(isPair(fakeJoker(), fakeJoker(), OKEY)).toBe(true);
  });
});

describe("isAllPairs", () => {
  it("is true when every tile pairs up", () => {
    const hand: OkeyTile[] = [
      numbered("red", 7), numbered("red", 7),
      numbered("blue", 3), numbered("blue", 3),
    ];
    expect(isAllPairs(hand, OKEY)).toBe(true);
  });
  it("uses wildcards to complete odd singletons", () => {
    // R7 R7, B3 (single) + joker -> pairs
    const hand: OkeyTile[] = [numbered("red", 7), numbered("red", 7), numbered("blue", 3), fakeJoker()];
    expect(isAllPairs(hand, OKEY)).toBe(true);
  });
  it("is false for odd length or a leftover unpaired tile", () => {
    expect(isAllPairs([numbered("red", 7)], OKEY)).toBe(false);
    expect(isAllPairs([numbered("red", 7), numbered("blue", 3), numbered("green" as never, 4)], OKEY)).toBe(false);
    // two distinct singletons but only one wildcard -> cannot pair both
    expect(isAllPairs([numbered("red", 7), numbered("blue", 3), fakeJoker(), numbered("yellow", 9)], OKEY)).toBe(false);
  });
});

describe("canOpenWithPairs", () => {
  const pair = (n: number): OkeyTile[] => [numbered("red", n), numbered("red", n)];
  it("requires at least minPairs (default 5) valid pairs", () => {
    expect(canOpenWithPairs([pair(2), pair(3), pair(4), pair(5)], OKEY)).toBe(false); // 4 < 5
    expect(canOpenWithPairs([pair(2), pair(3), pair(4), pair(5), pair(6)], OKEY)).toBe(true); // 5
  });
  it("honors a custom minPairs (katlamalı escalation in 1b)", () => {
    expect(canOpenWithPairs([pair(2), pair(3), pair(4), pair(5), pair(6)], OKEY, 6)).toBe(false);
  });
  it("rejects a group that is not a valid 2-tile pair", () => {
    const bad: OkeyTile[] = [numbered("red", 2), numbered("blue", 2)]; // not a pair
    expect(canOpenWithPairs([bad, pair(3), pair(4), pair(5), pair(6)], OKEY)).toBe(false);
  });
});
```

> Note: the `numbered("green" as never, 4)` in one negative test is intentionally an invalid-color placeholder only to produce a distinct unpaired tile; it still constructs (value is valid) and the assertion only checks the pairing result. If `numbered` rejects it for any reason, replace that element with `numbered("yellow", 4)` — the test's point is "three tiles, odd length → false".

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/pairs.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation** — `server/src/games/okey/pairs.ts`

```ts
import type { NumberedTile, OkeyTile } from "./tile.js";
import { isNumbered, tilesEqual } from "./tile.js";
import { isWildcard } from "./okey.js";

export function isPair(a: OkeyTile, b: OkeyTile, okey: NumberedTile): boolean {
  if (isWildcard(a, okey) || isWildcard(b, okey)) return true;
  return tilesEqual(a, b);
}

/** Can the whole tile bag be split into valid pairs (wildcards fill singletons)? */
export function isAllPairs(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  if (tiles.length === 0 || tiles.length % 2 !== 0) return false;

  const counts = new Map<string, number>();
  let wild = 0;
  for (const t of tiles) {
    if (isWildcard(t, okey)) {
      wild++;
      continue;
    }
    if (isNumbered(t)) {
      const key = `${t.color}:${t.value}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let singles = 0;
  for (const c of counts.values()) singles += c % 2;

  // Each leftover natural needs a wildcard; remaining wildcards must pair up.
  return wild >= singles && (wild - singles) % 2 === 0;
}

export function canOpenWithPairs(
  pairs: readonly (readonly OkeyTile[])[],
  okey: NumberedTile,
  minPairs = 5,
): boolean {
  if (pairs.length < minPairs) return false;
  return pairs.every((p) => p.length === 2 && isPair(p[0]!, p[1]!, okey));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/pairs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/pairs.ts server/src/games/okey/pairs.test.ts
git commit -m "feat(okey): add pair validation and pairs-opening check"
```

---

## Task 7: Points & opening threshold (`points.ts`)

**Files:**
- Create: `server/src/games/okey/points.ts`
- Test: `server/src/games/okey/points.test.ts`

- [ ] **Step 1: Write the failing test** — `server/src/games/okey/points.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { numbered, fakeJoker, type OkeyTile } from "./tile.js";
import { tileValue, meldValue, meldsTotal, canOpenWithMelds } from "./points.js";
import { InvalidMoveError } from "../../core/errors/index.js";

const OKEY = numbered("black", 1);

describe("points", () => {
  it("tileValue is the tile's number", () => {
    expect(tileValue(numbered("red", 9))).toBe(9);
  });

  it("meldValue sums represented values (wildcard counts as represented tile)", () => {
    expect(meldValue([numbered("red", 5), numbered("red", 6), numbered("red", 7)], OKEY)).toBe(18);
    // R6 R7 + joker -> [6,7,8] -> 21
    expect(meldValue([numbered("red", 6), numbered("red", 7), fakeJoker()], OKEY)).toBe(21);
    // set of 7s with a wildcard -> 7+7+7 = 21
    expect(meldValue([numbered("red", 7), numbered("yellow", 7), fakeJoker()], OKEY)).toBe(21);
  });

  it("meldValue throws InvalidMoveError for an invalid meld", () => {
    expect(() => meldValue([numbered("red", 5), numbered("blue", 9)], OKEY)).toThrow(InvalidMoveError);
  });

  it("meldsTotal sums multiple melds", () => {
    const a: OkeyTile[] = [numbered("red", 10), numbered("red", 11), numbered("red", 12)]; // 33
    const b: OkeyTile[] = [numbered("blue", 9), numbered("yellow", 9), numbered("black", 9)]; // 27
    expect(meldsTotal([a, b], OKEY)).toBe(60);
  });

  it("canOpenWithMelds enforces validity AND the threshold (default 101)", () => {
    // Two high melds reaching exactly 101: 13+12+11(=36) ... build to 101.
    const m1: OkeyTile[] = [numbered("red", 11), numbered("red", 12), numbered("red", 13)]; // 36
    const m2: OkeyTile[] = [numbered("blue", 11), numbered("blue", 12), numbered("blue", 13)]; // 36
    const m3: OkeyTile[] = [numbered("yellow", 9), numbered("yellow", 10), numbered("yellow", 11)]; // 30 -> total 102
    expect(canOpenWithMelds([m1, m2, m3], OKEY)).toBe(true); // 102 >= 101
    expect(canOpenWithMelds([m1, m2], OKEY)).toBe(false); // 72 < 101
  });

  it("canOpenWithMelds returns false (no throw) if any meld is invalid", () => {
    const bad: OkeyTile[] = [numbered("red", 5), numbered("blue", 9)];
    expect(canOpenWithMelds([bad], OKEY)).toBe(false);
  });

  it("honors a custom minPoints (katlamalı escalation in 1b)", () => {
    const m1: OkeyTile[] = [numbered("red", 11), numbered("red", 12), numbered("red", 13)]; // 36
    expect(canOpenWithMelds([m1], OKEY, 30)).toBe(true);
    expect(canOpenWithMelds([m1], OKEY, 50)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/points.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation** — `server/src/games/okey/points.ts`

```ts
import type { NumberedTile, OkeyTile } from "./tile.js";
import { InvalidMoveError } from "../../core/errors/index.js";
import { isValidMeld, meldRepresentedValues } from "./meld.js";

export function tileValue(tile: NumberedTile): number {
  return tile.value;
}

/** Sum of the represented values of a valid meld. Throws on an invalid meld. */
export function meldValue(meld: readonly OkeyTile[], okey: NumberedTile): number {
  const values = meldRepresentedValues(meld, okey);
  if (values === null) {
    throw new InvalidMoveError("meld is not a valid run or set");
  }
  return values.reduce((sum, v) => sum + v, 0);
}

export function meldsTotal(melds: readonly (readonly OkeyTile[])[], okey: NumberedTile): number {
  return melds.reduce((sum, m) => sum + meldValue(m, okey), 0);
}

/**
 * Whether a set of melds is a legal opening: every meld valid AND the total
 * meets the threshold. minPoints defaults to 101 (katlamasız); 1b passes a
 * higher value for katlamalı escalation.
 */
export function canOpenWithMelds(
  melds: readonly (readonly OkeyTile[])[],
  okey: NumberedTile,
  minPoints = 101,
): boolean {
  if (!melds.every((m) => isValidMeld(m, okey))) return false;
  return meldsTotal(melds, okey) >= minPoints;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/points.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/points.ts server/src/games/okey/points.test.ts
git commit -m "feat(okey): add tile/meld point values and opening-threshold check"
```

---

## Task 8: Barrel export + full verification (`index.ts`)

**Files:**
- Create: `server/src/games/okey/index.ts`

- [ ] **Step 1: Create the barrel** — `server/src/games/okey/index.ts`

```ts
export * from "./tile.js";
export * from "./okey.js";
export * from "./deck.js";
export * from "./deal.js";
export * from "./meld.js";
export * from "./pairs.js";
export * from "./points.js";
```

- [ ] **Step 2: Typecheck the barrel and whole server**

Run: `pnpm --filter @masa/server build`
Expected: PASS — `tsc -b` clean (no duplicate-export or type errors).

> If `tsc` reports a duplicate export (e.g. a name exported by two modules), resolve it by exporting that name from only one module in the barrel, or rename. There should be none with the current design, but verify.

- [ ] **Step 3: Run the full server test suite**

Run: `pnpm --filter @masa/server test --run`
Expected: PASS — all prior server tests plus the new okey tests (tile/okey/deck/deal/meld/pairs/points), no regressions.

- [ ] **Step 4: Lint the repo (enforces no-explicit-any / no-console)**

Run: `pnpm lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/index.ts
git commit -m "feat(okey): add module barrel and finalize 1a rule primitives"
```

---

## Self-Review notes (already applied)

- **Spec coverage:** tile model (T1); okey/wildcard incl. 13→1 (T2); 106-deck + seeded shuffle (T3); deal 22/21/21/21 + numbered indicator + conservation + fake-joker skip (T4); meld run/set with wildcard substitution, 1-low/no-wrap, ≥1 natural, `meldRepresentedValues` validation+valuation (T5); pair validation + `isAllPairs` + `canOpenWithPairs(minPairs=5)` (T6); `tileValue`/`meldValue`/`meldsTotal`/`canOpenWithMelds(minPoints=101)` with parameterized thresholds (T7); barrel + full verification (T8). All spec sections map to tasks.
- **Parameterized thresholds:** `canOpenWithMelds(..., minPoints=101)` and `canOpenWithPairs(..., minPairs=5)` keep 1a variant-agnostic; katlamalı escalation is a 1b caller concern (no rework of primitives).
- **Type consistency:** `OkeyTile = NumberedTile | FakeJoker`; `numbered`/`fakeJoker` constructors; `isWildcard(tile, okey)` used identically across meld/pairs; `meldRepresentedValues(): number[] | null` consumed by `meldValue`; `NumberedTile` used for `okey`/`indicator` everywhere. `Rng`/`SeededRng` from `../../core/rng.js`; `InvalidMoveError` from `../../core/errors/index.js`.
- **Purity:** `shuffle`/`deal` copy input (`slice`) and never mutate; validators return booleans/values; the only throwing paths are constructor/size guards and `meldValue` on an invalid meld.
- **No new error classes:** reuses core `InvalidMoveError`; bad arguments use built-in `RangeError`.
