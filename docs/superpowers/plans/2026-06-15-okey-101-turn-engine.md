# Okey 101 Tur Motoru (1b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, immutable Okey 101 turn engine that plays one hand from deal to finish, supporting all variant mechanics via config, emitting a `HandOutcome` for later scoring.

**Architecture:** Pure reducer `applyMove(state, move, bySeat) → state` over an immutable `OkeyGameState`, built on the existing 1a primitives. State is cloned then mutated then returned (throw on invalid move discards the clone, so inputs are never mutated). RNG only used in `setup`. Hidden info is enforced by `toOkeyPlayerView`.

**Tech Stack:** TypeScript (strict, NodeNext), Vitest, existing `server/src/games/okey/` 1a modules and `server/src/core/{rng,errors}`.

**Spec:** `docs/superpowers/specs/2026-06-15-okey-101-turn-engine-design.md`
**Rules:** `docs/okey-101-rules.md`

---

## File Structure

All new files under `server/src/games/okey/`:

- `game-config.ts` — `OkeyGameConfig`, mode unions, `makeConfig` factory + defaults.
- `game-state.ts` — type-only: `OkeyGameState`, `PlayerHandState`, `TableMeld`, `FinishType`, `FeedingEvent`, `HandOutcome`.
- `errors.ts` — okey-specific `AppError` subclasses.
- `setup.ts` — `createHand(config, players, rng)`.
- `move.ts` — `Move` union.
- `helpers.ts` — shared pure helpers: `cloneState`, `current`, `requirePhase`, `removeTilesFromHand`, `consumeFloorIfLaid`, `recordFeeding`, `meldThreshold`, `pairThreshold`.
- `outcome.ts` — `buildFinishOutcome`, `buildVoidOutcome`, `buildExhaustOutcome`.
- `opening.ts` — `applyOpenMelds`, `applyOpenPairs`, `validatePairsOpening`, `applyProcessToMeld`, `applyOpenNewMeld`.
- `apply.ts` — `applyMove` dispatcher + draw + discard handlers.
- `view.ts` — `OkeyPlayerView`, `PublicPlayer`, `toOkeyPlayerView`.
- `index.ts` — extend barrel (existing file).

Run commands (Windows PowerShell or Bash): `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. Single test file: `pnpm --filter @masa/server test --run src/games/okey/<name>.test.ts`.

> **IMPORTANT — branded PlayerId:** `@masa/shared`'s `PlayerId` is a branded type (`string & { __brand: "PlayerId" }`), NOT a plain string. In every test that constructs player ids, import `import type { PlayerId } from "@masa/shared";` and cast: a list as `["p0","p1","p2","p3"] as PlayerId[]`, an inline id as `` `p${seat}` as PlayerId `` or `"p0" as PlayerId`. **`vitest` does not typecheck — always run `pnpm typecheck` before committing; it MUST be clean.** (The code blocks below omit these casts for brevity; add them.)

---

## Task 1: Game config

**Files:**
- Create: `server/src/games/okey/game-config.ts`
- Test: `server/src/games/okey/game-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { makeConfig, DEFAULT_OPEN_THRESHOLD, DEFAULT_MIN_PAIRS } from "./game-config.js";

describe("makeConfig", () => {
  it("fills defaults for threshold and pairs", () => {
    const c = makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 });
    expect(c.openThreshold).toBe(DEFAULT_OPEN_THRESHOLD);
    expect(c.minPairs).toBe(DEFAULT_MIN_PAIRS);
    expect(c.pairing).toBe("essiz");
    expect(c.targetHands).toBe(11);
  });

  it("respects overrides", () => {
    const c = makeConfig({ pairing: "esli", escalation: "katlamali", penalty: "cezali", targetHands: 21, openThreshold: 51, minPairs: 6 });
    expect(c.openThreshold).toBe(51);
    expect(c.minPairs).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/game-config.test.ts`
Expected: FAIL (Cannot find module './game-config.js').

- [ ] **Step 3: Write the implementation**

```ts
// server/src/games/okey/game-config.ts
export type PairingMode = "essiz" | "esli";
export type EscalationMode = "katlamasiz" | "katlamali";
export type PenaltyMode = "cezasiz" | "cezali";
export type TargetHands = 7 | 11 | 21;

export const DEFAULT_OPEN_THRESHOLD = 101;
export const DEFAULT_MIN_PAIRS = 5;

export interface OkeyGameConfig {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  targetHands: TargetHands;
  openThreshold: number;
  minPairs: number;
}

export interface OkeyGameConfigInput {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  targetHands: TargetHands;
  openThreshold?: number;
  minPairs?: number;
}

export function makeConfig(input: OkeyGameConfigInput): OkeyGameConfig {
  return {
    pairing: input.pairing,
    escalation: input.escalation,
    penalty: input.penalty,
    targetHands: input.targetHands,
    openThreshold: input.openThreshold ?? DEFAULT_OPEN_THRESHOLD,
    minPairs: input.minPairs ?? DEFAULT_MIN_PAIRS,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/game-config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/game-config.ts server/src/games/okey/game-config.test.ts
git commit -m "feat(okey): add 1b game config with mode dimensions and defaults"
```

---

## Task 2: Okey-specific errors

**Files:**
- Create: `server/src/games/okey/errors.ts`
- Test: `server/src/games/okey/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { AppError } from "../../core/errors/index.js";
import {
  WrongPhaseError, IllegalDrawError, AlreadyOpenedError, NotOpenedError,
  OpeningThresholdNotMetError, ModeLockedError, FloorTileUnusedError, TileNotInHandError,
} from "./errors.js";

describe("okey errors", () => {
  it("are AppError subclasses with stable codes and names", () => {
    const e = new OpeningThresholdNotMetError("need 101");
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe("OPENING_THRESHOLD_NOT_MET");
    expect(e.name).toBe("OpeningThresholdNotMetError");
    expect(e.message).toContain("need 101");
  });

  it("expose distinct codes", () => {
    const codes = [
      new WrongPhaseError("x").code, new IllegalDrawError("x").code,
      new AlreadyOpenedError().code, new NotOpenedError().code,
      new ModeLockedError("x").code, new FloorTileUnusedError().code,
      new TileNotInHandError().code,
    ];
    expect(new Set(codes).size).toBe(codes.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/errors.test.ts`
Expected: FAIL (Cannot find module './errors.js').

- [ ] **Step 3: Write the implementation**

```ts
// server/src/games/okey/errors.ts
import { AppError } from "../../core/errors/index.js";

export class WrongPhaseError extends AppError {
  readonly code = "WRONG_PHASE";
  constructor(reason: string) { super(`Wrong phase: ${reason}`); }
}
export class IllegalDrawError extends AppError {
  readonly code = "ILLEGAL_DRAW";
  constructor(reason: string) { super(`Illegal draw: ${reason}`); }
}
export class AlreadyOpenedError extends AppError {
  readonly code = "ALREADY_OPENED";
  constructor() { super("Player has already opened this hand"); }
}
export class NotOpenedError extends AppError {
  readonly code = "NOT_OPENED";
  constructor() { super("Player must open before laying tiles on the table"); }
}
export class OpeningThresholdNotMetError extends AppError {
  readonly code = "OPENING_THRESHOLD_NOT_MET";
  constructor(reason: string) { super(`Opening threshold not met: ${reason}`); }
}
export class ModeLockedError extends AppError {
  readonly code = "MODE_LOCKED";
  constructor(reason: string) { super(`Mode locked: ${reason}`); }
}
export class FloorTileUnusedError extends AppError {
  readonly code = "FLOOR_TILE_UNUSED";
  constructor() { super("A tile taken from the discard pile must be used this turn"); }
}
export class TileNotInHandError extends AppError {
  readonly code = "TILE_NOT_IN_HAND";
  constructor() { super("A tile in the move is not in the player's hand"); }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/errors.ts server/src/games/okey/errors.test.ts
git commit -m "feat(okey): add 1b move error classes"
```

---

## Task 3: Game-state types + setup

**Files:**
- Create: `server/src/games/okey/game-state.ts` (types only)
- Create: `server/src/games/okey/setup.ts`
- Test: `server/src/games/okey/setup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { createHand } from "./setup.js";
import { isNumbered } from "./tile.js";

const config = makeConfig({ pairing: "esli", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 });
const players = ["p0", "p1", "p2", "p3"];

describe("createHand", () => {
  it("deals 22/21/21/21, a numbered indicator, 20 draw pile", () => {
    const s = createHand(config, players, new SeededRng(1));
    expect(s.players.map((p) => p.hand.length)).toEqual([22, 21, 21, 21]);
    expect(isNumbered(s.indicator)).toBe(true);
    expect(s.drawPile.length).toBe(20);
    expect(s.okey.value).toBe(s.indicator.value === 13 ? 1 : s.indicator.value + 1);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe("draw");
    expect(s.status).toBe("playing");
  });

  it("assigns facing teams in esli (0&2 vs 1&3), null in essiz", () => {
    const s = createHand(config, players, new SeededRng(2));
    expect(s.players.map((p) => p.team)).toEqual([0, 1, 0, 1]);
    const solo = createHand(makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }), players, new SeededRng(2));
    expect(solo.players.every((p) => p.team === null)).toBe(true);
  });

  it("conserves all 106 tiles and is deterministic per seed", () => {
    const s1 = createHand(config, players, new SeededRng(7));
    const s2 = createHand(config, players, new SeededRng(7));
    const count = s1.players.reduce((n, p) => n + p.hand.length, 0) + s1.drawPile.length + 1;
    expect(count).toBe(106);
    expect(JSON.stringify(s1.players[0]!.hand)).toBe(JSON.stringify(s2.players[0]!.hand));
  });

  it("rejects a player list that is not exactly 4", () => {
    expect(() => createHand(config, ["a", "b", "c"], new SeededRng(1))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/setup.test.ts`
Expected: FAIL (Cannot find module './setup.js').

- [ ] **Step 3: Write game-state types**

```ts
// server/src/games/okey/game-state.ts
import type { PlayerId } from "@masa/shared";
import type { OkeyTile, NumberedTile } from "./tile.js";
import type { OkeyGameConfig } from "./game-config.js";

export interface TableMeld {
  id: string;
  owner: number;
  kind: "run" | "set" | "pair";
  tiles: OkeyTile[];
}

export interface PlayerHandState {
  seat: number;
  playerId: PlayerId;
  team: 0 | 1 | null;
  hand: OkeyTile[];
  opened: boolean;
  openMode: "melds" | "pairs" | null;
  openScore: number;
  pairCount: number;
  openedOnTurn: number | null;
}

export interface FinishType {
  elden: boolean;
  okey: boolean;
  pairs: boolean;
}

export interface FeedingEvent {
  feederSeat: number;
  takerSeat: number;
  tileValue: number;
  takerMode: "melds" | "pairs";
}

export interface HandOutcome {
  finisherSeat: number | null;
  finishType: FinishType | null;
  leftovers: { seat: number; tiles: OkeyTile[] }[];
  feedingEvents: FeedingEvent[];
  isVoid: boolean;
  deckExhausted: boolean;
}

export type GamePhase = "draw" | "act";
export type GameStatus = "playing" | "finished" | "void";

export interface OkeyGameState {
  config: OkeyGameConfig;
  indicator: NumberedTile;
  okey: NumberedTile;
  players: PlayerHandState[];
  drawPile: OkeyTile[];
  discards: OkeyTile[][];
  tableMelds: TableMeld[];
  turn: number;
  turnSeq: number;
  phase: GamePhase;
  pendingFloorTile: OkeyTile | null;
  highestOpenScore: number | null;
  highestOpenPairs: number | null;
  feedingEvents: FeedingEvent[];
  meldSeq: number;
  status: GameStatus;
  outcome: HandOutcome | null;
}
```

- [ ] **Step 4: Write setup**

```ts
// server/src/games/okey/setup.ts
import type { PlayerId } from "@masa/shared";
import type { Rng } from "../../core/rng.js";
import { InvalidMoveError } from "../../core/errors/index.js";
import { buildDeck, shuffle } from "./deck.js";
import { deal } from "./deal.js";
import { determineOkey } from "./okey.js";
import type { OkeyGameConfig } from "./game-config.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";

export function createHand(
  config: OkeyGameConfig,
  players: readonly PlayerId[],
  rng: Rng,
): OkeyGameState {
  if (players.length !== 4) {
    throw new InvalidMoveError("okey requires exactly 4 players");
  }
  const deck = shuffle(buildDeck(), rng);
  const { hands, indicator, drawPile } = deal(deck);
  const okey = determineOkey(indicator);

  const playerStates: PlayerHandState[] = players.map((id, seat) => ({
    seat,
    playerId: id,
    team: config.pairing === "esli" ? ((seat % 2) as 0 | 1) : null,
    hand: hands[seat]!,
    opened: false,
    openMode: null,
    openScore: 0,
    pairCount: 0,
    openedOnTurn: null,
  }));

  return {
    config,
    indicator,
    okey,
    players: playerStates,
    drawPile,
    discards: [[], [], [], []],
    tableMelds: [],
    turn: 0,
    turnSeq: 0,
    phase: "draw",
    pendingFloorTile: null,
    highestOpenScore: null,
    highestOpenPairs: null,
    feedingEvents: [],
    meldSeq: 0,
    status: "playing",
    outcome: null,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @masa/server test --run src/games/okey/setup.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/games/okey/game-state.ts server/src/games/okey/setup.ts server/src/games/okey/setup.test.ts
git commit -m "feat(okey): add 1b game-state types and createHand setup"
```

---

## Task 4: Move union, helpers, outcome builders, applyMove (draw + dispatch + exhaustion)

**Files:**
- Create: `server/src/games/okey/move.ts`
- Create: `server/src/games/okey/helpers.ts`
- Create: `server/src/games/okey/outcome.ts`
- Create: `server/src/games/okey/apply.ts`
- Test: `server/src/games/okey/apply-draw.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { createHand } from "./setup.js";
import { applyMove } from "./apply.js";

const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 });
const players = ["p0", "p1", "p2", "p3"];

describe("applyMove draw phase", () => {
  it("drawFromPile moves one tile to the hand and enters act phase", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    const s1 = applyMove(s0, { kind: "drawFromPile" }, 0);
    expect(s1.players[0]!.hand.length).toBe(23);
    expect(s1.drawPile.length).toBe(19);
    expect(s1.phase).toBe("act");
  });

  it("does not mutate the input state", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    const before = JSON.stringify(s0);
    applyMove(s0, { kind: "drawFromPile" }, 0);
    expect(JSON.stringify(s0)).toBe(before);
  });

  it("rejects a move from the wrong seat", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    expect(() => applyMove(s0, { kind: "drawFromPile" }, 1)).toThrow();
  });

  it("rejects drawFromPile when not in draw phase", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    const s1 = applyMove(s0, { kind: "drawFromPile" }, 0);
    expect(() => applyMove(s1, { kind: "drawFromPile" }, 0)).toThrow();
  });

  it("drawFromDiscard takes the previous seat's last discard and marks it pending", () => {
    let s = createHand(config, players, new SeededRng(1));
    // seat 0 draws then discards a tile so seat 1 has something to take
    s = applyMove(s, { kind: "drawFromPile" }, 0);
    const discarded = s.players[0]!.hand[0]!;
    s = applyMove(s, { kind: "discard", tile: discarded }, 0);
    expect(s.turn).toBe(1);
    const s2 = applyMove(s, { kind: "drawFromDiscard" }, 1);
    expect(s2.pendingFloorTile).not.toBeNull();
    expect(s2.players[1]!.hand.length).toBe(22);
    expect(s2.phase).toBe("act");
  });

  it("ends the hand by exhaustion when the draw pile is empty", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    const emptyPile = { ...s0, drawPile: [] };
    const s1 = applyMove(emptyPile, { kind: "drawFromPile" }, 0);
    expect(s1.status).toBe("finished");
    expect(s1.outcome?.deckExhausted).toBe(true);
    expect(s1.outcome?.finisherSeat).toBeNull();
  });
});
```

> Note: this test relies on `discard` (added here in apply.ts) and on `applyMove` enforcing turn/phase. Implement all of move/helpers/outcome/apply below.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/apply-draw.test.ts`
Expected: FAIL (Cannot find module './apply.js').

- [ ] **Step 3: Write move union**

```ts
// server/src/games/okey/move.ts
import type { OkeyTile } from "./tile.js";

export type Move =
  | { kind: "drawFromPile" }
  | { kind: "drawFromDiscard" }
  | { kind: "openMelds"; melds: OkeyTile[][] }
  | { kind: "openPairs"; pairs: OkeyTile[][] }
  | { kind: "openNewMeld"; tiles: OkeyTile[] }
  | { kind: "processToMeld"; meldId: string; tiles: OkeyTile[] }
  | { kind: "discard"; tile: OkeyTile };
```

- [ ] **Step 4: Write helpers**

```ts
// server/src/games/okey/helpers.ts
import type { OkeyTile } from "./tile.js";
import { isNumbered, tilesEqual } from "./tile.js";
import type { OkeyGameState, PlayerHandState, HandOutcome } from "./game-state.js";
import { WrongPhaseError, TileNotInHandError } from "./errors.js";

function cloneTile(t: OkeyTile): OkeyTile {
  return t.kind === "numbered" ? { kind: "numbered", color: t.color, value: t.value } : { kind: "fakeJoker" };
}
function cloneTiles(ts: readonly OkeyTile[]): OkeyTile[] {
  return ts.map(cloneTile);
}
function cloneOutcome(o: HandOutcome): HandOutcome {
  return {
    finisherSeat: o.finisherSeat,
    finishType: o.finishType ? { ...o.finishType } : null,
    leftovers: o.leftovers.map((l) => ({ seat: l.seat, tiles: cloneTiles(l.tiles) })),
    feedingEvents: o.feedingEvents.map((e) => ({ ...e })),
    isVoid: o.isVoid,
    deckExhausted: o.deckExhausted,
  };
}

/** Deep copy so applyMove never mutates its input. */
export function cloneState(s: OkeyGameState): OkeyGameState {
  return {
    config: { ...s.config },
    indicator: { ...s.indicator },
    okey: { ...s.okey },
    players: s.players.map((p) => ({ ...p, hand: cloneTiles(p.hand) })),
    drawPile: cloneTiles(s.drawPile),
    discards: s.discards.map(cloneTiles),
    tableMelds: s.tableMelds.map((m) => ({ ...m, tiles: cloneTiles(m.tiles) })),
    turn: s.turn,
    turnSeq: s.turnSeq,
    phase: s.phase,
    pendingFloorTile: s.pendingFloorTile ? cloneTile(s.pendingFloorTile) : null,
    highestOpenScore: s.highestOpenScore,
    highestOpenPairs: s.highestOpenPairs,
    feedingEvents: s.feedingEvents.map((e) => ({ ...e })),
    meldSeq: s.meldSeq,
    status: s.status,
    outcome: s.outcome ? cloneOutcome(s.outcome) : null,
  };
}

export function current(s: OkeyGameState): PlayerHandState {
  return s.players[s.turn]!;
}

export function requirePhase(s: OkeyGameState, phase: "draw" | "act"): void {
  if (s.phase !== phase) throw new WrongPhaseError(`expected ${phase}, was ${s.phase}`);
}

/** Remove exactly one hand tile per requested tile (by value); throws if any is missing. */
export function removeTilesFromHand(player: PlayerHandState, tiles: readonly OkeyTile[]): void {
  const used = new Set<number>();
  for (const t of tiles) {
    let found = -1;
    for (let i = 0; i < player.hand.length; i++) {
      if (!used.has(i) && tilesEqual(player.hand[i]!, t)) { found = i; break; }
    }
    if (found === -1) throw new TileNotInHandError();
    used.add(found);
  }
  player.hand = player.hand.filter((_, i) => !used.has(i));
}

/** If a pending floor tile is among the laid tiles, clear it and report consumption. */
export function consumeFloorIfLaid(s: OkeyGameState, laid: readonly OkeyTile[]): boolean {
  if (s.pendingFloorTile === null) return false;
  const present = laid.some((t) => tilesEqual(t, s.pendingFloorTile!));
  if (present) { s.pendingFloorTile = null; return true; }
  return false;
}

/** Record that `taker` opened using a tile fed by the previous seat. */
export function recordFeeding(
  s: OkeyGameState,
  taker: PlayerHandState,
  mode: "melds" | "pairs",
  floorTile: OkeyTile,
): void {
  s.feedingEvents.push({
    feederSeat: (taker.seat + 3) % 4,
    takerSeat: taker.seat,
    tileValue: isNumbered(floorTile) ? floorTile.value : 0,
    takerMode: mode,
  });
}

export function meldThreshold(s: OkeyGameState): number {
  if (s.config.escalation === "katlamasiz") return s.config.openThreshold;
  return s.highestOpenScore === null ? s.config.openThreshold : s.highestOpenScore + 1;
}

export function pairThreshold(s: OkeyGameState): number {
  if (s.config.escalation === "katlamasiz") return s.config.minPairs;
  return s.highestOpenPairs === null ? s.config.minPairs : s.highestOpenPairs + 1;
}
```

- [ ] **Step 5: Write outcome builders**

```ts
// server/src/games/okey/outcome.ts
import { isWildcard } from "./okey.js";
import type { OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, HandOutcome } from "./game-state.js";

function leftoversOf(s: OkeyGameState, exceptSeat: number | null): HandOutcome["leftovers"] {
  return s.players
    .filter((p) => p.seat !== exceptSeat)
    .map((p) => ({ seat: p.seat, tiles: p.hand.slice() }));
}

export function buildFinishOutcome(s: OkeyGameState, finisher: PlayerHandState, lastTile: OkeyTile): HandOutcome {
  return {
    finisherSeat: finisher.seat,
    finishType: {
      elden: finisher.openedOnTurn === s.turnSeq,
      okey: isWildcard(lastTile, s.okey),
      pairs: finisher.openMode === "pairs",
    },
    leftovers: leftoversOf(s, finisher.seat),
    feedingEvents: s.feedingEvents.map((e) => ({ ...e })),
    isVoid: false,
    deckExhausted: false,
  };
}

export function buildVoidOutcome(s: OkeyGameState): HandOutcome {
  return {
    finisherSeat: null,
    finishType: null,
    leftovers: leftoversOf(s, null),
    feedingEvents: s.feedingEvents.map((e) => ({ ...e })),
    isVoid: true,
    deckExhausted: false,
  };
}

export function buildExhaustOutcome(s: OkeyGameState): HandOutcome {
  return {
    finisherSeat: null,
    finishType: null,
    leftovers: leftoversOf(s, null),
    feedingEvents: s.feedingEvents.map((e) => ({ ...e })),
    isVoid: false,
    deckExhausted: true,
  };
}
```

- [ ] **Step 6: Write applyMove (draw + discard + dispatch + exhaustion)**

```ts
// server/src/games/okey/apply.ts
import { InvalidMoveError, NotYourTurnError } from "../../core/errors/index.js";
import type { OkeyTile } from "./tile.js";
import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";
import { IllegalDrawError, FloorTileUnusedError } from "./errors.js";
import {
  cloneState, current, requirePhase, removeTilesFromHand,
} from "./helpers.js";
import { buildExhaustOutcome, buildFinishOutcome } from "./outcome.js";

export function applyMove(state: OkeyGameState, move: Move, bySeat: number): OkeyGameState {
  if (state.status !== "playing") throw new InvalidMoveError("hand is not in progress");
  if (bySeat !== state.turn) throw new NotYourTurnError();
  const s = cloneState(state);
  switch (move.kind) {
    case "drawFromPile": drawFromPile(s); break;
    case "drawFromDiscard": drawFromDiscard(s); break;
    case "discard": discard(s, move.tile); break;
    default: throw new InvalidMoveError(`unsupported move: ${move.kind}`);
  }
  return s;
}

function drawFromPile(s: OkeyGameState): void {
  requirePhase(s, "draw");
  if (s.drawPile.length === 0) {
    s.status = "finished";
    s.outcome = buildExhaustOutcome(s);
    return;
  }
  const tile = s.drawPile.pop()!;
  current(s).hand.push(tile);
  s.phase = "act";
}

function drawFromDiscard(s: OkeyGameState): void {
  requirePhase(s, "draw");
  const me = current(s);
  if (me.openMode === "pairs") throw new IllegalDrawError("a pairs opener cannot take from the discard");
  const prev = (s.turn + 3) % 4;
  const pile = s.discards[prev]!;
  if (pile.length === 0) throw new IllegalDrawError("no discard available to take");
  const tile = pile.pop()!;
  me.hand.push(tile);
  s.pendingFloorTile = tile;
  s.phase = "act";
}

function discard(s: OkeyGameState, tile: OkeyTile): void {
  requirePhase(s, "act");
  if (s.pendingFloorTile !== null) throw new FloorTileUnusedError();
  const me = current(s);
  removeTilesFromHand(me, [tile]);
  s.discards[me.seat]!.push(tile);
  if (me.hand.length === 0) {
    s.status = "finished";
    s.outcome = buildFinishOutcome(s, me, tile);
    return;
  }
  s.phase = "draw";
  s.turn = (s.turn + 1) % 4;
  s.turnSeq += 1;
}
```

> The `default` case is replaced as opening/processing moves are added in Tasks 5-7.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @masa/server test --run src/games/okey/apply-draw.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add server/src/games/okey/move.ts server/src/games/okey/helpers.ts server/src/games/okey/outcome.ts server/src/games/okey/apply.ts server/src/games/okey/apply-draw.test.ts
git commit -m "feat(okey): add 1b move union, engine helpers, outcomes, draw/discard"
```

---

## Task 5: Opening with melds + escalation

**Files:**
- Create: `server/src/games/okey/opening.ts`
- Modify: `server/src/games/okey/apply.ts` (add `openMelds` case)
- Test: `server/src/games/okey/open-melds.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyColor } from "./tile.js";
import type { OkeyGameState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

// Build a deterministic state in "act" phase with a known hand and okey.
function stateWithHand(hand: NumberedTile[], opts?: { escalation?: "katlamasiz" | "katlamali"; highestOpenScore?: number | null }): OkeyGameState {
  const okey: NumberedTile = numbered("red", 13); // okey value 13 (no tile here is okey)
  return {
    config: makeConfig({ pairing: "essiz", escalation: opts?.escalation ?? "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator: numbered("red", 12),
    okey,
    players: [
      { seat: 0, playerId: "p0", team: null, hand: [...hand], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null },
      { seat: 1, playerId: "p1", team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null },
      { seat: 2, playerId: "p2", team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null },
      { seat: 3, playerId: "p3", team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null },
    ],
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: opts?.highestOpenScore ?? null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
  };
}

function run(color: OkeyColor, from: number, to: number): NumberedTile[] {
  const t: NumberedTile[] = [];
  for (let v = from; v <= to; v++) t.push(numbered(color, v));
  return t;
}

describe("openMelds", () => {
  it("accepts an opening that reaches 101 (katlamasiz)", () => {
    // run black 10-11-12-13 = 46, run blue 10-11-12-13 = 46, set 5(red,yellow,black) = 15 -> 107
    const melds = [run("black", 10, 13), run("blue", 10, 13), [numbered("red", 5), numbered("yellow", 5), numbered("black", 5)]];
    const s = stateWithHand(melds.flat());
    const next = applyMove(s, { kind: "openMelds", melds }, 0);
    expect(next.players[0]!.opened).toBe(true);
    expect(next.players[0]!.openMode).toBe("melds");
    expect(next.players[0]!.openScore).toBe(107);
    expect(next.tableMelds.length).toBe(3);
    expect(next.highestOpenScore).toBe(107);
    // tiles left the hand
    expect(next.players[0]!.hand.length).toBe(0);
  });

  it("rejects an opening below the threshold", () => {
    const melds = [run("black", 1, 3)]; // 6 points
    const s = stateWithHand(melds.flat());
    expect(() => applyMove(s, { kind: "openMelds", melds }, 0)).toThrow();
  });

  it("katlamali: a later opener must beat the previous opener's score", () => {
    const melds = [run("black", 10, 13), run("blue", 10, 13)]; // 92
    const s = stateWithHand(melds.flat(), { escalation: "katlamali", highestOpenScore: 120 });
    expect(() => applyMove(s, { kind: "openMelds", melds }, 0)).toThrow(); // 92 < 121
  });

  it("rejects opening when already opened", () => {
    const melds = [run("black", 10, 13), run("blue", 10, 13), [numbered("red", 5), numbered("yellow", 5), numbered("black", 5)]];
    const s = stateWithHand(melds.flat());
    s.players[0]!.opened = true;
    s.players[0]!.openMode = "melds";
    expect(() => applyMove(s, { kind: "openMelds", melds }, 0)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/open-melds.test.ts`
Expected: FAIL (applyMove throws "unsupported move: openMelds").

- [ ] **Step 3: Write opening.ts with applyOpenMelds**

```ts
// server/src/games/okey/opening.ts
import type { OkeyTile } from "./tile.js";
import { isValidMeld, isValidRun } from "./meld.js";
import { meldsTotal } from "./points.js";
import { InvalidMoveError } from "../../core/errors/index.js";
import type { OkeyGameState } from "./game-state.js";
import { AlreadyOpenedError, OpeningThresholdNotMetError } from "./errors.js";
import {
  current, requirePhase, removeTilesFromHand, consumeFloorIfLaid, recordFeeding, meldThreshold,
} from "./helpers.js";

function meldKind(tiles: readonly OkeyTile[], okey: OkeyGameState["okey"]): "run" | "set" {
  return isValidRun(tiles, okey) ? "run" : "set";
}

export function applyOpenMelds(s: OkeyGameState, melds: OkeyTile[][]): void {
  requirePhase(s, "act");
  const me = current(s);
  if (me.opened) throw new AlreadyOpenedError();
  if (melds.length === 0) throw new InvalidMoveError("no melds provided");
  for (const m of melds) {
    if (!isValidMeld(m, s.okey)) throw new InvalidMoveError("a provided meld is not a valid run or set");
  }
  const total = meldsTotal(melds, s.okey);
  const threshold = meldThreshold(s);
  if (total < threshold) {
    throw new OpeningThresholdNotMetError(`have ${total}, need ${threshold}`);
  }
  const flat = melds.flat();
  removeTilesFromHand(me, flat);

  const floorTile = s.pendingFloorTile;
  const consumed = consumeFloorIfLaid(s, flat);
  if (consumed && floorTile) recordFeeding(s, me, "melds", floorTile);

  for (const m of melds) {
    s.tableMelds.push({ id: String(s.meldSeq++), owner: me.seat, kind: meldKind(m, s.okey), tiles: m });
  }
  me.opened = true;
  me.openMode = "melds";
  me.openScore = total;
  me.openedOnTurn = s.turnSeq;
  s.highestOpenScore = s.highestOpenScore === null ? total : Math.max(s.highestOpenScore, total);
}
```

- [ ] **Step 4: Wire openMelds into apply.ts**

In `server/src/games/okey/apply.ts`, add the import and the switch case:

```ts
import { applyOpenMelds } from "./opening.js";
```

```ts
    case "openMelds": applyOpenMelds(s, move.melds); break;
```

(Place the case above the `default` line.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @masa/server test --run src/games/okey/open-melds.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/games/okey/opening.ts server/src/games/okey/apply.ts server/src/games/okey/open-melds.test.ts
git commit -m "feat(okey): add meld opening with threshold and katlamali escalation"
```

---

## Task 6: Opening with pairs (gösterge +1, escalation, 4-pair void)

**Files:**
- Modify: `server/src/games/okey/opening.ts` (add `validatePairsOpening`, `applyOpenPairs`)
- Modify: `server/src/games/okey/apply.ts` (add `openPairs` case)
- Test: `server/src/games/okey/open-pairs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";
import { validatePairsOpening } from "./opening.js";

const okey: NumberedTile = numbered("red", 13);
const indicator: NumberedTile = numbered("red", 12);

function pair(color: "red" | "yellow" | "black" | "blue", value: number): OkeyTile[] {
  return [numbered(color, value), numbered(color, value)];
}

function blankPlayer(seat: number, hand: OkeyTile[]): PlayerHandState {
  return { seat, playerId: `p${seat}`, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null };
}

function pairsState(hand: OkeyTile[], openModes: ("pairs" | null)[] = [null, null, null, null]): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator, okey,
    players: openModes.map((m, seat) => {
      const p = blankPlayer(seat, seat === 0 ? hand : []);
      if (m === "pairs") { p.opened = true; p.openMode = "pairs"; p.pairCount = 5; }
      return p;
    }),
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
  };
}

describe("validatePairsOpening", () => {
  it("accepts five identical pairs", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    expect(validatePairsOpening(pairs, okey, indicator)).toBe(true);
  });
  it("accepts a pair completed by a fake joker", () => {
    const pairs = [[numbered("red", 1), fakeJoker()], pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    expect(validatePairsOpening(pairs, okey, indicator)).toBe(true);
  });
  it("allows the indicator tile to form ONE pair with any tile (gösterge +1)", () => {
    const pairs = [[indicator, numbered("blue", 7)], pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    expect(validatePairsOpening(pairs, okey, indicator)).toBe(true);
  });
  it("rejects two non-matching, non-wildcard tiles", () => {
    const pairs = [[numbered("red", 1), numbered("blue", 7)], pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    expect(validatePairsOpening(pairs, okey, indicator)).toBe(false);
  });
});

describe("applyOpenPairs", () => {
  it("opens with five pairs and locks pairs mode", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    const s = pairsState(pairs.flat());
    const next = applyMove(s, { kind: "openPairs", pairs }, 0);
    expect(next.players[0]!.opened).toBe(true);
    expect(next.players[0]!.openMode).toBe("pairs");
    expect(next.players[0]!.pairCount).toBe(5);
    expect(next.tableMelds.length).toBe(5);
    expect(next.tableMelds.every((m) => m.kind === "pair")).toBe(true);
  });

  it("rejects four pairs (below minPairs)", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4)];
    const s = pairsState(pairs.flat());
    expect(() => applyMove(s, { kind: "openPairs", pairs }, 0)).toThrow();
  });

  it("voids the hand when the fourth player opens pairs", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    const s = pairsState(pairs.flat(), [null, "pairs", "pairs", "pairs"]); // 3 already in pairs
    const next = applyMove(s, { kind: "openPairs", pairs }, 0);
    expect(next.status).toBe("void");
    expect(next.outcome?.isVoid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/open-pairs.test.ts`
Expected: FAIL (Cannot find export 'validatePairsOpening' / unsupported move 'openPairs').

- [ ] **Step 3: Add validatePairsOpening + applyOpenPairs to opening.ts**

Add these imports at the top of `opening.ts`:

```ts
import { isNumbered } from "./tile.js";
import type { NumberedTile } from "./tile.js";
import { isPair } from "./pairs.js";
import { pairThreshold } from "./helpers.js";
import { buildVoidOutcome } from "./outcome.js";
```

Append:

```ts
/**
 * Pairs-opening validity. Like isPair for each pair, plus the gösterge rule:
 * the in-play copy of the indicator tile may form ONE pair with any tile.
 */
export function validatePairsOpening(
  pairs: readonly OkeyTile[][],
  okey: NumberedTile,
  indicator: NumberedTile,
): boolean {
  let gostergeUsed = 0;
  for (const p of pairs) {
    if (p.length !== 2) return false;
    const a = p[0]!;
    const b = p[1]!;
    if (isPair(a, b, okey)) continue;
    const aIsIndicator = isNumbered(a) && a.color === indicator.color && a.value === indicator.value;
    const bIsIndicator = isNumbered(b) && b.color === indicator.color && b.value === indicator.value;
    if ((aIsIndicator || bIsIndicator) && gostergeUsed < 1) {
      gostergeUsed++;
      continue;
    }
    return false;
  }
  return true;
}

export function applyOpenPairs(s: OkeyGameState, pairs: OkeyTile[][]): void {
  requirePhase(s, "act");
  const me = current(s);
  if (me.opened) throw new AlreadyOpenedError();
  if (!validatePairsOpening(pairs, s.okey, s.indicator)) {
    throw new InvalidMoveError("provided groups are not all valid pairs");
  }
  const n = pairs.length;
  const threshold = pairThreshold(s);
  if (n < threshold) {
    throw new OpeningThresholdNotMetError(`have ${n} pairs, need ${threshold}`);
  }
  const flat = pairs.flat();
  removeTilesFromHand(me, flat);

  const floorTile = s.pendingFloorTile;
  const consumed = consumeFloorIfLaid(s, flat);
  if (consumed && floorTile) recordFeeding(s, me, "pairs", floorTile);

  for (const p of pairs) {
    s.tableMelds.push({ id: String(s.meldSeq++), owner: me.seat, kind: "pair", tiles: p });
  }
  me.opened = true;
  me.openMode = "pairs";
  me.pairCount = n;
  me.openedOnTurn = s.turnSeq;
  s.highestOpenPairs = s.highestOpenPairs === null ? n : Math.max(s.highestOpenPairs, n);

  if (s.players.filter((p) => p.openMode === "pairs").length === 4) {
    s.status = "void";
    s.outcome = buildVoidOutcome(s);
  }
}
```

- [ ] **Step 4: Wire openPairs into apply.ts**

In `apply.ts`, extend the opening import and add the case:

```ts
import { applyOpenMelds, applyOpenPairs } from "./opening.js";
```

```ts
    case "openPairs": applyOpenPairs(s, move.pairs); break;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @masa/server test --run src/games/okey/open-pairs.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/games/okey/opening.ts server/src/games/okey/apply.ts server/src/games/okey/open-pairs.test.ts
git commit -m "feat(okey): add pairs opening with gosterge +1, escalation, 4-pair void"
```

---

## Task 7: İşleme (process to meld) + new own meld

**Files:**
- Modify: `server/src/games/okey/opening.ts` (add `applyProcessToMeld`, `applyOpenNewMeld`)
- Modify: `server/src/games/okey/apply.ts` (add the two cases)
- Test: `server/src/games/okey/process.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, TableMeld } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[], opened: boolean, openMode: "melds" | "pairs" | null): PlayerHandState {
  return { seat, playerId: `p${seat}`, team: null, hand, opened, openMode, openScore: 0, pairCount: 0, openedOnTurn: null };
}

function stateWith(hand: OkeyTile[], melds: TableMeld[], opts?: { opened?: boolean; openMode?: "melds" | "pairs" | null }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey,
    players: [
      player(0, hand, opts?.opened ?? true, opts?.openMode ?? "melds"),
      player(1, [], false, null), player(2, [], false, null), player(3, [], false, null),
    ],
    drawPile: [], discards: [[], [], [], []], tableMelds: melds,
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 5, status: "playing", outcome: null,
  };
}

describe("processToMeld", () => {
  it("extends an existing run on the table (any owner)", () => {
    const meld: TableMeld = { id: "m1", owner: 1, kind: "run", tiles: [numbered("blue", 4), numbered("blue", 5), numbered("blue", 6)] };
    const s = stateWith([numbered("blue", 7)], [meld]);
    const next = applyMove(s, { kind: "processToMeld", meldId: "m1", tiles: [numbered("blue", 7)] }, 0);
    expect(next.tableMelds[0]!.tiles.length).toBe(4);
    expect(next.players[0]!.hand.length).toBe(0);
  });

  it("rejects a tile that does not extend the meld", () => {
    const meld: TableMeld = { id: "m1", owner: 0, kind: "run", tiles: [numbered("blue", 4), numbered("blue", 5), numbered("blue", 6)] };
    const s = stateWith([numbered("red", 1)], [meld]);
    expect(() => applyMove(s, { kind: "processToMeld", meldId: "m1", tiles: [numbered("red", 1)] }, 0)).toThrow();
  });

  it("rejects processing before the player has opened", () => {
    const meld: TableMeld = { id: "m1", owner: 1, kind: "run", tiles: [numbered("blue", 4), numbered("blue", 5), numbered("blue", 6)] };
    const s = stateWith([numbered("blue", 7)], [meld], { opened: false, openMode: null });
    expect(() => applyMove(s, { kind: "processToMeld", meldId: "m1", tiles: [numbered("blue", 7)] }, 0)).toThrow();
  });
});

describe("openNewMeld", () => {
  it("lays a new valid run for a melds-mode opener", () => {
    const tiles = [numbered("black", 4), numbered("black", 5), numbered("black", 6)];
    const s = stateWith([...tiles], []);
    const next = applyMove(s, { kind: "openNewMeld", tiles }, 0);
    expect(next.tableMelds.length).toBe(1);
    expect(next.tableMelds[0]!.kind).toBe("run");
    expect(next.players[0]!.hand.length).toBe(0);
  });

  it("lets a pairs-mode opener lay a new pair but not a run", () => {
    const s = stateWith([numbered("black", 8), numbered("black", 8)], [], { openMode: "pairs" });
    const next = applyMove(s, { kind: "openNewMeld", tiles: [numbered("black", 8), numbered("black", 8)] }, 0);
    expect(next.tableMelds[0]!.kind).toBe("pair");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/process.test.ts`
Expected: FAIL (unsupported move 'processToMeld').

- [ ] **Step 3: Add applyProcessToMeld + applyOpenNewMeld to opening.ts**

Add imports at the top of `opening.ts`:

```ts
import { isPair } from "./pairs.js"; // (already imported in Task 6 — keep a single import)
import { NotOpenedError, ModeLockedError } from "./errors.js"; // extend the existing errors import
```

> Ensure the `./errors.js` import line includes `AlreadyOpenedError, OpeningThresholdNotMetError, NotOpenedError, ModeLockedError` and `./pairs.js` is imported once.

Append:

```ts
export function applyProcessToMeld(s: OkeyGameState, meldId: string, tiles: OkeyTile[]): void {
  requirePhase(s, "act");
  const me = current(s);
  if (!me.opened) throw new NotOpenedError();
  if (tiles.length === 0) throw new InvalidMoveError("no tiles to process");
  const meld = s.tableMelds.find((m) => m.id === meldId);
  if (!meld) throw new InvalidMoveError("no such meld on the table");
  if (meld.kind === "pair") throw new InvalidMoveError("cannot process onto a pair");

  const candidate = [...meld.tiles, ...tiles];
  if (!isValidMeld(candidate, s.okey)) {
    throw new InvalidMoveError("processed tiles do not form a valid meld");
  }
  removeTilesFromHand(me, tiles);
  consumeFloorIfLaid(s, tiles); // already opened => no feeding penalty
  meld.tiles = candidate;
  meld.kind = meldKind(candidate, s.okey);
}

export function applyOpenNewMeld(s: OkeyGameState, tiles: OkeyTile[]): void {
  requirePhase(s, "act");
  const me = current(s);
  if (!me.opened) throw new NotOpenedError();
  if (me.openMode === "pairs") {
    if (tiles.length !== 2 || !isPair(tiles[0]!, tiles[1]!, s.okey)) {
      throw new ModeLockedError("pairs mode: a new group must be a valid pair");
    }
    removeTilesFromHand(me, tiles);
    consumeFloorIfLaid(s, tiles);
    s.tableMelds.push({ id: String(s.meldSeq++), owner: me.seat, kind: "pair", tiles });
    return;
  }
  if (!isValidMeld(tiles, s.okey)) {
    throw new InvalidMoveError("tiles are not a valid run or set");
  }
  removeTilesFromHand(me, tiles);
  consumeFloorIfLaid(s, tiles);
  s.tableMelds.push({ id: String(s.meldSeq++), owner: me.seat, kind: meldKind(tiles, s.okey), tiles });
}
```

- [ ] **Step 4: Wire both into apply.ts**

```ts
import { applyOpenMelds, applyOpenPairs, applyProcessToMeld, applyOpenNewMeld } from "./opening.js";
```

```ts
    case "processToMeld": applyProcessToMeld(s, move.meldId, move.tiles); break;
    case "openNewMeld": applyOpenNewMeld(s, move.tiles); break;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @masa/server test --run src/games/okey/process.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/games/okey/opening.ts server/src/games/okey/apply.ts server/src/games/okey/process.test.ts
git commit -m "feat(okey): add isleme (process to meld) and new own meld moves"
```

---

## Task 8: Finish detection, finishType, feeding events

**Files:**
- Test: `server/src/games/okey/finish.test.ts`

> No new production code is expected: finish/feeding were implemented in Tasks 4-6. This task verifies the integrated behavior and fixes any gaps the tests expose. If a test fails, fix the relevant handler (e.g., `buildFinishOutcome`, `recordFeeding`, `discard`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[], opened: boolean, openMode: "melds" | "pairs" | null, openedOnTurn: number | null): PlayerHandState {
  return { seat, playerId: `p${seat}`, team: null, hand, opened, openMode, openScore: 0, pairCount: 0, openedOnTurn };
}

function actState(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezali", targetHands: 11 }),
    indicator: numbered("red", 12), okey,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 3, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
    ...over,
  };
}

describe("finish detection", () => {
  it("finishes when the last tile is discarded and records leftovers", () => {
    const s = actState({
      players: [
        player(0, [numbered("red", 1)], true, "melds", 1),
        player(1, [numbered("blue", 9), numbered("blue", 10)], true, "melds", 0),
        player(2, [numbered("black", 3)], false, null, null),
        player(3, [], true, "melds", 0),
      ],
    });
    const next = applyMove(s, { kind: "discard", tile: numbered("red", 1) }, 0);
    expect(next.status).toBe("finished");
    expect(next.outcome?.finisherSeat).toBe(0);
    expect(next.outcome?.leftovers.find((l) => l.seat === 1)?.tiles.length).toBe(2);
  });

  it("flags okey finish when the discarded last tile is a wildcard", () => {
    const s = actState({ players: [player(0, [fakeJoker()], true, "melds", 1), player(1, [], true, "melds", 0), player(2, [], true, "melds", 0), player(3, [], true, "melds", 0)] });
    const next = applyMove(s, { kind: "discard", tile: fakeJoker() }, 0);
    expect(next.outcome?.finishType?.okey).toBe(true);
  });

  it("flags elden finish when the player opened on the finishing turn", () => {
    // openedOnTurn === turnSeq (3) means they opened this very turn
    const s = actState({ players: [player(0, [numbered("red", 1)], true, "melds", 3), player(1, [], true, "melds", 0), player(2, [], true, "melds", 0), player(3, [], true, "melds", 0)] });
    const next = applyMove(s, { kind: "discard", tile: numbered("red", 1) }, 0);
    expect(next.outcome?.finishType?.elden).toBe(true);
  });

  it("rejects discarding while a floor tile is still unused", () => {
    const s = actState({ players: [player(0, [numbered("red", 1), numbered("red", 2)], false, null, null)], pendingFloorTile: numbered("red", 2) });
    // pad players to 4
    s.players.push(player(1, [], false, null, null), player(2, [], false, null, null), player(3, [], false, null, null));
    expect(() => applyMove(s, { kind: "discard", tile: numbered("red", 1) }, 0)).toThrow();
  });
});

describe("feeding events", () => {
  it("records a feeding event when an unopened taker opens using the floor tile", () => {
    // seat 0 will take black 7 from seat 3's discard, then open a run using it
    const meldA = [numbered("black", 4), numbered("black", 5), numbered("black", 6)];
    const meldB = [numbered("blue", 10), numbered("blue", 11), numbered("blue", 12), numbered("blue", 13)]; // 46
    const meldC = [numbered("yellow", 10), numbered("yellow", 11), numbered("yellow", 12), numbered("yellow", 13)]; // 46
    const handAfterTake = [...meldA, ...meldB, ...meldC, numbered("black", 7)];
    const s = actState({
      players: [
        player(0, handAfterTake, false, null, null),
        player(1, [], false, null, null), player(2, [], false, null, null), player(3, [], false, null, null),
      ],
      pendingFloorTile: numbered("black", 7),
    });
    // black 4-5-6-7 = 22, blue 10-13 = 46, yellow 10-13 = 46 -> 114 >= 101
    const melds = [[...meldA, numbered("black", 7)], meldB, meldC];
    const next = applyMove(s, { kind: "openMelds", melds }, 0);
    expect(next.feedingEvents.length).toBe(1);
    expect(next.feedingEvents[0]).toMatchObject({ feederSeat: 3, takerSeat: 0, tileValue: 7, takerMode: "melds" });
    expect(next.pendingFloorTile).toBeNull();
  });

  it("records no feeding event when the taker had already opened", () => {
    const meldExtra = [numbered("black", 5), numbered("black", 6), numbered("black", 7)];
    const s = actState({
      players: [
        player(0, [...meldExtra], true, "melds", 0),
        player(1, [], false, null, null), player(2, [], false, null, null), player(3, [], false, null, null),
      ],
      pendingFloorTile: numbered("black", 7),
    });
    const next = applyMove(s, { kind: "openNewMeld", tiles: meldExtra }, 0);
    expect(next.feedingEvents.length).toBe(0);
    expect(next.pendingFloorTile).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `pnpm --filter @masa/server test --run src/games/okey/finish.test.ts`
Expected: Mostly PASS (behavior already implemented). If any assertion fails, fix the relevant handler in `apply.ts`/`outcome.ts`/`opening.ts`/`helpers.ts` and re-run until green.

- [ ] **Step 3: Commit**

```bash
git add server/src/games/okey/finish.test.ts server/src/games/okey/
git commit -m "test(okey): cover finish detection, finishType flags, feeding events"
```

---

## Task 9: Per-player view

**Files:**
- Create: `server/src/games/okey/view.ts`
- Test: `server/src/games/okey/view.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { createHand } from "./setup.js";
import { applyMove } from "./apply.js";
import { toOkeyPlayerView } from "./view.js";

const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 });
const players = ["p0", "p1", "p2", "p3"];

describe("toOkeyPlayerView", () => {
  it("reveals only the viewer's hand; others are counts only", () => {
    const s = createHand(config, players, new SeededRng(1));
    const v = toOkeyPlayerView(s, 0);
    expect(v.yourHand.length).toBe(22);
    expect(v.you).toBe(0);
    const me = v.players.find((p) => p.seat === 0)!;
    expect(me.handCount).toBe(22);
    // The view must not carry any other player's tiles, only counts.
    expect((v.players[1] as unknown as { hand?: unknown }).hand).toBeUndefined();
    expect(v.players[1]!.handCount).toBe(21);
  });

  it("exposes only the draw pile COUNT, never its contents", () => {
    const s = createHand(config, players, new SeededRng(1));
    const v = toOkeyPlayerView(s, 2);
    expect(v.drawPileCount).toBe(20);
    expect((v as unknown as { drawPile?: unknown }).drawPile).toBeUndefined();
    expect(v.yourHand.length).toBe(21);
  });

  it("surfaces each player's last discard and the outcome only when finished", () => {
    let s = createHand(config, players, new SeededRng(1));
    s = applyMove(s, { kind: "drawFromPile" }, 0);
    const tile = s.players[0]!.hand[0]!;
    s = applyMove(s, { kind: "discard", tile }, 0);
    const v = toOkeyPlayerView(s, 1);
    expect(v.players[0]!.lastDiscard).not.toBeNull();
    expect(v.outcome).toBeNull();
    expect(v.turn).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/games/okey/view.test.ts`
Expected: FAIL (Cannot find module './view.js').

- [ ] **Step 3: Write view.ts**

```ts
// server/src/games/okey/view.ts
import type { PlayerId } from "@masa/shared";
import type { OkeyTile, NumberedTile } from "./tile.js";
import type { OkeyGameConfig } from "./game-config.js";
import type { OkeyGameState, TableMeld, HandOutcome, GamePhase, GameStatus } from "./game-state.js";

export interface PublicPlayer {
  seat: number;
  playerId: PlayerId;
  team: 0 | 1 | null;
  opened: boolean;
  openMode: "melds" | "pairs" | null;
  pairCount: number;
  handCount: number;
  lastDiscard: OkeyTile | null;
}

export interface OkeyPlayerView {
  config: OkeyGameConfig;
  indicator: NumberedTile;
  okey: NumberedTile;
  you: number;
  yourHand: OkeyTile[];
  turn: number;
  phase: GamePhase;
  drawPileCount: number;
  players: PublicPlayer[];
  tableMelds: TableMeld[];
  status: GameStatus;
  outcome: HandOutcome | null;
}

export function toOkeyPlayerView(state: OkeyGameState, seat: number): OkeyPlayerView {
  const you = state.players[seat];
  if (!you) throw new RangeError(`invalid seat ${seat}`);
  return {
    config: state.config,
    indicator: state.indicator,
    okey: state.okey,
    you: seat,
    yourHand: you.hand.slice(),
    turn: state.turn,
    phase: state.phase,
    drawPileCount: state.drawPile.length,
    players: state.players.map((p) => {
      const pile = state.discards[p.seat]!;
      return {
        seat: p.seat,
        playerId: p.playerId,
        team: p.team,
        opened: p.opened,
        openMode: p.openMode,
        pairCount: p.pairCount,
        handCount: p.hand.length,
        lastDiscard: pile.length > 0 ? pile[pile.length - 1]! : null,
      };
    }),
    tableMelds: state.tableMelds.map((m) => ({ ...m, tiles: m.tiles.slice() })),
    status: state.status,
    outcome: state.outcome,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @masa/server test --run src/games/okey/view.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/view.ts server/src/games/okey/view.test.ts
git commit -m "feat(okey): add toOkeyPlayerView with hidden-info projection"
```

---

## Task 10: Barrel export + end-to-end integration

**Files:**
- Modify: `server/src/games/okey/index.ts`
- Test: `server/src/games/okey/engine-integration.test.ts`

- [ ] **Step 1: Extend the barrel**

Replace the contents of `server/src/games/okey/index.ts` with:

```ts
export * from "./tile.js";
export * from "./okey.js";
export * from "./deck.js";
export * from "./deal.js";
export * from "./meld.js";
export * from "./pairs.js";
export * from "./points.js";
export * from "./game-config.js";
export * from "./game-state.js";
export * from "./errors.js";
export * from "./move.js";
export * from "./setup.js";
export * from "./opening.js";
export * from "./view.js";
export { applyMove } from "./apply.js";
```

> Note: `helpers.ts` and `outcome.ts` are engine internals; they are intentionally not re-exported.

- [ ] **Step 2: Write the failing integration test**

```ts
import { describe, expect, it } from "vitest";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[]): PlayerHandState {
  return { seat, playerId: `p${seat}`, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null };
}

describe("engine integration", () => {
  it("plays a full opening-to-finish turn without mutating inputs", () => {
    // Seat 0 hand: three melds totalling >=101 plus one extra tile to discard.
    const m1 = [numbered("black", 10), numbered("black", 11), numbered("black", 12), numbered("black", 13)]; // 46
    const m2 = [numbered("blue", 10), numbered("blue", 11), numbered("blue", 12), numbered("blue", 13)]; // 46
    const m3 = [numbered("yellow", 5), numbered("yellow", 6), numbered("yellow", 7)]; // 18
    const extra = numbered("red", 1);
    const hand = [...m1, ...m2, ...m3, extra];

    const s0: OkeyGameState = {
      config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
      indicator: numbered("red", 12), okey,
      players: [player(0, hand), player(1, []), player(2, []), player(3, [])],
      drawPile: [numbered("red", 8)], discards: [[], [], [], []], tableMelds: [],
      turn: 0, turnSeq: 0, phase: "draw", pendingFloorTile: null,
      highestOpenScore: null, highestOpenPairs: null,
      feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
    };
    const snapshot = JSON.stringify(s0);

    let s = applyMove(s0, { kind: "drawFromPile" }, 0); // hand now 14 tiles incl red 8
    s = applyMove(s, { kind: "openMelds", melds: [m1, m2, m3] }, 0); // opens 110
    expect(s.players[0]!.opened).toBe(true);
    // hand now holds extra (red1) + drawn (red8); discard both across... finish needs empty hand.
    // Discard red 8 first (not finishing), then it becomes seat 1's turn — so to finish in one turn,
    // instead process nothing and discard down. Here we simply assert opening worked and discard advances.
    s = applyMove(s, { kind: "discard", tile: numbered("red", 8) }, 0);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe("draw");

    // input never mutated
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it("finishes the hand when the player empties their hand on discard", () => {
    const m1 = [numbered("black", 10), numbered("black", 11), numbered("black", 12), numbered("black", 13)];
    const m2 = [numbered("blue", 10), numbered("blue", 11), numbered("blue", 12), numbered("blue", 13)];
    const m3 = [numbered("yellow", 5), numbered("yellow", 6), numbered("yellow", 7)];
    const last = numbered("red", 1);
    const hand = [...m1, ...m2, ...m3, last];
    const s0: OkeyGameState = {
      config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
      indicator: numbered("red", 12), okey,
      players: [player(0, hand), player(1, []), player(2, []), player(3, [])],
      drawPile: [], discards: [[], [], [], []], tableMelds: [],
      turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
      highestOpenScore: null, highestOpenPairs: null,
      feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
    };
    let s = applyMove(s0, { kind: "openMelds", melds: [m1, m2, m3] }, 0);
    s = applyMove(s, { kind: "discard", tile: last }, 0);
    expect(s.status).toBe("finished");
    expect(s.outcome?.finisherSeat).toBe(0);
    expect(s.outcome?.finishType?.elden).toBe(true); // opened and finished same turn
  });
});
```

- [ ] **Step 3: Run the full suite**

Run: `pnpm --filter @masa/server test --run`
Expected: PASS — all 1a tests plus the new 1b tests.

- [ ] **Step 4: Typecheck, lint, build**

Run: `pnpm typecheck` → no errors.
Run: `pnpm lint` → exit 0.
Run: `pnpm build` → success.

Fix any issue (unused imports, `any`, etc.) before committing.

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/index.ts server/src/games/okey/engine-integration.test.ts
git commit -m "feat(okey): export 1b engine via barrel and add end-to-end tests"
```

---

## Notes for the implementer

- **Purity:** `applyMove` clones via `cloneState` then mutates the clone. Never mutate the
  argument. The immutability tests guard this.
- **Throw-safety:** because the clone is created first and only returned on success, a thrown
  error leaves the input untouched — no manual rollback needed.
- **1a reuse:** all tile-combination checks go through 1a (`isValidMeld`, `isValidRun`,
  `meldsTotal`, `isPair`, `isWildcard`, `tilesEqual`, `isNumbered`). Do not reimplement them.
- **Out of scope (do NOT build):** score/penalty arithmetic, the multi-hand match loop,
  Socket.IO wiring, room-config → `OkeyGameConfig` plumbing, client UI. `HandOutcome` carries
  the raw facts 1c will score.
- **Lint:** the repo forbids `any` and `console`. Keep function signatures and return types explicit.

## Self-review (author)

- **Spec coverage:** config (T1), errors (T2), state+setup (T3), moves/phase/draw/discard/exhaustion (T4),
  openMelds+escalation (T5), openPairs+gösterge+1+void (T6), process+openNewMeld (T7), finish+feeding (T8),
  view (T9), barrel+integration (T10). All spec sections mapped.
- **Type consistency:** `OkeyGameState` fields (incl. `turnSeq`, `meldSeq`, `feedingEvents`) defined in T3
  are used consistently in T4-T9. `Move` kinds match the dispatcher cases. `FinishType` flags match
  `buildFinishOutcome`. `applyMove(state, move, bySeat)` signature stable across all tests.
- **No placeholders:** every step has complete code or an exact command with expected output.
