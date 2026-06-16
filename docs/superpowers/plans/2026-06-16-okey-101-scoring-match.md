# Okey 101 Puanlama + Maç (1c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure Okey 101 scoring (`scoreHand`) and match accumulation (`match.ts`), plus two engine adjustments: remove the (nonexistent) 4-pair void, and add team-aware opening thresholds for the eşe-katlamasız sub-mode.

**Architecture:** Two new pure modules over the 1b terminal `OkeyGameState`, plus small edits to the existing engine (config, state types, opening, helpers). Everything pure and TDD.

**Tech Stack:** TypeScript (strict, NodeNext), Vitest, existing `server/src/games/okey/` 1a+1b modules.

**Spec:** `docs/superpowers/specs/2026-06-16-okey-101-scoring-match-design.md`
**Rules:** `docs/okey-101-rules.md`

---

## Critical conventions (READ FIRST)

- **Branded PlayerId:** `@masa/shared`'s `PlayerId` = `string & { __brand }`. In tests cast: `["p0","p1","p2","p3"] as PlayerId[]` or `` `p${seat}` as PlayerId ``, with `import type { PlayerId } from "@masa/shared";`.
- **`vitest` does NOT typecheck.** Always run `pnpm typecheck` before committing; it MUST be clean. Also `pnpm lint` (no `any`, no `console`, explicit return types).
- Single test file: `pnpm --filter @masa/server test --run src/games/okey/<name>.test.ts`. Full suite: `pnpm test`.

---

## Task 1: Remove the 4-pair void from the engine

The rule "four players going pairs voids the hand" does NOT exist. Remove all void logic.

**Files:**
- Modify: `server/src/games/okey/game-state.ts`
- Modify: `server/src/games/okey/outcome.ts`
- Modify: `server/src/games/okey/helpers.ts`
- Modify: `server/src/games/okey/opening.ts`
- Modify: `server/src/games/okey/open-pairs.test.ts`

- [ ] **Step 1: Update the failing test** — in `open-pairs.test.ts`, REPLACE the test `"voids the hand when the fourth player opens pairs"` with:

```ts
  it("allows a fourth player to open pairs without voiding the hand", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    const s = pairsState(pairs.flat(), [null, "pairs", "pairs", "pairs"]);
    const next = applyMove(s, { kind: "openPairs", pairs }, 0);
    expect(next.status).toBe("playing");
    expect(next.players[0]!.openMode).toBe("pairs");
  });
```

- [ ] **Step 2: Run it — expect FAIL** (current engine sets status "void").

Run: `pnpm --filter @masa/server test --run src/games/okey/open-pairs.test.ts`

- [ ] **Step 3: Remove void from `game-state.ts`**

Change the status type and drop `isVoid`:
```ts
export type GameStatus = "playing" | "finished";
```
In `HandOutcome`, DELETE the `isVoid: boolean;` line. (Keep `deckExhausted`.)

- [ ] **Step 4: Remove void from `outcome.ts`**

DELETE the entire `buildVoidOutcome` function. In `buildFinishOutcome` and `buildExhaustOutcome`, DELETE the `isVoid: ...,` property line from each returned object.

- [ ] **Step 5: Remove `isVoid` from `helpers.ts`**

In `cloneOutcome`, DELETE the `isVoid: o.isVoid,` line.

- [ ] **Step 6: Remove the void trigger from `opening.ts`**

In `applyOpenPairs`, DELETE the block:
```ts
  if (s.players.filter((p) => p.openMode === "pairs").length === 4) {
    s.status = "void";
    s.outcome = buildVoidOutcome(s);
  }
```
Also remove `buildVoidOutcome` from the `./outcome.js` import in `opening.ts` (leave any other imports from it intact; if it was the only import, remove the whole import line).

- [ ] **Step 7: Run tests + typecheck + lint**

Run: `pnpm --filter @masa/server test --run src/games/okey/open-pairs.test.ts` → PASS.
Run: `pnpm test` → all pass (no remaining `isVoid`/`"void"` references).
Run: `pnpm typecheck` → clean. Run: `pnpm lint` → clean.

If typecheck reports a lingering `isVoid`/`"void"` reference anywhere, fix it (delete the reference).

- [ ] **Step 8: Commit**

```bash
git add server/src/games/okey/game-state.ts server/src/games/okey/outcome.ts server/src/games/okey/helpers.ts server/src/games/okey/opening.ts server/src/games/okey/open-pairs.test.ts
git commit -m "refactor(okey): remove nonexistent 4-pair void from engine"
```

---

## Task 2: Add partnerEscalation to config

**Files:**
- Modify: `server/src/games/okey/game-config.ts`
- Modify: `server/src/games/okey/game-config.test.ts`

- [ ] **Step 1: Write the failing test** — append to `game-config.test.ts`:

```ts
  it("defaults partnerEscalation to ese-katlamali and respects overrides", () => {
    const a = makeConfig({ pairing: "esli", escalation: "katlamali", penalty: "cezasiz", targetHands: 11 });
    expect(a.partnerEscalation).toBe("ese-katlamali");
    const b = makeConfig({ pairing: "esli", escalation: "katlamali", penalty: "cezasiz", targetHands: 11, partnerEscalation: "ese-katlamasiz" });
    expect(b.partnerEscalation).toBe("ese-katlamasiz");
  });
```

- [ ] **Step 2: Run it — expect FAIL** (`partnerEscalation` missing).

- [ ] **Step 3: Implement** — in `game-config.ts`:

Add the type:
```ts
export type PartnerEscalation = "ese-katlamali" | "ese-katlamasiz";
export const DEFAULT_PARTNER_ESCALATION: PartnerEscalation = "ese-katlamali";
```
Add `partnerEscalation: PartnerEscalation;` to `OkeyGameConfig`.
Add `partnerEscalation?: PartnerEscalation;` to `OkeyGameConfigInput`.
In `makeConfig`, add to the returned object:
```ts
    partnerEscalation: input.partnerEscalation ?? DEFAULT_PARTNER_ESCALATION,
```

- [ ] **Step 4: Run tests + typecheck + lint** — all clean. (Existing `makeConfig` callers keep working since the field is optional in the input.)

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/game-config.ts server/src/games/okey/game-config.test.ts
git commit -m "feat(okey): add partnerEscalation config option"
```

---

## Task 3: Team-aware opening thresholds

Make `meldThreshold`/`pairThreshold` compute from `players[]`, excluding the partner when eşe-katlamasız.

**Files:**
- Modify: `server/src/games/okey/helpers.ts`
- Test: `server/src/games/okey/threshold.test.ts`

- [ ] **Step 1: Write the failing test** (`server/src/games/okey/threshold.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { meldThreshold } from "./helpers.js";

const okey: NumberedTile = numbered("red", 13);

function p(seat: number, opened: boolean, openMode: "melds" | "pairs" | null, openScore: number): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: (seat % 2) as 0 | 1, hand: [], opened, openMode, openScore, pairCount: 0, openedOnTurn: null };
}

function state(partnerEscalation: "ese-katlamali" | "ese-katlamasiz", players: PlayerHandState[], turn: number): OkeyGameState {
  return {
    config: makeConfig({ pairing: "esli", escalation: "katlamali", penalty: "cezasiz", targetHands: 11, partnerEscalation }),
    indicator: numbered("red", 12), okey, players,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
  };
}

describe("meldThreshold team awareness", () => {
  it("ese-katlamasiz: ignores the partner's open (only opponents raise the bar)", () => {
    // seat 0's partner is seat 2. Partner opened 120, opponents none -> threshold base 101.
    const s = state("ese-katlamasiz", [p(0, false, null, 0), p(1, false, null, 0), p(2, true, "melds", 120), p(3, false, null, 0)], 0);
    expect(meldThreshold(s)).toBe(101);
  });

  it("ese-katlamasiz: must still beat an opponent's open", () => {
    const s = state("ese-katlamasiz", [p(0, false, null, 0), p(1, true, "melds", 130), p(2, true, "melds", 120), p(3, false, null, 0)], 0);
    expect(meldThreshold(s)).toBe(131); // opponent seat 1 = 130, partner seat 2 ignored
  });

  it("ese-katlamali: partner's open raises the bar too", () => {
    const s = state("ese-katlamali", [p(0, false, null, 0), p(1, false, null, 0), p(2, true, "melds", 120), p(3, false, null, 0)], 0);
    expect(meldThreshold(s)).toBe(121);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (current `meldThreshold` reads cached `highestOpenScore`, returns base 101 here since it's null — some assertions fail, e.g. the 131 and 121 cases).

Run: `pnpm --filter @masa/server test --run src/games/okey/threshold.test.ts`

- [ ] **Step 3: Replace `meldThreshold` and `pairThreshold` in `helpers.ts`**

Replace the two existing functions with:

```ts
function partnerSeat(s: OkeyGameState, seat: number): number | null {
  if (s.config.pairing !== "esli") return null;
  const team = s.players[seat]!.team;
  for (const p of s.players) if (p.seat !== seat && p.team === team) return p.seat;
  return null;
}

export function meldThreshold(s: OkeyGameState): number {
  if (s.config.escalation === "katlamasiz") return s.config.openThreshold;
  const me = s.turn;
  const excludePartner = s.config.pairing === "esli" && s.config.partnerEscalation === "ese-katlamasiz";
  const partner = excludePartner ? partnerSeat(s, me) : null;
  let best: number | null = null;
  for (const p of s.players) {
    if (p.seat === me || p.seat === partner) continue;
    if (p.opened && p.openMode === "melds") best = best === null ? p.openScore : Math.max(best, p.openScore);
  }
  return best === null ? s.config.openThreshold : best + 1;
}

export function pairThreshold(s: OkeyGameState): number {
  if (s.config.escalation === "katlamasiz") return s.config.minPairs;
  const me = s.turn;
  const excludePartner = s.config.pairing === "esli" && s.config.partnerEscalation === "ese-katlamasiz";
  const partner = excludePartner ? partnerSeat(s, me) : null;
  let best: number | null = null;
  for (const p of s.players) {
    if (p.seat === me || p.seat === partner) continue;
    if (p.opened && p.openMode === "pairs") best = best === null ? p.pairCount : Math.max(best, p.pairCount);
  }
  return best === null ? s.config.minPairs : best + 1;
}
```

> This derives the threshold from `players[]` rather than the cached `highestOpenScore/highestOpenPairs`. Those cached fields remain on the state (still set by the open handlers) but are no longer read here — harmless.

- [ ] **Step 4: Run tests + typecheck + lint**

Run: `pnpm --filter @masa/server test --run src/games/okey/threshold.test.ts` → PASS.
Run: `pnpm test` → all pass. The existing `open-melds.test.ts` katlamalı test (eşsiz, global) still passes: in eşsiz, `excludePartner` is false, and with `highestOpenScore: 120` set in that test's state it relied on the cached field — VERIFY this test now. The old test used `stateWithHand(..., { highestOpenScore: 120 })` with NO opened player; the new `meldThreshold` reads `players[]`, where no player is opened, so it would return base 101 and the test (expecting rejection of 92) would FAIL.

  **If `open-melds.test.ts`'s katlamalı test breaks:** update that test to set an opened opponent instead of the cached field. Replace its `stateWithHand(melds.flat(), { escalation: "katlamali", highestOpenScore: 120 })` setup so that another seat is opened with `openScore: 120`. Concretely, change that single test to build a state where `players[1]` has `{ opened: true, openMode: "melds", openScore: 120 }` and seat 0 attempts to open 92 → still expected to throw. Keep the assertion (`toThrow`). Run the file again to confirm green.

Run: `pnpm typecheck` → clean. `pnpm lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/helpers.ts server/src/games/okey/threshold.test.ts server/src/games/okey/open-melds.test.ts
git commit -m "feat(okey): team-aware opening thresholds for ese-katlamasiz"
```

---

## Task 4: Scoring — multiplier, per-seat base, eşsiz, exhaustion, feeding

**Files:**
- Create: `server/src/games/okey/scoring.ts`
- Test: `server/src/games/okey/scoring.test.ts`

- [ ] **Step 1: Write the failing test** (`server/src/games/okey/scoring.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered, fakeJoker } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, HandOutcome, FinishType, FeedingEvent } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { scoreHand } from "./scoring.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[], opened: boolean): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened, openMode: opened ? "melds" : null, openScore: 0, pairCount: 0, openedOnTurn: null };
}

function finished(players: PlayerHandState[], outcome: HandOutcome, penalty: "cezasiz" | "cezali" = "cezasiz"): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty, targetHands: 11 }),
    indicator: numbered("red", 12), okey, players,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 5, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: outcome.feedingEvents, meldSeq: 0, status: "finished", outcome,
  };
}

function ft(over: Partial<FinishType>): FinishType {
  return { elden: false, okey: false, pairs: false, ...over };
}
function outcome(over: Partial<HandOutcome>): HandOutcome {
  return { finisherSeat: 0, finishType: ft({}), leftovers: [], feedingEvents: [], deckExhausted: false, ...over };
}

describe("scoreHand (essiz)", () => {
  it("normal finish: finisher -101, opened loser tile sum, non-opener 202", () => {
    const players = [
      player(0, [], true),                                   // finisher
      player(1, [numbered("blue", 9), numbered("blue", 10)], true), // 19
      player(2, [numbered("black", 3)], false),              // not opened -> 202
      player(3, [numbered("yellow", 5)], true),              // 5
    ];
    const s = finished(players, outcome({ finisherSeat: 0, finishType: ft({}) }));
    const score = scoreHand(s);
    expect(score.perSeat).toEqual([-101, 19, 202, 5]);
    expect(score.perTeam).toBeNull();
  });

  it("okey finish doubles everything (m=2)", () => {
    const players = [player(0, [], true), player(1, [numbered("blue", 9), numbered("blue", 10)], true), player(2, [numbered("black", 3)], false), player(3, [numbered("yellow", 5)], true)];
    const s = finished(players, outcome({ finishType: ft({ okey: true }) }));
    expect(scoreHand(s).perSeat).toEqual([-202, 38, 404, 10]);
  });

  it("elden+okey is m=4", () => {
    const players = [player(0, [], true), player(1, [numbered("blue", 9)], true), player(2, [], true), player(3, [], true)];
    const s = finished(players, outcome({ finishType: ft({ elden: true, okey: true }) }));
    expect(scoreHand(s).perSeat[0]).toBe(-404);
    expect(scoreHand(s).perSeat[1]).toBe(36); // 9 * 4
  });

  it("adds a flat +101 when an opened loser holds a wildcard (not multiplied)", () => {
    const players = [player(0, [], true), player(1, [numbered("blue", 9), fakeJoker()], true), player(2, [], true), player(3, [], true)];
    const s = finished(players, outcome({ finishType: ft({ okey: true }) })); // m=2
    // 9 * 2 = 18, plus flat 101 = 119
    expect(scoreHand(s).perSeat[1]).toBe(119);
  });

  it("deck exhaustion: everyone 202", () => {
    const players = [player(0, [numbered("red", 1)], true), player(1, [], false), player(2, [], false), player(3, [], false)];
    const s = finished(players, outcome({ finisherSeat: null, finishType: null, deckExhausted: true }));
    expect(scoreHand(s).perSeat).toEqual([202, 202, 202, 202]);
  });

  it("cezali feeding: feeder charged tileValue x10 (melds) / x20 (pairs)", () => {
    const players = [player(0, [], true), player(1, [], true), player(2, [], true), player(3, [], true)];
    const feedingEvents: FeedingEvent[] = [{ feederSeat: 2, takerSeat: 3, tileValue: 5, takerMode: "melds" }];
    const s = finished(players, outcome({ finishType: ft({}), feedingEvents }), "cezali");
    // base: finisher 0 = -101; seats 1,3 opened empty hand = 0; seat 2 opened empty = 0, plus feeding 5*10 = 50
    expect(scoreHand(s).perSeat).toEqual([-101, 0, 50, 0]);
  });

  it("throws when the hand is not finished", () => {
    const players = [player(0, [], true), player(1, [], true), player(2, [], true), player(3, [], true)];
    const s = finished(players, outcome({}));
    s.status = "playing";
    s.outcome = null;
    expect(() => scoreHand(s)).toThrow();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (Cannot find module './scoring.js').

- [ ] **Step 3: Implement `scoring.ts`**

```ts
import { InvalidMoveError } from "../../core/errors/index.js";
import { isWildcard } from "./okey.js";
import { tileValue } from "./points.js";
import { isNumbered } from "./tile.js";
import type { OkeyTile, NumberedTile } from "./tile.js";
import type { OkeyGameState, FinishType } from "./game-state.js";

export interface HandScore {
  perSeat: number[];
  perTeam: [number, number] | null;
}

function finishMultiplier(ft: FinishType): number {
  let k = 0;
  if (ft.elden) k += 1;
  if (ft.okey) k += 1;
  if (ft.pairs) k += 1;
  return 2 ** k;
}

function tilesValue(hand: readonly OkeyTile[]): number {
  let sum = 0;
  for (const t of hand) if (isNumbered(t)) sum += tileValue(t);
  return sum;
}

function hasWildcard(hand: readonly OkeyTile[], okey: NumberedTile): boolean {
  return hand.some((t) => isWildcard(t, okey));
}

export function scoreHand(state: OkeyGameState): HandScore {
  if (state.status !== "finished" || state.outcome === null) {
    throw new InvalidMoveError("cannot score a hand that is not finished");
  }
  const outcome = state.outcome;
  const base = [0, 0, 0, 0];

  if (outcome.deckExhausted) {
    base[0] = 202;
    base[1] = 202;
    base[2] = 202;
    base[3] = 202;
  } else {
    const finisher = outcome.finisherSeat;
    if (finisher === null || outcome.finishType === null) {
      throw new InvalidMoveError("finished hand has no finisher and is not deck-exhausted");
    }
    const m = finishMultiplier(outcome.finishType);
    for (const p of state.players) {
      if (p.seat === finisher) {
        base[p.seat] = -101 * m;
      } else if (!p.opened) {
        base[p.seat] = 202 * m;
      } else {
        base[p.seat] = tilesValue(p.hand) * m + (hasWildcard(p.hand, state.okey) ? 101 : 0);
      }
    }
  }

  if (state.config.penalty === "cezali") {
    for (const ev of outcome.feedingEvents) {
      const add = ev.tileValue * (ev.takerMode === "melds" ? 10 : 20);
      base[ev.feederSeat] = (base[ev.feederSeat] ?? 0) + add;
    }
  }

  if (state.config.pairing !== "esli") {
    return { perSeat: base, perTeam: null };
  }

  const perSeat = base.slice();
  if (!outcome.deckExhausted && outcome.finisherSeat !== null && outcome.finishType !== null) {
    const finisher = outcome.finisherSeat;
    const m = finishMultiplier(outcome.finishType);
    const finisherTeam = state.players[finisher]!.team;
    const partner = state.players.find((p) => p.seat !== finisher && p.team === finisherTeam);
    perSeat[finisher] = m === 1 ? 0 : -101 * m;
    if (partner) perSeat[partner.seat] = 0;
  }
  const team0 = perSeat[0]! + perSeat[2]!;
  const team1 = perSeat[1]! + perSeat[3]!;
  return { perSeat, perTeam: [team0, team1] };
}
```

- [ ] **Step 4: Run tests + typecheck + lint** — all clean (7 tests pass).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/scoring.ts server/src/games/okey/scoring.test.ts
git commit -m "feat(okey): add scoreHand (essiz finish/exhaustion/feeding, multiplier)"
```

---

## Task 5: Scoring — eşli team aggregation tests

The eşli logic was implemented in Task 4; this task verifies it. If a test exposes a bug, fix `scoring.ts`.

**Files:**
- Test: `server/src/games/okey/scoring-esli.test.ts`

- [ ] **Step 1: Write the failing/verifying test** (`server/src/games/okey/scoring-esli.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, HandOutcome, FinishType } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { scoreHand } from "./scoring.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[], opened: boolean): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: (seat % 2) as 0 | 1, hand, opened, openMode: opened ? "melds" : null, openScore: 0, pairCount: 0, openedOnTurn: null };
}

function ft(over: Partial<FinishType>): FinishType {
  return { elden: false, okey: false, pairs: false, ...over };
}

function esliFinished(players: PlayerHandState[], outcome: HandOutcome): OkeyGameState {
  return {
    config: makeConfig({ pairing: "esli", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey, players,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 5, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: outcome.feedingEvents, meldSeq: 0, status: "finished", outcome,
  };
}

describe("scoreHand (esli)", () => {
  it("normal finish: finishing team 0, partner penalty forgiven", () => {
    // finisher seat 0 (team0), partner seat 2 has leftovers (forgiven). Losers seats 1,3 (team1).
    const players = [
      player(0, [], true),
      player(1, [numbered("blue", 9)], true),   // 9
      player(2, [numbered("black", 8)], true),   // forgiven
      player(3, [numbered("yellow", 4)], false), // 202
    ];
    const score = scoreHand(esliFinished(players, { finisherSeat: 0, finishType: ft({}), leftovers: [], feedingEvents: [], deckExhausted: false }));
    expect(score.perSeat[0]).toBe(0);    // finishing team value (m=1)
    expect(score.perSeat[2]).toBe(0);    // partner forgiven
    expect(score.perTeam![0]).toBe(0);   // team0 = finishing team
    expect(score.perTeam![1]).toBe(9 + 202); // team1 losers
  });

  it("special finish (okey, m=2): finishing team -202", () => {
    const players = [player(0, [], true), player(1, [numbered("blue", 9)], true), player(2, [numbered("black", 8)], true), player(3, [], false)];
    const score = scoreHand(esliFinished(players, { finisherSeat: 0, finishType: ft({ okey: true }), leftovers: [], feedingEvents: [], deckExhausted: false }));
    expect(score.perTeam![0]).toBe(-202);
    expect(score.perTeam![1]).toBe(9 * 2 + 202 * 2); // 18 + 404 = 422
  });

  it("deck exhaustion in esli: every seat 202, teams 404 each", () => {
    const players = [player(0, [], false), player(1, [], false), player(2, [], false), player(3, [], false)];
    const score = scoreHand(esliFinished(players, { finisherSeat: null, finishType: null, leftovers: [], feedingEvents: [], deckExhausted: true }));
    expect(score.perTeam).toEqual([404, 404]);
  });
});
```

- [ ] **Step 2: Run it** — expected PASS (eşli logic already implemented in Task 4). If anything fails, fix `scoring.ts` and re-run.

Run: `pnpm --filter @masa/server test --run src/games/okey/scoring-esli.test.ts`

- [ ] **Step 3: typecheck + lint** clean, then commit

```bash
git add server/src/games/okey/scoring-esli.test.ts server/src/games/okey/scoring.ts
git commit -m "test(okey): cover esli team scoring (forgiveness, special finish, exhaustion)"
```

---

## Task 6: Match accumulation

**Files:**
- Create: `server/src/games/okey/match.ts`
- Test: `server/src/games/okey/match.test.ts`

- [ ] **Step 1: Write the failing test** (`server/src/games/okey/match.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { makeConfig } from "./game-config.js";
import { createMatch, applyHandScore } from "./match.js";
import type { HandScore } from "./scoring.js";

const players = ["p0", "p1", "p2", "p3"] as PlayerId[];
const essiz = makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 2 });
const esli = makeConfig({ pairing: "esli", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 2 });

const hs = (perSeat: number[], perTeam: [number, number] | null = null): HandScore => ({ perSeat, perTeam });

describe("match", () => {
  it("createMatch initializes totals and team buckets", () => {
    expect(createMatch(essiz, players).seatTotals).toEqual([0, 0, 0, 0]);
    expect(createMatch(essiz, players).teamTotals).toBeNull();
    expect(createMatch(esli, players).teamTotals).toEqual([0, 0]);
  });

  it("rejects a non-4 player list", () => {
    expect(() => createMatch(essiz, ["a", "b"] as PlayerId[])).toThrow();
  });

  it("accumulates per-seat scores and finishes after targetHands (essiz, lowest wins)", () => {
    let m = createMatch(essiz, players);
    m = applyHandScore(m, hs([-101, 20, 202, 5]));
    expect(m.status).toBe("playing");
    m = applyHandScore(m, hs([10, 10, 10, 10]));
    expect(m.status).toBe("finished");
    expect(m.seatTotals).toEqual([-91, 30, 212, 15]);
    expect(m.winner).toEqual({ kind: "seat", seat: 0 });
  });

  it("accumulates team totals and picks the lowest team (esli)", () => {
    let m = createMatch(esli, players);
    m = applyHandScore(m, hs([0, 9, 0, 202], [0, 211]));
    m = applyHandScore(m, hs([5, 5, 5, 5], [10, 10]));
    expect(m.status).toBe("finished");
    expect(m.teamTotals).toEqual([10, 221]);
    expect(m.winner).toEqual({ kind: "team", team: 0 });
  });

  it("rejects applying a score to a finished match", () => {
    let m = createMatch(essiz, players);
    m = applyHandScore(m, hs([1, 1, 1, 1]));
    m = applyHandScore(m, hs([1, 1, 1, 1]));
    expect(() => applyHandScore(m, hs([1, 1, 1, 1]))).toThrow();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (Cannot find module './match.js').

- [ ] **Step 3: Implement `match.ts`**

```ts
import { InvalidMoveError } from "../../core/errors/index.js";
import type { PlayerId } from "@masa/shared";
import type { OkeyGameConfig } from "./game-config.js";
import type { HandScore } from "./scoring.js";

export type MatchWinner = { kind: "seat"; seat: number } | { kind: "team"; team: 0 | 1 } | null;

export interface MatchState {
  config: OkeyGameConfig;
  players: PlayerId[];
  seatTotals: number[];
  teamTotals: [number, number] | null;
  handsPlayed: number;
  status: "playing" | "finished";
  winner: MatchWinner;
}

export function createMatch(config: OkeyGameConfig, players: readonly PlayerId[]): MatchState {
  if (players.length !== 4) throw new InvalidMoveError("okey requires exactly 4 players");
  return {
    config,
    players: [...players],
    seatTotals: [0, 0, 0, 0],
    teamTotals: config.pairing === "esli" ? [0, 0] : null,
    handsPlayed: 0,
    status: "playing",
    winner: null,
  };
}

export function applyHandScore(match: MatchState, score: HandScore): MatchState {
  if (match.status === "finished") throw new InvalidMoveError("match is already finished");

  const seatTotals = match.seatTotals.map((t, i) => t + score.perSeat[i]!);
  let teamTotals: [number, number] | null = null;
  if (match.teamTotals !== null) {
    const st = score.perTeam ?? [0, 0];
    teamTotals = [match.teamTotals[0] + st[0], match.teamTotals[1] + st[1]];
  }
  const handsPlayed = match.handsPlayed + 1;

  let status: "playing" | "finished" = "playing";
  let winner: MatchWinner = null;
  if (handsPlayed === match.config.targetHands) {
    status = "finished";
    if (teamTotals !== null) {
      winner = { kind: "team", team: teamTotals[0] <= teamTotals[1] ? 0 : 1 };
    } else {
      let best = 0;
      for (let i = 1; i < seatTotals.length; i++) if (seatTotals[i]! < seatTotals[best]!) best = i;
      winner = { kind: "seat", seat: best };
    }
  }

  return { ...match, seatTotals, teamTotals, handsPlayed, status, winner };
}
```

- [ ] **Step 4: Run tests + typecheck + lint** — all clean (5 tests pass).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/match.ts server/src/games/okey/match.test.ts
git commit -m "feat(okey): add match accumulation with lowest-total winner"
```

---

## Task 7: Barrel export + full verification

**Files:**
- Modify: `server/src/games/okey/index.ts`

- [ ] **Step 1: Extend the barrel** — append to `server/src/games/okey/index.ts`:

```ts
export * from "./scoring.js";
export * from "./match.js";
```

(Keep all existing exports. `helpers.ts`/`outcome.ts` stay unexported internals.)

- [ ] **Step 2: Full verification** — run and confirm each is clean:

Run: `pnpm test` → full suite passes (existing minus the deleted void test, plus the new scoring/match/threshold tests).
Run: `pnpm typecheck` → clean (no `isVoid`/`"void"` references remain anywhere).
Run: `pnpm lint` → exit 0.
Run: `pnpm build` → success.

Fix any issue (unused import, collision, leftover void reference) before committing.

- [ ] **Step 3: Commit**

```bash
git add server/src/games/okey/index.ts
git commit -m "feat(okey): export scoring and match via barrel"
```

---

## Notes for the implementer

- **Purity:** `scoreHand` and the `match.ts` reducers never mutate their inputs (use `.map`/`.slice`/spread).
- **Out of scope:** dealing the next hand, turn-timeout, Socket.IO, room-config → config, client UI. `match.ts` only accumulates and reports the winner.
- **1a/1b reuse:** `tileValue` (points.js), `isWildcard` (okey.js), `isNumbered` (tile.js). Do not reimplement.

## Self-review (author)

- **Spec coverage:** void removal (T1), partnerEscalation config (T2), team-aware thresholds (T3), scoring eşsiz/exhaust/feeding (T4), scoring eşli (T5), match (T6), barrel+verify (T7). All spec sections mapped.
- **Type consistency:** `HandScore { perSeat, perTeam }` defined in T4 used in T6; `MatchState` fields stable; `GameStatus` narrowed in T1 and consumed consistently; `FinishType` flags match `finishMultiplier`.
- **No placeholders:** every step has complete code or an exact command + expected result. T3/T5 explicitly tell the implementer what to do if an existing test breaks / a verifying test fails.
