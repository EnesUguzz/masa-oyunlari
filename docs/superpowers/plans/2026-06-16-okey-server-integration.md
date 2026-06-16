# Okey 101 Sunucu Entegrasyonu (2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire the pure okey engine into the room/socket layer so the server can host a full 4-player okey match over socket events, with per-player views, turn-timeout, and reconnect.

**Architecture:** A Zod wire-contract + an `OkeySession` orchestrator (state + multi-hand scoring) + pure `autoMoves` for timeouts + thin socket handlers, all under `server/src/games/okey/`. Core stays game-agnostic apart from a one-line handler hook and a generic `RoomService.setStatus`.

**Tech Stack:** TypeScript (strict, NodeNext), Vitest, Socket.IO, Zod, existing 1a/1b/1c okey modules + core (rng/clock/connection/room/turn-timer).

**Spec:** `docs/superpowers/specs/2026-06-16-okey-server-integration-design.md`

---

## Conventions (READ FIRST)
- Branded `PlayerId` (`string & {__brand}`): in tests cast `as PlayerId`. **`vitest` does NOT typecheck — run `pnpm typecheck` before every commit; MUST be clean.** Also `pnpm lint` (no `any`, no `console`, explicit return types).
- `noUncheckedIndexedAccess` ON: use `!`/`?? 0` on array access.
- Engine API (all from `server/src/games/okey/`): `createHand(config, players: PlayerId[], rng)`, `applyMove(state, move, bySeat)`, `scoreHand(state)`, `createMatch(config, players)`, `applyHandScore(match, score)`, `makeConfig(input)`, `toOkeyPlayerView(state, seat)`. Types: `OkeyGameConfig`, `Move`, `OkeyGameState`, `OkeyPlayerView`, `HandScore`, `MatchState`, `MatchWinner`.

---

## Task 1: Wire contract (`contract.ts`)

**Files:** Create `server/src/games/okey/contract.ts`, `server/src/games/okey/contract.test.ts`.

- [ ] **Step 1: Failing test** (`contract.test.ts`):
```ts
import { describe, expect, it } from "vitest";
import type { Move } from "./move.js";
import { moveSchema, startGameSchema, okeyMoveSchema, type OkeyMovePayload } from "./contract.js";

// Compile-time: every validated move payload is assignable to the engine Move (security direction).
type Assert<T extends true> = T;
type _safe = Assert<OkeyMovePayload extends Move ? true : false>;
const _check: _safe = true;
void _check;

describe("okey contract", () => {
  it("accepts each valid move kind", () => {
    expect(moveSchema.parse({ kind: "drawFromPile" }).kind).toBe("drawFromPile");
    expect(moveSchema.parse({ kind: "discard", tile: { kind: "fakeJoker" } }).kind).toBe("discard");
    expect(moveSchema.parse({ kind: "openMelds", melds: [[{ kind: "numbered", color: "red", value: 5 }]] }).kind).toBe("openMelds");
  });
  it("rejects malformed moves and tiles", () => {
    expect(() => moveSchema.parse({ kind: "nope" })).toThrow();
    expect(() => moveSchema.parse({ kind: "discard", tile: { kind: "numbered", color: "pink", value: 5 } })).toThrow();
    expect(() => moveSchema.parse({ kind: "discard", tile: { kind: "numbered", color: "red", value: 14 } })).toThrow();
    expect(() => moveSchema.parse({ kind: "drawFromPile", extra: 1 })).toThrow(); // strict
  });
  it("validates startGame config and the move envelope", () => {
    const cfg = startGameSchema.parse({ pairing: "esli", escalation: "katlamali", penalty: "cezali", targetHands: 11 });
    expect(cfg.targetHands).toBe(11);
    expect(() => startGameSchema.parse({ pairing: "x", escalation: "katlamali", penalty: "cezali", targetHands: 11 })).toThrow();
    expect(okeyMoveSchema.parse({ move: { kind: "drawFromPile" } }).move.kind).toBe("drawFromPile");
  });
});
```

- [ ] **Step 2: Run — FAIL** (`pnpm --filter @masa/server test --run src/games/okey/contract.test.ts`).

- [ ] **Step 3: Implement `contract.ts`:**
```ts
import { z } from "zod";
import type { Move } from "./move.js";

export const OkeyClientEvents = { startGame: "okey:startGame", move: "okey:move" } as const;
export const OkeyServerEvents = { state: "okey:state", ended: "okey:ended" } as const;

const colorSchema = z.enum(["red", "yellow", "black", "blue"]);
const tileSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numbered"), color: colorSchema, value: z.number().int().min(1).max(13) }).strict(),
  z.object({ kind: z.literal("fakeJoker") }).strict(),
]);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("drawFromPile") }).strict(),
  z.object({ kind: z.literal("drawFromDiscard") }).strict(),
  z.object({ kind: z.literal("openMelds"), melds: z.array(z.array(tileSchema)) }).strict(),
  z.object({ kind: z.literal("openPairs"), pairs: z.array(z.array(tileSchema)) }).strict(),
  z.object({ kind: z.literal("openNewMeld"), tiles: z.array(tileSchema) }).strict(),
  z.object({ kind: z.literal("processToMeld"), meldId: z.string(), tiles: z.array(tileSchema) }).strict(),
  z.object({ kind: z.literal("discard"), tile: tileSchema }).strict(),
]);

export const startGameSchema = z
  .object({
    pairing: z.enum(["essiz", "esli"]),
    escalation: z.enum(["katlamasiz", "katlamali"]),
    penalty: z.enum(["cezasiz", "cezali"]),
    partnerEscalation: z.enum(["ese-katlamali", "ese-katlamasiz"]).optional(),
    targetHands: z.union([z.literal(7), z.literal(11), z.literal(21)]),
  })
  .strict();

export const okeyMoveSchema = z.object({ move: moveSchema }).strict();

export type OkeyMovePayload = z.infer<typeof moveSchema>;
export type StartGamePayload = z.infer<typeof startGameSchema>;

// Compile-time guard: the validated payload must satisfy the engine Move union.
const _moveGuard = (m: OkeyMovePayload): Move => m;
void _moveGuard;
```

- [ ] **Step 4: Run test (pass), `pnpm typecheck` (clean — the `_moveGuard`/`_safe` checks confirm schema↔Move alignment; if typecheck fails here the schema diverged from Move, fix the schema), `pnpm lint`.**

- [ ] **Step 5: Commit**
```bash
git add server/src/games/okey/contract.ts server/src/games/okey/contract.test.ts
git commit -m "feat(okey): add Zod wire contract for moves and start-game"
```

---

## Task 2: Table view + session orchestrator

**Files:** Create `server/src/games/okey/table-view.ts`, `server/src/games/okey/session.ts`, `server/src/games/okey/session.test.ts`.

- [ ] **Step 1: Failing test** (`session.test.ts`):
```ts
import { describe, expect, it } from "vitest";
import type { Player, PlayerId } from "@masa/shared";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { OkeySession } from "./session.js";

function players(): Player[] {
  return [0, 1, 2, 3].map((i) => ({ id: `p${i}` as PlayerId, nickname: `N${i}` }));
}
const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 7 });

// Drive a hand to deck exhaustion by drawing+discarding each turn.
function playToEnd(session: OkeySession): void {
  let guard = 0;
  while (!session.isOver && guard++ < 4000) {
    const seat = session.currentSeat;
    const before = session.handNo;
    session.apply(seat, { kind: "drawFromPile" });
    if (session.isOver || session.handNo !== before) continue; // hand finished (exhaustion) -> next hand
    const view = session.tableViewFor(seat).view;
    const tile = view.yourHand[view.yourHand.length - 1]!;
    session.apply(seat, { kind: "discard", tile });
  }
}

describe("OkeySession", () => {
  it("initializes hand 1, seat 0 to move, with seat lookup and a per-seat view", () => {
    const s = new OkeySession(config, players(), new SeededRng(1));
    expect(s.handNo).toBe(1);
    expect(s.currentSeat).toBe(0);
    expect(s.isOver).toBe(false);
    expect(s.seatOf("p2" as PlayerId)).toBe(2);
    expect(s.seatOf("zzz" as PlayerId)).toBeNull();
    const tv = s.tableViewFor(0);
    expect(tv.view.you).toBe(0);
    expect(tv.view.yourHand.length).toBe(22);
    expect(tv.handNumber).toBe(1);
    expect(tv.seating.map((x) => x.nickname)).toEqual(["N0", "N1", "N2", "N3"]);
    // privacy: another seat's view must not include seat 0's tiles
    expect(s.tableViewFor(1).view.players[0]!.handCount).toBe(22);
    expect((s.tableViewFor(1).view.players[0] as unknown as { hand?: unknown }).hand).toBeUndefined();
  });

  it("advances to the next hand after a hand finishes (exhaustion)", () => {
    const s = new OkeySession(config, players(), new SeededRng(1));
    const seat = s.currentSeat;
    // exhaust the pile: draw+discard until the hand number changes
    let guard = 0;
    while (s.handNo === 1 && !s.isOver && guard++ < 200) {
      const sd = s.currentSeat;
      const b = s.handNo;
      s.apply(sd, { kind: "drawFromPile" });
      if (s.handNo !== b || s.isOver) break;
      const v = s.tableViewFor(sd).view;
      s.apply(sd, { kind: "discard", tile: v.yourHand[v.yourHand.length - 1]! });
    }
    expect(s.handNo).toBe(2);
    expect(s.isOver).toBe(false);
    expect(s.tableViewFor(0).view.status).toBe("playing");
  });

  it("finishes the match after targetHands and reports standings (all exhaustion -> tie, seat 0 wins)", () => {
    const s = new OkeySession(config, players(), new SeededRng(3));
    playToEnd(s);
    expect(s.isOver).toBe(true);
    const standing = s.tableViewFor(0).match;
    expect(standing.status).toBe("finished");
    expect(standing.handsPlayed).toBe(7);
    expect(standing.winner).toEqual({ kind: "seat", seat: 0 });
    expect(new Set(standing.seatTotals).size).toBe(1); // every seat 202*7
  });

  it("rejects an out-of-turn move without changing state", () => {
    const s = new OkeySession(config, players(), new SeededRng(1));
    expect(() => s.apply(1, { kind: "drawFromPile" })).toThrow();
    expect(s.currentSeat).toBe(0);
  });
});
```

- [ ] **Step 2: Run — FAIL** (Cannot find module './session.js').

- [ ] **Step 3: Implement `table-view.ts`:**
```ts
import type { PlayerId } from "@masa/shared";
import type { OkeyPlayerView } from "./view.js";
import type { MatchWinner } from "./match.js";

export interface MatchStanding {
  seatTotals: number[];
  teamTotals: [number, number] | null;
  handsPlayed: number;
  targetHands: number;
  status: "playing" | "finished";
  winner: MatchWinner;
}

export interface SeatInfo {
  seat: number;
  playerId: PlayerId;
  nickname: string;
}

export interface OkeyTableView {
  view: OkeyPlayerView;
  match: MatchStanding;
  handNumber: number;
  seating: SeatInfo[];
}
```

- [ ] **Step 4: Implement `session.ts`:**
```ts
import type { Player, PlayerId } from "@masa/shared";
import type { Rng } from "../../core/rng.js";
import { InvalidMoveError } from "../../core/errors/index.js";
import type { OkeyGameConfig } from "./game-config.js";
import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";
import { createHand } from "./setup.js";
import { applyMove } from "./apply.js";
import { scoreHand } from "./scoring.js";
import { createMatch, applyHandScore, type MatchState } from "./match.js";
import { toOkeyPlayerView } from "./view.js";
import { autoMoves } from "./auto-move.js";
import type { OkeyTableView, SeatInfo } from "./table-view.js";

/** Per-room live okey game: wraps the pure engine, advances hands, projects views. */
export class OkeySession {
  private hand: OkeyGameState;
  private match: MatchState;
  private handNumber = 1;
  private readonly seats: SeatInfo[];
  private readonly ids: PlayerId[];

  constructor(
    readonly config: OkeyGameConfig,
    seating: readonly Player[],
    private readonly rng: Rng,
  ) {
    if (seating.length !== 4) throw new InvalidMoveError("okey requires exactly 4 players");
    this.seats = seating.map((p, seat) => ({ seat, playerId: p.id, nickname: p.nickname }));
    this.ids = seating.map((p) => p.id);
    this.match = createMatch(config, this.ids);
    this.hand = createHand(config, this.ids, rng);
  }

  get currentSeat(): number {
    return this.hand.turn;
  }
  get isOver(): boolean {
    return this.match.status === "finished";
  }
  get handNo(): number {
    return this.handNumber;
  }

  seatOf(playerId: PlayerId): number | null {
    const found = this.seats.find((s) => s.playerId === playerId);
    return found ? found.seat : null;
  }

  apply(bySeat: number, move: Move): void {
    this.hand = applyMove(this.hand, move, bySeat);
    if (this.hand.status === "finished") {
      this.match = applyHandScore(this.match, scoreHand(this.hand));
      if (this.match.status === "playing") {
        this.handNumber += 1;
        this.hand = createHand(this.config, this.ids, this.rng);
      }
    }
  }

  /** Auto-play safe moves so a stalled/disconnected seat does not block the game. */
  autoPlayTurn(seat: number): void {
    const hn = this.handNumber;
    let guard = 0;
    while (this.handNumber === hn && this.hand.status === "playing" && this.hand.turn === seat && guard++ < 6) {
      const moves = autoMoves(this.hand);
      if (moves.length === 0) break;
      for (const m of moves) {
        this.apply(seat, m);
        if (this.handNumber !== hn || this.hand.turn !== seat) break;
      }
    }
  }

  seatList(): SeatInfo[] {
    return this.seats;
  }

  tableViewFor(seat: number): OkeyTableView {
    return {
      view: toOkeyPlayerView(this.hand, seat),
      match: {
        seatTotals: this.match.seatTotals,
        teamTotals: this.match.teamTotals,
        handsPlayed: this.match.handsPlayed,
        targetHands: this.config.targetHands,
        status: this.match.status,
        winner: this.match.winner,
      },
      handNumber: this.handNumber,
      seating: this.seats,
    };
  }
}
```

> `session.ts` imports `autoMoves` from `./auto-move.js` (Task 3). Implement Task 3 first OR create a temporary stub; the plan order runs Task 3 before this compiles in CI, but since you write the test first here, create `auto-move.ts` (Task 3) before running session typecheck. **Do Task 3's `auto-move.ts` file as part of this step if needed to compile**, then its dedicated test in Task 3.

- [ ] **Step 5: Run session test (4 pass), `pnpm typecheck`, `pnpm lint` — all clean.**

- [ ] **Step 6: Commit**
```bash
git add server/src/games/okey/table-view.ts server/src/games/okey/session.ts server/src/games/okey/session.test.ts
git commit -m "feat(okey): add OkeySession orchestrator and table view"
```

---

## Task 3: Auto-move for turn-timeout

**Files:** Create `server/src/games/okey/auto-move.ts` (if not already created in Task 2), `server/src/games/okey/auto-move.test.ts`.

- [ ] **Step 1: Failing test** (`auto-move.test.ts`):
```ts
import { describe, expect, it } from "vitest";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import type { PlayerId } from "@masa/shared";
import { makeConfig } from "./game-config.js";
import { autoMoves } from "./auto-move.js";

const okey: NumberedTile = numbered("red", 13);
function p(seat: number, hand: OkeyTile[]): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null };
}
function st(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey, drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "draw", pendingFloorTile: null, highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null, ...over,
  };
}

describe("autoMoves", () => {
  it("draws from the pile in the draw phase", () => {
    const s = st({ players: [p(0, [numbered("blue", 4)]), p(1, []), p(2, []), p(3, [])], phase: "draw" });
    expect(autoMoves(s)).toEqual([{ kind: "drawFromPile" }]);
  });
  it("discards the last hand tile in the act phase", () => {
    const tile = numbered("blue", 7);
    const s = st({ players: [p(0, [numbered("blue", 4), tile]), p(1, []), p(2, []), p(3, [])], phase: "act" });
    expect(autoMoves(s)).toEqual([{ kind: "discard", tile }]);
  });
  it("returns nothing in the act phase while a floor tile is pending (cannot safely resolve)", () => {
    const s = st({ players: [p(0, [numbered("blue", 4)]), p(1, []), p(2, []), p(3, [])], phase: "act", pendingFloorTile: numbered("blue", 4) });
    expect(autoMoves(s)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `auto-move.ts`:**
```ts
import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";

/**
 * The safest moves to pass the current seat's turn on timeout. Never produces an
 * illegal move. Draw phase -> draw from the pile. Act phase -> discard the last
 * hand tile. If a floor tile is pending (the seat manually drew from the discard
 * and stalled), returns [] and the turn is left open (the UI prevents this case).
 */
export function autoMoves(hand: OkeyGameState): Move[] {
  if (hand.phase === "draw") return [{ kind: "drawFromPile" }];
  if (hand.pendingFloorTile !== null) return [];
  const me = hand.players[hand.turn]!;
  const tile = me.hand[me.hand.length - 1];
  if (!tile) return [];
  return [{ kind: "discard", tile }];
}
```

- [ ] **Step 4: Run test (3 pass), `pnpm typecheck`, `pnpm lint`.**

- [ ] **Step 5: Commit**
```bash
git add server/src/games/okey/auto-move.ts server/src/games/okey/auto-move.test.ts
git commit -m "feat(okey): add safe auto-move for turn timeout"
```

> If `auto-move.ts` was already created during Task 2 to satisfy compilation, just add the test here and commit both.

---

## Task 4: Socket handlers + session store

**Files:** Create `server/src/games/okey/handlers.ts`, `server/src/games/okey/handlers.test.ts`.

- [ ] **Step 1: Failing test** (`handlers.test.ts`) — uses a fake socket/io + real RoomService/ConnectionManager + FakeClock:
```ts
import { describe, expect, it, vi } from "vitest";
import type { Player, PlayerId } from "@masa/shared";
import { FakeClock } from "../../core/clock.js";
import { SeededRng } from "../../core/rng.js";
import { InMemoryRoomRepository } from "../../core/room/room-repository.js";
import { RoomService } from "../../core/room/room-service.js";
import { ConnectionManager } from "../../core/connection/connection-manager.js";
import { OkeySessionStore, registerOkeyHandlers } from "./handlers.js";
import { OkeyClientEvents, OkeyServerEvents } from "./contract.js";

type Handler = (raw: unknown) => void;

function makeSocket() {
  const handlers = new Map<string, Handler>();
  return {
    on: (ev: string, fn: Handler) => handlers.set(ev, fn),
    fire: (ev: string, raw: unknown) => handlers.get(ev)?.(raw),
  };
}

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as Parameters<typeof registerOkeyHandlers>[3]["logger"];

function setup() {
  const rooms = new RoomService(new InMemoryRoomRepository(), new SeededRng(1), 4);
  const clock = new FakeClock();
  const connections = new ConnectionManager(clock, 30000, () => {});
  const store = new OkeySessionStore();
  const emits: { sid: string; ev: string; payload: unknown }[] = [];
  const io = { to: (sid: string) => ({ emit: (ev: string, payload: unknown) => emits.push({ sid, ev, payload }) }) } as unknown as Parameters<typeof registerOkeyHandlers>[3]["io"];

  const players: Player[] = [0, 1, 2, 3].map((i) => ({ id: `p${i}` as PlayerId, nickname: `N${i}` }));
  const owner = players[0]!;
  const room = rooms.createRoom(owner);
  for (const p of players.slice(1)) rooms.joinRoom(room.code, p);
  for (const p of players) connections.attach(`s_${p.id}`, p.id);

  const deps = { io, rooms, connections, store, rng: new SeededRng(9), clock, turnTimeoutMs: 1000, logger };
  // register handlers for the owner's socket (enough to drive startGame + a move)
  const socket = makeSocket();
  registerOkeyHandlers(socket as unknown as Parameters<typeof registerOkeyHandlers>[0], () => owner, () => room.code, deps);
  return { rooms, room, clock, store, emits, socket, players, deps };
}

describe("okey handlers", () => {
  it("startGame: owner starts, room becomes playing, each seat gets only its own hand", () => {
    const { socket, emits, room, rooms } = setup();
    socket.fire(OkeyClientEvents.startGame, { pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 7 });
    expect(rooms.getRoom(room.code)!.status).toBe("playing");
    const states = emits.filter((e) => e.ev === OkeyServerEvents.state);
    expect(states.length).toBe(4); // one per seat
    // each payload reveals only that seat's own hand
    for (const s of states) {
      const tv = s.payload as { view: { you: number; yourHand: unknown[]; players: { handCount: number }[] } };
      expect(tv.view.yourHand.length).toBe(tv.view.players[tv.view.you]!.handCount);
    }
  });

  it("rejects startGame from a non-owner and when not full", () => {
    const { deps, room } = setup();
    const sock = makeSocket();
    const nonOwner = { id: "p1" as PlayerId, nickname: "N1" };
    const emitsErr: unknown[] = [];
    const io2 = { to: () => ({ emit: (_ev: string, p: unknown) => emitsErr.push(p) }) } as unknown as typeof deps.io;
    registerOkeyHandlers(sock as unknown as Parameters<typeof registerOkeyHandlers>[0], () => nonOwner, () => room.code, { ...deps, io: io2 });
    sock.fire(OkeyClientEvents.startGame, { pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 7 });
    expect(emitsErr.length).toBeGreaterThan(0); // errorEvent emitted
  });

  it("a timeout auto-plays the current seat and re-broadcasts", () => {
    const { socket, emits, clock } = setup();
    socket.fire(OkeyClientEvents.startGame, { pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 7 });
    const before = emits.length;
    clock.advance(1000); // fire the turn timer -> autoPlayTurn -> broadcast
    expect(emits.length).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: Run — FAIL** (Cannot find module './handlers.js').

- [ ] **Step 3: Implement `handlers.ts`:**
```ts
import type { Server, Socket } from "socket.io";
import type { Player } from "@masa/shared";
import { AppError, ValidationError } from "../../core/errors/index.js";
import { ServerEvents } from "@masa/shared";
import type { Rng } from "../../core/rng.js";
import type { Clock } from "../../core/clock.js";
import { TurnTimer } from "../../core/turn/turn-timer.js";
import type { ConnectionManager } from "../../core/connection/connection-manager.js";
import type { RoomService } from "../../core/room/room-service.js";
import type { Logger } from "../../core/logger.js";
import { makeConfig } from "./game-config.js";
import { OkeySession } from "./session.js";
import { OkeyClientEvents, OkeyServerEvents, startGameSchema, okeyMoveSchema } from "./contract.js";

export class OkeySessionStore {
  private sessions = new Map<string, OkeySession>();
  private timers = new Map<string, TurnTimer>();

  get(code: string): OkeySession | undefined {
    return this.sessions.get(code);
  }
  set(code: string, session: OkeySession): void {
    this.sessions.set(code, session);
  }
  timer(code: string, clock: Clock): TurnTimer {
    let t = this.timers.get(code);
    if (!t) {
      t = new TurnTimer(clock);
      this.timers.set(code, t);
    }
    return t;
  }
  end(code: string): void {
    this.timers.get(code)?.clear();
    this.timers.delete(code);
    this.sessions.delete(code);
  }
}

export interface OkeyDeps {
  io: Server;
  rooms: RoomService;
  connections: ConnectionManager;
  store: OkeySessionStore;
  rng: Rng;
  clock: Clock;
  turnTimeoutMs: number;
  logger: Logger;
}

export function registerOkeyHandlers(
  socket: Socket,
  getPlayer: () => Player | undefined,
  getRoomCode: () => string | undefined,
  deps: OkeyDeps,
): void {
  const { io, rooms, connections, store, rng, clock, turnTimeoutMs, logger } = deps;

  const fail = (err: unknown): void => {
    if (err instanceof AppError) {
      socket.emit(ServerEvents.errorEvent, { code: err.code, message: err.message });
    } else {
      logger.error({ err }, "okey handler error");
      socket.emit(ServerEvents.errorEvent, { code: "INTERNAL", message: "Unexpected server error" });
    }
  };

  const broadcast = (code: string, ev: string): void => {
    const session = store.get(code);
    if (!session) return;
    for (const s of session.seatList()) {
      const sid = connections.socketForPlayer(s.playerId);
      if (sid) io.to(sid).emit(ev, session.tableViewFor(s.seat));
    }
  };

  const armTimer = (code: string): void => {
    const session = store.get(code);
    if (!session || session.isOver) return;
    const seat = session.currentSeat;
    store.timer(code, clock).start(turnTimeoutMs, () => {
      try {
        session.autoPlayTurn(seat);
        if (session.isOver) {
          broadcast(code, OkeyServerEvents.ended);
          rooms.setStatus(code, "finished");
          store.end(code);
        } else {
          broadcast(code, OkeyServerEvents.state);
          armTimer(code);
        }
      } catch (err) {
        logger.error({ err }, "okey turn-timeout failed");
      }
    });
  };

  socket.on(OkeyClientEvents.startGame, (raw: unknown) => {
    try {
      const payload = startGameSchema.parse(raw);
      const player = requirePlayer(getPlayer());
      const code = getRoomCode();
      const room = code ? rooms.getRoom(code) : undefined;
      if (!room) throw new ValidationError("Not in a room");
      if (room.ownerId !== player.id) throw new ValidationError("Only the owner can start the game");
      if (room.status !== "waiting") throw new ValidationError("Game already started");
      if (room.players.length !== 4) throw new ValidationError("Need exactly 4 players to start");
      const session = new OkeySession(makeConfig(payload), room.players, rng);
      store.set(room.code, session);
      rooms.setStatus(room.code, "playing");
      broadcast(room.code, OkeyServerEvents.state);
      armTimer(room.code);
    } catch (err) {
      fail(err);
    }
  });

  socket.on(OkeyClientEvents.move, (raw: unknown) => {
    try {
      const { move } = okeyMoveSchema.parse(raw);
      const player = requirePlayer(getPlayer());
      const code = getRoomCode();
      const session = code ? store.get(code) : undefined;
      if (!code || !session) throw new ValidationError("No active game");
      const seat = session.seatOf(player.id);
      if (seat === null) throw new ValidationError("You are not seated in this game");
      session.apply(seat, move);
      store.timer(code, clock).clear();
      if (session.isOver) {
        broadcast(code, OkeyServerEvents.ended);
        rooms.setStatus(code, "finished");
        store.end(code);
      } else {
        broadcast(code, OkeyServerEvents.state);
        armTimer(code);
      }
    } catch (err) {
      fail(err);
    }
  });
}

function requirePlayer(player: Player | undefined): Player {
  if (!player) throw new ValidationError("Not identified");
  return player;
}
```

> This references `rooms.setStatus(...)` — added to `RoomService` in Task 5. To keep Task 4 compiling/testing in isolation, add the `setStatus` method to `RoomService` as the FIRST step of Task 4 (it is shown in Task 5 Step 1); or accept that `handlers.test.ts` needs it and add it now. Add `setStatus` now (code in Task 5 Step 1) so this task is green.

- [ ] **Step 4: Add `RoomService.setStatus`** (also needed by Task 5) — in `server/src/core/room/room-service.ts`, add:
```ts
  setStatus(code: RoomCode, status: RoomStatus): Room | undefined {
    const room = this.repo.get(code);
    if (!room) return undefined;
    room.status = status;
    this.repo.update(room);
    return room;
  }
```
Add `RoomStatus` to the existing `@masa/shared` import in that file.

- [ ] **Step 5: Run handlers test (3 pass), `pnpm typecheck` (clean), `pnpm lint` (clean).**

- [ ] **Step 6: Commit**
```bash
git add server/src/games/okey/handlers.ts server/src/games/okey/handlers.test.ts server/src/core/room/room-service.ts
git commit -m "feat(okey): add socket handlers, session store, and room setStatus"
```

---

## Task 5: Core wiring + reconnect + verification

**Files:** Modify `server/src/socket/register-handlers.ts`, `server/src/index.ts`, `server/src/games/okey/index.ts`.

- [ ] **Step 1: Extend the okey barrel** — append to `server/src/games/okey/index.ts`:
```ts
export * from "./contract.js";
export * from "./table-view.js";
export * from "./session.js";
export * from "./auto-move.js";
export * from "./handlers.js";
```

- [ ] **Step 2: Wire into `register-handlers.ts`** — extend `Deps` and register okey handlers per connection.

In the `Deps` interface add:
```ts
  store: import("../games/okey/handlers.js").OkeySessionStore;
  rng: import("../core/rng.js").Rng;
  clock: import("../core/clock.js").Clock;
  turnTimeoutMs: number;
```
At the top, import:
```ts
import { registerOkeyHandlers } from "../games/okey/handlers.js";
```
Inside `io.on("connection", (socket) => { ... })`, after the `const session: Session = {};` line, add:
```ts
    registerOkeyHandlers(socket, () => session.player, () => session.roomCode, {
      io, rooms, connections, store: deps.store, rng: deps.rng, clock: deps.clock,
      turnTimeoutMs: deps.turnTimeoutMs, logger,
    });
```
And in the `identify` handler's reconnect block, after `sendRoomState(...)`, also re-send okey state if a game is live:
```ts
        const liveSession = deps.store.get(current.code);
        if (liveSession) {
          const seat = liveSession.seatOf(player.id);
          if (seat !== null) {
            const sid = connections.socketForPlayer(player.id);
            if (sid) io.to(sid).emit("okey:state", liveSession.tableViewFor(seat));
          }
        }
```

- [ ] **Step 3: Construct deps in `server/src/index.ts`** — add the store and pass new deps:
```ts
import { OkeySessionStore } from "./games/okey/handlers.js";
```
After `const rooms = new RoomService(...)`:
```ts
const okeyStore = new OkeySessionStore();
```
Change the `registerHandlers({ ... })` call to include:
```ts
registerHandlers({
  io, registry, rooms, connections, logger,
  store: okeyStore, rng, clock, turnTimeoutMs: config.turnTimeoutMs,
});
```

- [ ] **Step 4: Full verification**

Run: `pnpm test` → full suite passes.
Run: `pnpm typecheck` → clean.
Run: `pnpm lint` → exit 0.
Run: `pnpm build` → success (shared → server → client).

Fix any wiring issue (unused imports, type mismatches) before committing.

- [ ] **Step 5: Commit**
```bash
git add server/src/socket/register-handlers.ts server/src/index.ts server/src/games/okey/index.ts
git commit -m "feat(okey): wire okey handlers into core connection flow with reconnect"
```

---

## Notes for the implementer
- **Server authority / privacy:** every broadcast sends `session.tableViewFor(seat)` per seat; never a shared full state. The handlers test asserts this.
- **Purity boundary:** the engine stays pure; `OkeySession` is the only stateful wrapper. `autoMoves` is pure.
- **Out of scope:** client UI (2b), E2E (2c), dealer rotation, ready-gate, smart bots.
- **Core changes are minimal and game-agnostic:** `RoomService.setStatus` + a one-line okey-handler registration + reconnect re-send. No okey rules leak into core.

## Self-review (author)
- **Spec coverage:** contract (T1), session+table-view (T2), auto-move (T3), handlers+store+setStatus (T4), core wiring+reconnect+verify (T5). All spec sections mapped.
- **Type consistency:** `OkeyDeps` shape matches what `register-handlers`/`index.ts` pass; `OkeyTableView` produced by `session.tableViewFor` consumed by broadcast; `moveSchema` aligned to `Move` via the compile-time guard.
- **Ordering caveat noted:** `session.ts` imports `auto-move.ts` (T3) and `handlers.ts` needs `RoomService.setStatus` (T4 Step 4) — both called out inline so each task compiles when executed in order.
- **No placeholders:** complete code or exact commands in every step.
