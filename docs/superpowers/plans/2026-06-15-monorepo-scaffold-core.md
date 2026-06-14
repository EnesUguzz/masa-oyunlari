# Monorepo İskelesi + Çekirdek Dikey Dilim — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pnpm-workspaces monorepo (`shared`/`server`/`client`) with a game-agnostic server core (player/token identity, room/lobby, reconnect grace, turn-timer infra, per-player view) and a React client, proving the architecture end-to-end: nickname → token → create/join room by code → see your own `PlayerView`.

**Architecture:** Three packages joined by pnpm workspaces + TypeScript project references. `shared` holds game-agnostic types and Zod event contracts (types derived via `z.infer`). `server` is layered: thin Socket.IO transport delegates to pure/testable core services. `client` is React+Vite with a typed socket wrapper. All game logic and validation live on the server; the client only renders and sends intent. No game rules in this slice.

**Tech Stack:** pnpm workspaces, TypeScript (strict, project references), Node.js, Socket.IO + socket.io-client, Zod, pino, React, Vite, Vitest, ESLint + Prettier, concurrently.

---

## File Structure

Packages and their responsibilities (locked-in decomposition):

```
/
├── pnpm-workspace.yaml              # workspace package globs
├── package.json                     # root scripts (dev/test/typecheck/lint/build)
├── tsconfig.base.json               # shared strict compiler options
├── .gitignore                       # (exists)
├── .npmrc                           # pnpm settings
│
├── shared/
│   ├── package.json                 # @masa/shared
│   ├── tsconfig.json                # references-enabled, composite
│   └── src/
│       ├── index.ts                 # barrel: re-export types + events
│       ├── types/
│       │   ├── player.ts            # PlayerId, Player
│       │   ├── room.ts              # RoomCode, RoomStatus, Room
│       │   ├── game-state.ts        # GameState<TPublic>
│       │   └── player-view.ts       # PlayerView (lobby slice)
│       └── events/
│           └── contracts.ts         # Zod schemas + inferred types + event names
│
├── server/
│   ├── package.json                 # @masa/server
│   ├── tsconfig.json                # references shared
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts                 # server entry (wires everything)
│       ├── core/
│       │   ├── config.ts            # env -> typed config
│       │   ├── logger.ts            # pino
│       │   ├── rng.ts               # Rng interface + crypto impl + seeded impl
│       │   ├── clock.ts             # Clock interface + real + fake (for timers)
│       │   ├── errors/
│       │   │   └── index.ts         # AppError + subclasses
│       │   ├── player/
│       │   │   └── player-registry.ts
│       │   ├── room/
│       │   │   ├── room-repository.ts        # interface + InMemoryRoomRepository
│       │   │   └── room-service.ts
│       │   ├── connection/
│       │   │   └── connection-manager.ts
│       │   ├── turn/
│       │   │   └── turn-timer.ts
│       │   └── view/
│       │       └── to-player-view.ts
│       ├── socket/
│       │   └── register-handlers.ts # thin Socket.IO handlers -> services
│       └── games/
│           └── .gitkeep             # placeholder; no game yet
│
└── client/
    ├── package.json                 # @masa/client
    ├── tsconfig.json                # references shared
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx                  # screen routing (nickname/lobby/room)
        ├── net/
        │   └── socket.ts            # typed socket-client wrapper
        ├── token.ts                 # localStorage token helpers
        └── core/
            ├── NicknameEntry.tsx
            ├── Lobby.tsx
            └── Room.tsx
```

**Test files** live next to or under each package (`*.test.ts`), run by Vitest.

**Note on TDD for scaffolding:** Pure logic tasks (Tasks 4–10) follow strict test-first TDD. Pure config/scaffolding tasks (Tasks 1–3, and the React UI in Tasks 12–13) have no meaningful unit test; for those the "verify" step is a build/typecheck/run command instead of a failing test. This is called out per task.

---

## Task 1: Monorepo skeleton (workspaces + root config)

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `package.json` (root)
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "shared"
  - "server"
  - "client"
```

- [ ] **Step 2: Create `.npmrc`**

```
# Hoist nothing surprising; keep deps explicit per package.
auto-install-peers=true
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "masa-oyunlari",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"pnpm --filter @masa/server dev\" \"pnpm --filter @masa/client dev\"",
    "build": "pnpm --filter @masa/shared build && pnpm --filter @masa/server build && pnpm --filter @masa/client build",
    "typecheck": "tsc -b shared server client --verbose",
    "test": "pnpm --filter @masa/server test --run",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "typescript": "^5.7.0",
    "eslint": "^9.17.0",
    "@typescript-eslint/eslint-plugin": "^8.20.0",
    "@typescript-eslint/parser": "^8.20.0",
    "prettier": "^3.4.0"
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  }
}
```

- [ ] **Step 5: Verify (no test — scaffolding)**

Run: `pnpm install`
Expected: completes without error (no packages yet defined beyond root devDeps; lockfile created).

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml .npmrc package.json tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: scaffold pnpm workspaces monorepo root"
```

---

## Task 2: `@masa/shared` package skeleton + base types

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types/player.ts`
- Create: `shared/src/types/room.ts`
- Create: `shared/src/types/game-state.ts`
- Create: `shared/src/types/player-view.ts`
- Create: `shared/src/index.ts`

- [ ] **Step 1: Create `shared/package.json`**

```json
{
  "name": "@masa/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -b"
  },
  "dependencies": {
    "zod": "^3.24.0"
  }
}
```

- [ ] **Step 2: Create `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `shared/src/types/player.ts`**

```ts
// Branded id so a raw string can't be passed where a PlayerId is expected.
export type PlayerId = string & { readonly __brand: "PlayerId" };

export interface Player {
  id: PlayerId;
  nickname: string;
}
```

- [ ] **Step 4: Create `shared/src/types/room.ts`**

```ts
import type { Player, PlayerId } from "./player.js";

export type RoomCode = string;

export type RoomStatus = "waiting" | "playing" | "finished";

/** Full server-side room. Never sent to clients as-is; see PlayerView. */
export interface Room {
  code: RoomCode;
  ownerId: PlayerId;
  status: RoomStatus;
  players: Player[];
  capacity: number;
}
```

- [ ] **Step 5: Create `shared/src/types/game-state.ts`**

```ts
/**
 * Generic base for per-game state. TPublic is the shape every player may see.
 * The Okey slice will extend this; here it stays minimal (YAGNI).
 */
export interface GameState<TPublic> {
  public: TPublic;
}
```

- [ ] **Step 6: Create `shared/src/types/player-view.ts`**

```ts
import type { Player, PlayerId } from "./player.js";
import type { RoomCode, RoomStatus } from "./room.js";

/** The lobby slice a single player is allowed to see. No hidden info here yet. */
export interface PlayerView {
  room: {
    code: RoomCode;
    status: RoomStatus;
    capacity: number;
    ownerId: PlayerId;
    players: Player[];
    you: PlayerId;
  };
}
```

- [ ] **Step 7: Create `shared/src/index.ts`**

```ts
export * from "./types/player.js";
export * from "./types/room.js";
export * from "./types/game-state.js";
export * from "./types/player-view.js";
export * from "./events/contracts.js";
```

- [ ] **Step 8: Verify**

Run: `pnpm install`
Expected: `@masa/shared` linked into workspace; zod installed. (Build happens in Task 3 once events exist; `index.ts` imports `./events/contracts.js` which arrives next task, so do NOT build yet.)

- [ ] **Step 9: Commit**

```bash
git add shared/package.json shared/tsconfig.json shared/src/types shared/src/index.ts pnpm-lock.yaml
git commit -m "feat(shared): add package skeleton and game-agnostic base types"
```

---

## Task 3: `@masa/shared` event contracts (Zod) + build green

**Files:**
- Create: `shared/src/events/contracts.ts`

- [ ] **Step 1: Create `shared/src/events/contracts.ts`**

```ts
import { z } from "zod";

/** Client -> Server event names. */
export const ClientEvents = {
  identify: "identify",
  createRoom: "createRoom",
  joinRoom: "joinRoom",
  leaveRoom: "leaveRoom",
} as const;

/** Server -> Client event names. */
export const ServerEvents = {
  identified: "identified",
  roomState: "roomState",
  errorEvent: "errorEvent",
} as const;

// ---- Client -> Server payload schemas ----

export const identifySchema = z.object({
  token: z.string().min(1).optional(),
  nickname: z.string().trim().min(1).max(24),
});
export type IdentifyPayload = z.infer<typeof identifySchema>;

export const createRoomSchema = z.object({});
export type CreateRoomPayload = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({
  code: z.string().trim().min(1).max(12),
});
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;

export const leaveRoomSchema = z.object({});
export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;

// ---- Server -> Client payload schemas (for documentation/shared typing) ----

export const identifiedSchema = z.object({
  playerId: z.string(),
  token: z.string(),
});
export type IdentifiedPayload = z.infer<typeof identifiedSchema>;

export const errorEventSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ErrorEventPayload = z.infer<typeof errorEventSchema>;
```

- [ ] **Step 2: Build shared to verify it compiles**

Run: `pnpm --filter @masa/shared build`
Expected: PASS — `shared/dist/index.js` and `.d.ts` produced, no type errors.

- [ ] **Step 3: Commit**

```bash
git add shared/src/events
git commit -m "feat(shared): add Zod event contracts with inferred types"
```

---

## Task 4: Server package skeleton + custom errors (TDD)

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/src/core/errors/index.ts`
- Test: `server/src/core/errors/errors.test.ts`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "@masa/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -b",
    "test": "vitest"
  },
  "dependencies": {
    "@masa/shared": "workspace:*",
    "socket.io": "^4.8.0",
    "zod": "^3.24.0",
    "pino": "^9.5.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.10.0"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 3: Create `server/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing test** — `server/src/core/errors/errors.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  AppError,
  RoomFullError,
  RoomNotFoundError,
  NotYourTurnError,
  InvalidMoveError,
  ValidationError,
} from "./index.js";

describe("custom errors", () => {
  it("RoomFullError carries a stable code and is an AppError", () => {
    const err = new RoomFullError("ABCD");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("ROOM_FULL");
    expect(err.message).toContain("ABCD");
  });

  it("RoomNotFoundError has code ROOM_NOT_FOUND", () => {
    expect(new RoomNotFoundError("ZZZZ").code).toBe("ROOM_NOT_FOUND");
  });

  it("NotYourTurnError has code NOT_YOUR_TURN", () => {
    expect(new NotYourTurnError().code).toBe("NOT_YOUR_TURN");
  });

  it("InvalidMoveError has code INVALID_MOVE", () => {
    expect(new InvalidMoveError("nope").code).toBe("INVALID_MOVE");
  });

  it("ValidationError has code VALIDATION", () => {
    expect(new ValidationError("bad").code).toBe("VALIDATION");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run`
Expected: FAIL — cannot find module `./index.js` / errors not defined.

- [ ] **Step 6: Write minimal implementation** — `server/src/core/errors/index.ts`

```ts
/** Base for all known, safe-to-surface application errors. */
export abstract class AppError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RoomFullError extends AppError {
  readonly code = "ROOM_FULL";
  constructor(roomCode: string) {
    super(`Room ${roomCode} is full`);
  }
}

export class RoomNotFoundError extends AppError {
  readonly code = "ROOM_NOT_FOUND";
  constructor(roomCode: string) {
    super(`Room ${roomCode} not found`);
  }
}

export class NotYourTurnError extends AppError {
  readonly code = "NOT_YOUR_TURN";
  constructor() {
    super("It is not your turn");
  }
}

export class InvalidMoveError extends AppError {
  readonly code = "INVALID_MOVE";
  constructor(reason: string) {
    super(`Invalid move: ${reason}`);
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION";
  constructor(message: string) {
    super(message);
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run`
Expected: PASS — all 5 error tests green.

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/tsconfig.json server/vitest.config.ts server/src/core/errors pnpm-lock.yaml
git commit -m "feat(server): scaffold package and custom error classes"
```

---

## Task 5: RNG + Clock infrastructure (TDD)

**Files:**
- Create: `server/src/core/rng.ts`
- Create: `server/src/core/clock.ts`
- Test: `server/src/core/rng.test.ts`
- Test: `server/src/core/clock.test.ts`

- [ ] **Step 1: Write failing test** — `server/src/core/rng.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { CryptoRng, SeededRng } from "./rng.js";

describe("Rng", () => {
  it("CryptoRng.nextInt returns values within [0, max)", () => {
    const rng = new CryptoRng();
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it("SeededRng is deterministic for a given seed", () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const seqA = [a.nextInt(1000), a.nextInt(1000), a.nextInt(1000)];
    const seqB = [b.nextInt(1000), b.nextInt(1000), b.nextInt(1000)];
    expect(seqA).toEqual(seqB);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/core/rng.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation** — `server/src/core/rng.ts`

```ts
import { randomInt } from "node:crypto";

/** Injectable randomness so tests can be deterministic. */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

export class CryptoRng implements Rng {
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error("maxExclusive must be > 0");
    return randomInt(maxExclusive);
  }
}

/** Deterministic mulberry32 PRNG for tests. NOT for production secrets. */
export class SeededRng implements Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  private next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error("maxExclusive must be > 0");
    return Math.floor(this.next() * maxExclusive);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/core/rng.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test** — `server/src/core/clock.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { FakeClock } from "./clock.js";

describe("FakeClock", () => {
  it("fires a scheduled callback after advancing past its delay", () => {
    const clock = new FakeClock();
    const fn = vi.fn();
    clock.setTimeout(fn, 1000);
    clock.advance(999);
    expect(fn).not.toHaveBeenCalled();
    clock.advance(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clearTimeout prevents the callback from firing", () => {
    const clock = new FakeClock();
    const fn = vi.fn();
    const handle = clock.setTimeout(fn, 500);
    clock.clearTimeout(handle);
    clock.advance(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/core/clock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write implementation** — `server/src/core/clock.ts`

```ts
export type TimerHandle = number;

/** Injectable timer source so reconnect/turn-timeout logic is testable. */
export interface Clock {
  setTimeout(fn: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export class RealClock implements Clock {
  setTimeout(fn: () => void, delayMs: number): TimerHandle {
    return setTimeout(fn, delayMs) as unknown as TimerHandle;
  }
  clearTimeout(handle: TimerHandle): void {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  }
}

/** Deterministic clock: timers fire only when advance() crosses their deadline. */
export class FakeClock implements Clock {
  private now = 0;
  private nextHandle = 1;
  private timers = new Map<TimerHandle, { fireAt: number; fn: () => void }>();

  setTimeout(fn: () => void, delayMs: number): TimerHandle {
    const handle = this.nextHandle++;
    this.timers.set(handle, { fireAt: this.now + delayMs, fn });
    return handle;
  }

  clearTimeout(handle: TimerHandle): void {
    this.timers.delete(handle);
  }

  advance(ms: number): void {
    this.now += ms;
    for (const [handle, timer] of [...this.timers.entries()]) {
      if (timer.fireAt <= this.now) {
        this.timers.delete(handle);
        timer.fn();
      }
    }
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/core/clock.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/core/rng.ts server/src/core/rng.test.ts server/src/core/clock.ts server/src/core/clock.test.ts
git commit -m "feat(server): add injectable RNG and Clock with deterministic test impls"
```

---

## Task 6: Config + logger (TDD for config)

**Files:**
- Create: `server/src/core/config.ts`
- Create: `server/src/core/logger.ts`
- Test: `server/src/core/config.test.ts`

- [ ] **Step 1: Write failing test** — `server/src/core/config.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses defaults when env vars are absent", () => {
    const cfg = loadConfig({});
    expect(cfg.port).toBe(3001);
    expect(cfg.gracePeriodMs).toBe(30000);
    expect(cfg.turnTimeoutMs).toBe(60000);
    expect(cfg.clientOrigin).toBe("http://localhost:5173");
  });

  it("reads overrides from the provided env object", () => {
    const cfg = loadConfig({
      PORT: "4000",
      GRACE_PERIOD_MS: "5000",
      TURN_TIMEOUT_MS: "10000",
      CLIENT_ORIGIN: "https://example.com",
    });
    expect(cfg.port).toBe(4000);
    expect(cfg.gracePeriodMs).toBe(5000);
    expect(cfg.turnTimeoutMs).toBe(10000);
    expect(cfg.clientOrigin).toBe("https://example.com");
  });

  it("throws on a non-numeric PORT", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/core/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation** — `server/src/core/config.ts`

```ts
export interface AppConfig {
  port: number;
  gracePeriodMs: number;
  turnTimeoutMs: number;
  clientOrigin: string;
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a numeric value but got "${value}"`);
  }
  return parsed;
}

/** Pure: reads from a provided env map so it is trivially testable. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  return {
    port: num(env.PORT, 3001),
    gracePeriodMs: num(env.GRACE_PERIOD_MS, 30000),
    turnTimeoutMs: num(env.TURN_TIMEOUT_MS, 60000),
    clientOrigin: env.CLIENT_ORIGIN ?? "http://localhost:5173",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/core/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Write implementation** — `server/src/core/logger.ts` (no unit test; trivial wrapper)

```ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

export type Logger = typeof logger;
```

- [ ] **Step 6: Commit**

```bash
git add server/src/core/config.ts server/src/core/config.test.ts server/src/core/logger.ts
git commit -m "feat(server): add env-driven config and pino logger"
```

---

## Task 7: PlayerRegistry (token identity) (TDD)

**Files:**
- Create: `server/src/core/player/player-registry.ts`
- Test: `server/src/core/player/player-registry.test.ts`

- [ ] **Step 1: Write failing test** — `server/src/core/player/player-registry.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { PlayerRegistry } from "./player-registry.js";
import { SeededRng } from "../rng.js";

describe("PlayerRegistry", () => {
  it("creates a new player with a token when no token is provided", () => {
    const reg = new PlayerRegistry(new SeededRng(1));
    const { player, token } = reg.identify({ nickname: "Ada" });
    expect(player.nickname).toBe("Ada");
    expect(player.id).toBeTruthy();
    expect(token).toBeTruthy();
  });

  it("resolves the same player when the same token is presented again", () => {
    const reg = new PlayerRegistry(new SeededRng(1));
    const first = reg.identify({ nickname: "Ada" });
    const second = reg.identify({ token: first.token, nickname: "Ada (renamed)" });
    expect(second.player.id).toBe(first.player.id);
    expect(second.token).toBe(first.token);
    // nickname updates on re-identify
    expect(second.player.nickname).toBe("Ada (renamed)");
  });

  it("creates a fresh player when an unknown token is presented", () => {
    const reg = new PlayerRegistry(new SeededRng(1));
    const known = reg.identify({ nickname: "Ada" });
    const result = reg.identify({ token: "not-a-real-token", nickname: "Grace" });
    expect(result.player.id).not.toBe(known.player.id);
  });

  it("generates distinct ids/tokens for distinct players", () => {
    const reg = new PlayerRegistry(new SeededRng(7));
    const a = reg.identify({ nickname: "A" });
    const b = reg.identify({ nickname: "B" });
    expect(a.player.id).not.toBe(b.player.id);
    expect(a.token).not.toBe(b.token);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/core/player/player-registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation** — `server/src/core/player/player-registry.ts`

```ts
import type { Player, PlayerId } from "@masa/shared";
import type { Rng } from "../rng.js";

export interface IdentifyInput {
  token?: string;
  nickname: string;
}

export interface IdentifyResult {
  player: Player;
  token: string;
}

/** Maps persistent tokens to player identities. socket.id is never the identity. */
export class PlayerRegistry {
  private byToken = new Map<string, Player>();

  constructor(private readonly rng: Rng) {}

  identify(input: IdentifyInput): IdentifyResult {
    if (input.token) {
      const existing = this.byToken.get(input.token);
      if (existing) {
        existing.nickname = input.nickname;
        return { player: existing, token: input.token };
      }
    }
    const token = this.generateId("tok");
    const player: Player = {
      id: this.generateId("ply") as PlayerId,
      nickname: input.nickname,
    };
    this.byToken.set(token, player);
    return { player, token };
  }

  private generateId(prefix: string): string {
    // 12 random alphanumeric-ish chars from injected RNG.
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 12; i++) {
      s += alphabet[this.rng.nextInt(alphabet.length)];
    }
    return `${prefix}_${s}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/core/player/player-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/core/player
git commit -m "feat(server): add PlayerRegistry token identity"
```

---

## Task 8: RoomRepository + RoomService (TDD)

**Files:**
- Create: `server/src/core/room/room-repository.ts`
- Create: `server/src/core/room/room-service.ts`
- Test: `server/src/core/room/room-service.test.ts`

- [ ] **Step 1: Write failing test** — `server/src/core/room/room-service.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { InMemoryRoomRepository } from "./room-repository.js";
import { RoomService } from "./room-service.js";
import { SeededRng } from "../rng.js";
import { RoomFullError, RoomNotFoundError } from "../errors/index.js";
import type { Player, PlayerId } from "@masa/shared";

function player(id: string, nickname: string): Player {
  return { id: id as PlayerId, nickname };
}

function makeService(capacity = 4) {
  const repo = new InMemoryRoomRepository();
  const service = new RoomService(repo, new SeededRng(1), capacity);
  return { repo, service };
}

describe("RoomService", () => {
  it("creates a room owned by the creator who is seated", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    expect(room.code).toBeTruthy();
    expect(room.ownerId).toBe("p1");
    expect(room.status).toBe("waiting");
    expect(room.players.map((p) => p.id)).toEqual(["p1"]);
  });

  it("lets a second player join by code", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    const joined = service.joinRoom(room.code, player("p2", "Grace"));
    expect(joined.players.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("throws RoomNotFoundError for an unknown code", () => {
    const { service } = makeService();
    expect(() => service.joinRoom("NOPE", player("p2", "Grace"))).toThrow(
      RoomNotFoundError,
    );
  });

  it("throws RoomFullError when capacity is exceeded", () => {
    const { service } = makeService(2);
    const room = service.createRoom(player("p1", "Ada"));
    service.joinRoom(room.code, player("p2", "Grace"));
    expect(() => service.joinRoom(room.code, player("p3", "Lin"))).toThrow(
      RoomFullError,
    );
  });

  it("is idempotent if the same player joins twice", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    service.joinRoom(room.code, player("p2", "Grace"));
    const again = service.joinRoom(room.code, player("p2", "Grace"));
    expect(again.players.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("removes a player on leave and deletes the room when empty", () => {
    const { service, repo } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    service.leaveRoom(room.code, "p1" as PlayerId);
    expect(repo.get(room.code)).toBeUndefined();
  });

  it("reassigns ownership when the owner leaves a non-empty room", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    service.joinRoom(room.code, player("p2", "Grace"));
    const after = service.leaveRoom(room.code, "p1" as PlayerId);
    expect(after?.ownerId).toBe("p2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/core/room/room-service.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write implementation** — `server/src/core/room/room-repository.ts`

```ts
import type { Room, RoomCode } from "@masa/shared";

/** Storage seam for rooms. In-memory now; Redis later behind the same interface. */
export interface RoomRepository {
  create(room: Room): void;
  get(code: RoomCode): Room | undefined;
  update(room: Room): void;
  delete(code: RoomCode): void;
  has(code: RoomCode): boolean;
}

export class InMemoryRoomRepository implements RoomRepository {
  private rooms = new Map<RoomCode, Room>();

  create(room: Room): void {
    this.rooms.set(room.code, room);
  }
  get(code: RoomCode): Room | undefined {
    return this.rooms.get(code);
  }
  update(room: Room): void {
    this.rooms.set(room.code, room);
  }
  delete(code: RoomCode): void {
    this.rooms.delete(code);
  }
  has(code: RoomCode): boolean {
    return this.rooms.has(code);
  }
}
```

- [ ] **Step 4: Write implementation** — `server/src/core/room/room-service.ts`

```ts
import type { Player, PlayerId, Room, RoomCode } from "@masa/shared";
import type { Rng } from "../rng.js";
import type { RoomRepository } from "./room-repository.js";
import { RoomFullError, RoomNotFoundError } from "../errors/index.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
const CODE_LENGTH = 4;

export class RoomService {
  constructor(
    private readonly repo: RoomRepository,
    private readonly rng: Rng,
    private readonly capacity: number,
  ) {}

  createRoom(owner: Player): Room {
    const code = this.generateUniqueCode();
    const room: Room = {
      code,
      ownerId: owner.id,
      status: "waiting",
      players: [owner],
      capacity: this.capacity,
    };
    this.repo.create(room);
    return room;
  }

  joinRoom(code: RoomCode, player: Player): Room {
    const room = this.repo.get(code);
    if (!room) throw new RoomNotFoundError(code);
    if (room.players.some((p) => p.id === player.id)) return room; // idempotent
    if (room.players.length >= room.capacity) throw new RoomFullError(code);
    room.players.push(player);
    this.repo.update(room);
    return room;
  }

  /** Returns the updated room, or undefined if the room no longer exists. */
  leaveRoom(code: RoomCode, playerId: PlayerId): Room | undefined {
    const room = this.repo.get(code);
    if (!room) return undefined;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      this.repo.delete(code);
      return undefined;
    }
    if (room.ownerId === playerId) {
      room.ownerId = room.players[0]!.id;
    }
    this.repo.update(room);
    return room;
  }

  private generateUniqueCode(): RoomCode {
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[this.rng.nextInt(CODE_ALPHABET.length)];
      }
      if (!this.repo.has(code)) return code;
    }
    throw new Error("Could not generate a unique room code");
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/core/room/room-service.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add server/src/core/room
git commit -m "feat(server): add RoomRepository and RoomService with create/join/leave"
```

---

## Task 9: toPlayerView (per-player slice) (TDD)

**Files:**
- Create: `server/src/core/view/to-player-view.ts`
- Test: `server/src/core/view/to-player-view.test.ts`

- [ ] **Step 1: Write failing test** — `server/src/core/view/to-player-view.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { toPlayerView } from "./to-player-view.js";
import type { Player, PlayerId, Room } from "@masa/shared";

function player(id: string, nickname: string): Player {
  return { id: id as PlayerId, nickname };
}

const room: Room = {
  code: "ABCD",
  ownerId: "p1" as PlayerId,
  status: "waiting",
  players: [player("p1", "Ada"), player("p2", "Grace")],
  capacity: 4,
};

describe("toPlayerView", () => {
  it("produces a view scoped to the requesting player", () => {
    const view = toPlayerView(room, "p2" as PlayerId);
    expect(view.room.code).toBe("ABCD");
    expect(view.room.you).toBe("p2");
    expect(view.room.ownerId).toBe("p1");
    expect(view.room.players.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(view.room.status).toBe("waiting");
    expect(view.room.capacity).toBe(4);
  });

  it("returns a fresh players array, not the room's own reference", () => {
    const view = toPlayerView(room, "p1" as PlayerId);
    expect(view.room.players).not.toBe(room.players);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/core/view/to-player-view.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation** — `server/src/core/view/to-player-view.ts`

```ts
import type { PlayerId, PlayerView, Room } from "@masa/shared";

/**
 * Pure projection of full server state into the slice a single player may see.
 * In this lobby slice there is no hidden info, but the boundary is established
 * here: callers must send toPlayerView(room, id) per player, never the raw Room.
 */
export function toPlayerView(room: Room, you: PlayerId): PlayerView {
  return {
    room: {
      code: room.code,
      status: room.status,
      capacity: room.capacity,
      ownerId: room.ownerId,
      players: room.players.map((p) => ({ id: p.id, nickname: p.nickname })),
      you,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/core/view/to-player-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/core/view
git commit -m "feat(server): add pure toPlayerView per-player projection"
```

---

## Task 10: ConnectionManager (reconnect grace) + TurnTimer (TDD)

**Files:**
- Create: `server/src/core/connection/connection-manager.ts`
- Create: `server/src/core/turn/turn-timer.ts`
- Test: `server/src/core/connection/connection-manager.test.ts`
- Test: `server/src/core/turn/turn-timer.test.ts`

- [ ] **Step 1: Write failing test** — `server/src/core/connection/connection-manager.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { ConnectionManager } from "./connection-manager.js";
import { FakeClock } from "../clock.js";
import type { PlayerId } from "@masa/shared";

describe("ConnectionManager", () => {
  it("maps a socket to a player and resolves it back", () => {
    const cm = new ConnectionManager(new FakeClock(), 30000, vi.fn());
    cm.attach("sock1", "p1" as PlayerId);
    expect(cm.playerForSocket("sock1")).toBe("p1");
  });

  it("does NOT drop a player who reconnects within the grace period", () => {
    const onExpire = vi.fn();
    const clock = new FakeClock();
    const cm = new ConnectionManager(clock, 30000, onExpire);
    cm.attach("sock1", "p1" as PlayerId);

    cm.handleDisconnect("sock1");
    clock.advance(29999);
    // reconnect with a new socket id under the same player
    cm.attach("sock2", "p1" as PlayerId);
    clock.advance(10000);

    expect(onExpire).not.toHaveBeenCalled();
    expect(cm.playerForSocket("sock2")).toBe("p1");
  });

  it("calls onExpire with the player when the grace period elapses", () => {
    const onExpire = vi.fn();
    const clock = new FakeClock();
    const cm = new ConnectionManager(clock, 30000, onExpire);
    cm.attach("sock1", "p1" as PlayerId);

    cm.handleDisconnect("sock1");
    clock.advance(30000);

    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onExpire).toHaveBeenCalledWith("p1");
  });

  it("treats a player as connected on any active socket", () => {
    const cm = new ConnectionManager(new FakeClock(), 30000, vi.fn());
    cm.attach("sock1", "p1" as PlayerId);
    expect(cm.isConnected("p1" as PlayerId)).toBe(true);
    cm.handleDisconnect("sock1");
    expect(cm.isConnected("p1" as PlayerId)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/core/connection/connection-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation** — `server/src/core/connection/connection-manager.ts`

```ts
import type { PlayerId } from "@masa/shared";
import type { Clock, TimerHandle } from "../clock.js";

/**
 * Tracks socket.id <-> playerId and holds a player's seat for a grace period
 * after disconnect so a reconnect with the same token can reclaim it.
 */
export class ConnectionManager {
  private socketToPlayer = new Map<string, PlayerId>();
  private playerToSocket = new Map<PlayerId, string>();
  private graceTimers = new Map<PlayerId, TimerHandle>();

  constructor(
    private readonly clock: Clock,
    private readonly gracePeriodMs: number,
    private readonly onExpire: (playerId: PlayerId) => void,
  ) {}

  attach(socketId: string, playerId: PlayerId): void {
    // Reconnect within grace cancels the pending expiry.
    const pending = this.graceTimers.get(playerId);
    if (pending !== undefined) {
      this.clock.clearTimeout(pending);
      this.graceTimers.delete(playerId);
    }
    const previousSocket = this.playerToSocket.get(playerId);
    if (previousSocket) this.socketToPlayer.delete(previousSocket);

    this.socketToPlayer.set(socketId, playerId);
    this.playerToSocket.set(playerId, socketId);
  }

  handleDisconnect(socketId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;
    this.socketToPlayer.delete(socketId);
    // Only start grace if this socket was the player's current one.
    if (this.playerToSocket.get(playerId) === socketId) {
      this.playerToSocket.delete(playerId);
      const handle = this.clock.setTimeout(() => {
        this.graceTimers.delete(playerId);
        this.onExpire(playerId);
      }, this.gracePeriodMs);
      this.graceTimers.set(playerId, handle);
    }
  }

  playerForSocket(socketId: string): PlayerId | undefined {
    return this.socketToPlayer.get(socketId);
  }

  isConnected(playerId: PlayerId): boolean {
    return this.playerToSocket.has(playerId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/core/connection/connection-manager.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Write failing test** — `server/src/core/turn/turn-timer.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { TurnTimer } from "./turn-timer.js";
import { FakeClock } from "../clock.js";

describe("TurnTimer", () => {
  it("fires the timeout callback after the configured duration", () => {
    const clock = new FakeClock();
    const onTimeout = vi.fn();
    const timer = new TurnTimer(clock);
    timer.start(5000, onTimeout);
    clock.advance(4999);
    expect(onTimeout).not.toHaveBeenCalled();
    clock.advance(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("clear() cancels a pending timeout", () => {
    const clock = new FakeClock();
    const onTimeout = vi.fn();
    const timer = new TurnTimer(clock);
    timer.start(5000, onTimeout);
    timer.clear();
    clock.advance(10000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("starting again replaces the previous timeout", () => {
    const clock = new FakeClock();
    const first = vi.fn();
    const second = vi.fn();
    const timer = new TurnTimer(clock);
    timer.start(5000, first);
    timer.start(5000, second);
    clock.advance(5000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @masa/server test --run src/core/turn/turn-timer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write implementation** — `server/src/core/turn/turn-timer.ts`

```ts
import type { Clock, TimerHandle } from "../clock.js";

/**
 * Game-agnostic turn timeout. A game supplies the duration and what to do when
 * time runs out; core just counts. Not wired to any game in this slice.
 */
export class TurnTimer {
  private handle: TimerHandle | undefined;

  constructor(private readonly clock: Clock) {}

  start(durationMs: number, onTimeout: () => void): void {
    this.clear();
    this.handle = this.clock.setTimeout(() => {
      this.handle = undefined;
      onTimeout();
    }, durationMs);
  }

  clear(): void {
    if (this.handle !== undefined) {
      this.clock.clearTimeout(this.handle);
      this.handle = undefined;
    }
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @masa/server test --run src/core/turn/turn-timer.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/core/connection server/src/core/turn
git commit -m "feat(server): add ConnectionManager reconnect grace and TurnTimer"
```

---

## Task 11: Socket handlers + server entry (wiring)

**Files:**
- Create: `server/src/socket/register-handlers.ts`
- Create: `server/src/index.ts`
- Create: `server/src/games/.gitkeep`

This task wires the tested services to Socket.IO. There is no unit test (it is I/O glue); the verify step is a typecheck + manual boot. The end-to-end behavior is verified in Task 14.

- [ ] **Step 1: Create `server/src/games/.gitkeep`** (empty file, placeholder for future games)

```
```

- [ ] **Step 2: Create `server/src/socket/register-handlers.ts`**

```ts
import type { Server, Socket } from "socket.io";
import {
  ClientEvents,
  ServerEvents,
  identifySchema,
  createRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
} from "@masa/shared";
import type { PlayerId, Player } from "@masa/shared";
import { PlayerRegistry } from "../core/player/player-registry.js";
import { RoomService } from "../core/room/room-service.js";
import { ConnectionManager } from "../core/connection/connection-manager.js";
import { toPlayerView } from "../core/view/to-player-view.js";
import { AppError, ValidationError } from "../core/errors/index.js";
import type { Logger } from "../core/logger.js";

interface Deps {
  io: Server;
  registry: PlayerRegistry;
  rooms: RoomService;
  connections: ConnectionManager;
  logger: Logger;
}

export function registerHandlers(deps: Deps): void {
  const { io, registry, rooms, connections, logger } = deps;

  // Per-socket session state.
  interface Session {
    player?: Player;
    roomCode?: string;
  }

  io.on("connection", (socket: Socket) => {
    const session: Session = {};

    const fail = (err: unknown) => {
      if (err instanceof AppError) {
        socket.emit(ServerEvents.errorEvent, { code: err.code, message: err.message });
      } else {
        logger.error({ err }, "unexpected handler error");
        socket.emit(ServerEvents.errorEvent, {
          code: "INTERNAL",
          message: "Unexpected server error",
        });
      }
    };

    const broadcastRoom = (code: string) => {
      const room = rooms["repo"] ? undefined : undefined; // placeholder to avoid private access
      // Re-fetch through a public path: join/leave/create return the room, so callers pass it.
      void room;
    };

    // Send each member their own PlayerView.
    const emitRoomToAll = (roomPlayers: Player[], roomCode: string) => {
      const room = getRoomOrThrow(roomCode);
      for (const member of roomPlayers) {
        const targetSocketId = connections["playerToSocket"]?.get?.(member.id);
        void targetSocketId;
      }
      void room;
    };
    void broadcastRoom;
    void emitRoomToAll;

    function getRoomOrThrow(code: string) {
      const room = rooms.getRoom(code);
      if (!room) throw new ValidationError("Room no longer exists");
      return room;
    }

    socket.on(ClientEvents.identify, (raw: unknown) => {
      try {
        const payload = identifySchema.parse(raw);
        const { player, token } = registry.identify(payload);
        session.player = player;
        connections.attach(socket.id, player.id);
        socket.emit(ServerEvents.identified, { playerId: player.id, token });
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.createRoom, (raw: unknown) => {
      try {
        createRoomSchema.parse(raw);
        const player = requirePlayer(session);
        const room = rooms.createRoom(player);
        session.roomCode = room.code;
        sendRoomState(io, connections, room.code, rooms);
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.joinRoom, (raw: unknown) => {
      try {
        const { code } = joinRoomSchema.parse(raw);
        const player = requirePlayer(session);
        const room = rooms.joinRoom(code, player);
        session.roomCode = room.code;
        sendRoomState(io, connections, room.code, rooms);
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.leaveRoom, (raw: unknown) => {
      try {
        leaveRoomSchema.parse(raw);
        const player = requirePlayer(session);
        if (session.roomCode) {
          const code = session.roomCode;
          rooms.leaveRoom(code, player.id);
          session.roomCode = undefined;
          sendRoomState(io, connections, code, rooms);
        }
      } catch (err) {
        fail(err);
      }
    });

    socket.on("disconnect", () => {
      connections.handleDisconnect(socket.id);
    });
  });
}

function requirePlayer(session: { player?: Player }): Player {
  if (!session.player) throw new ValidationError("Not identified");
  return session.player;
}

/** Emit each current member their own PlayerView; if the room is gone, nothing to send. */
function sendRoomState(
  io: Server,
  connections: ConnectionManager,
  code: string,
  rooms: RoomService,
): void {
  const room = rooms.getRoom(code);
  if (!room) return;
  for (const member of room.players) {
    const socketId = connections.socketForPlayer(member.id);
    if (!socketId) continue;
    io.to(socketId).emit(ServerEvents.roomState, toPlayerView(room, member.id));
  }
}
```

- [ ] **Step 3: Add the two public accessors the handlers need.** The handler above uses `rooms.getRoom(code)` and `connections.socketForPlayer(id)`, which don't exist yet. Add them.

In `server/src/core/room/room-service.ts`, add inside the `RoomService` class (after `leaveRoom`):

```ts
  getRoom(code: RoomCode): Room | undefined {
    return this.repo.get(code);
  }
```

In `server/src/core/connection/connection-manager.ts`, add inside the `ConnectionManager` class (after `isConnected`):

```ts
  socketForPlayer(playerId: PlayerId): string | undefined {
    return this.playerToSocket.get(playerId);
  }
```

- [ ] **Step 4: Replace the placeholder cruft in `register-handlers.ts`.** Remove the unused `broadcastRoom`, `emitRoomToAll`, `getRoomOrThrow`, and the `void` lines added as scaffolding in Step 2 — they reference private members and exist only to illustrate the wrong path. The final `registerHandlers` keeps only: the `connection` listener, `fail`, the four `socket.on` event handlers, the `disconnect` handler, plus module-level `requirePlayer` and `sendRoomState`. Final file:

```ts
import type { Server, Socket } from "socket.io";
import {
  ClientEvents,
  ServerEvents,
  identifySchema,
  createRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
} from "@masa/shared";
import type { Player } from "@masa/shared";
import { PlayerRegistry } from "../core/player/player-registry.js";
import { RoomService } from "../core/room/room-service.js";
import { ConnectionManager } from "../core/connection/connection-manager.js";
import { toPlayerView } from "../core/view/to-player-view.js";
import { AppError, ValidationError } from "../core/errors/index.js";
import type { Logger } from "../core/logger.js";

interface Deps {
  io: Server;
  registry: PlayerRegistry;
  rooms: RoomService;
  connections: ConnectionManager;
  logger: Logger;
}

interface Session {
  player?: Player;
  roomCode?: string;
}

export function registerHandlers(deps: Deps): void {
  const { io, registry, rooms, connections, logger } = deps;

  io.on("connection", (socket: Socket) => {
    const session: Session = {};

    const fail = (err: unknown) => {
      if (err instanceof AppError) {
        socket.emit(ServerEvents.errorEvent, { code: err.code, message: err.message });
      } else {
        logger.error({ err }, "unexpected handler error");
        socket.emit(ServerEvents.errorEvent, {
          code: "INTERNAL",
          message: "Unexpected server error",
        });
      }
    };

    socket.on(ClientEvents.identify, (raw: unknown) => {
      try {
        const payload = identifySchema.parse(raw);
        const { player, token } = registry.identify(payload);
        session.player = player;
        connections.attach(socket.id, player.id);
        socket.emit(ServerEvents.identified, { playerId: player.id, token });
        // If reconnecting into a room they already belong to, re-send state.
        if (session.roomCode) sendRoomState(io, connections, session.roomCode, rooms);
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.createRoom, (raw: unknown) => {
      try {
        createRoomSchema.parse(raw);
        const player = requirePlayer(session);
        const room = rooms.createRoom(player);
        session.roomCode = room.code;
        sendRoomState(io, connections, room.code, rooms);
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.joinRoom, (raw: unknown) => {
      try {
        const { code } = joinRoomSchema.parse(raw);
        const player = requirePlayer(session);
        const room = rooms.joinRoom(code, player);
        session.roomCode = room.code;
        sendRoomState(io, connections, room.code, rooms);
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.leaveRoom, (raw: unknown) => {
      try {
        leaveRoomSchema.parse(raw);
        const player = requirePlayer(session);
        if (session.roomCode) {
          const code = session.roomCode;
          rooms.leaveRoom(code, player.id);
          session.roomCode = undefined;
          sendRoomState(io, connections, code, rooms);
        }
      } catch (err) {
        fail(err);
      }
    });

    socket.on("disconnect", () => {
      connections.handleDisconnect(socket.id);
    });
  });
}

function requirePlayer(session: Session): Player {
  if (!session.player) throw new ValidationError("Not identified");
  return session.player;
}

function sendRoomState(
  io: Server,
  connections: ConnectionManager,
  code: string,
  rooms: RoomService,
): void {
  const room = rooms.getRoom(code);
  if (!room) return;
  for (const member of room.players) {
    const socketId = connections.socketForPlayer(member.id);
    if (!socketId) continue;
    io.to(socketId).emit(ServerEvents.roomState, toPlayerView(room, member.id));
  }
}
```

- [ ] **Step 5: Create `server/src/index.ts`**

```ts
import { createServer } from "node:http";
import { Server } from "socket.io";
import { loadConfig } from "./core/config.js";
import { logger } from "./core/logger.js";
import { CryptoRng } from "./core/rng.js";
import { RealClock } from "./core/clock.js";
import { PlayerRegistry } from "./core/player/player-registry.js";
import { InMemoryRoomRepository } from "./core/room/room-repository.js";
import { RoomService } from "./core/room/room-service.js";
import { ConnectionManager } from "./core/connection/connection-manager.js";
import { registerHandlers } from "./socket/register-handlers.js";
import type { PlayerId } from "@masa/shared";

const config = loadConfig(process.env);
const rng = new CryptoRng();
const clock = new RealClock();

const registry = new PlayerRegistry(rng);
const roomRepo = new InMemoryRoomRepository();
const rooms = new RoomService(roomRepo, rng, 4);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigin },
});

const connections = new ConnectionManager(clock, config.gracePeriodMs, (playerId: PlayerId) => {
  logger.info({ playerId }, "grace period elapsed; player considered gone");
  // In this slice there is no game; nothing to clean up beyond connection maps.
});

registerHandlers({ io, registry, rooms, connections, logger });

httpServer.listen(config.port, () => {
  logger.info({ port: config.port }, "masa server listening");
});
```

- [ ] **Step 6: Verify it typechecks and boots**

Run: `pnpm --filter @masa/shared build && pnpm --filter @masa/server build`
Expected: PASS — no type errors.

Run: `pnpm --filter @masa/server dev` (then Ctrl-C after the log line)
Expected: logs `masa server listening` with the port. No crash.

- [ ] **Step 7: Run the full server test suite to confirm nothing regressed**

Run: `pnpm --filter @masa/server test --run`
Expected: PASS — all tests from Tasks 4–10 green.

- [ ] **Step 8: Commit**

```bash
git add server/src/socket server/src/index.ts server/src/games/.gitkeep server/src/core/room/room-service.ts server/src/core/connection/connection-manager.ts
git commit -m "feat(server): wire Socket.IO handlers and server entry point"
```

---

## Task 12: Client package skeleton + typed socket wrapper + token helpers

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/token.ts`
- Create: `client/src/net/socket.ts`
- Create: `client/src/main.tsx`

No unit test (UI/IO glue); verify via Vite build/typecheck. End-to-end verified in Task 14.

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "@masa/client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@masa/shared": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `client/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": []
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 3: Create `client/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Create `client/index.html`**

```html
<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Masa Oyunları</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `client/src/token.ts`**

```ts
const KEY = "masa.playerToken";

export function loadToken(): string | undefined {
  return localStorage.getItem(KEY) ?? undefined;
}

export function saveToken(token: string): void {
  localStorage.setItem(KEY, token);
}
```

- [ ] **Step 6: Create `client/src/net/socket.ts`**

```ts
import { io, type Socket } from "socket.io-client";
import {
  ClientEvents,
  ServerEvents,
  type PlayerView,
  type IdentifiedPayload,
  type ErrorEventPayload,
  type JoinRoomPayload,
  type IdentifyPayload,
} from "@masa/shared";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

export interface ServerListeners {
  onIdentified: (p: IdentifiedPayload) => void;
  onRoomState: (v: PlayerView) => void;
  onError: (e: ErrorEventPayload) => void;
}

/** Thin typed wrapper around socket.io-client. */
export class GameSocket {
  private socket: Socket;

  constructor(listeners: ServerListeners) {
    this.socket = io(SERVER_URL, { autoConnect: true });
    this.socket.on(ServerEvents.identified, listeners.onIdentified);
    this.socket.on(ServerEvents.roomState, listeners.onRoomState);
    this.socket.on(ServerEvents.errorEvent, listeners.onError);
  }

  identify(payload: IdentifyPayload): void {
    this.socket.emit(ClientEvents.identify, payload);
  }
  createRoom(): void {
    this.socket.emit(ClientEvents.createRoom, {});
  }
  joinRoom(payload: JoinRoomPayload): void {
    this.socket.emit(ClientEvents.joinRoom, payload);
  }
  leaveRoom(): void {
    this.socket.emit(ClientEvents.leaveRoom, {});
  }
}
```

- [ ] **Step 7: Create a placeholder `client/src/main.tsx`** (App component arrives in Task 13; this lets the build run)

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Verify install (build deferred until App exists in Task 13)**

Run: `pnpm install`
Expected: client deps installed and linked. (Do not build yet — `App` is created in Task 13.)

- [ ] **Step 9: Commit**

```bash
git add client/package.json client/tsconfig.json client/vite.config.ts client/index.html client/src/token.ts client/src/net client/src/main.tsx pnpm-lock.yaml
git commit -m "feat(client): scaffold Vite/React package, typed socket wrapper, token helpers"
```

---

## Task 13: Client screens (nickname → lobby → room)

**Files:**
- Create: `client/src/App.tsx`
- Create: `client/src/core/NicknameEntry.tsx`
- Create: `client/src/core/Lobby.tsx`
- Create: `client/src/core/Room.tsx`

- [ ] **Step 1: Create `client/src/core/NicknameEntry.tsx`**

```tsx
import { useState } from "react";

export function NicknameEntry({ onSubmit }: { onSubmit: (nickname: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div>
      <h1>Masa Oyunları</h1>
      <label>
        Takma ad:{" "}
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={24} />
      </label>
      <button disabled={value.trim().length === 0} onClick={() => onSubmit(value.trim())}>
        Devam
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `client/src/core/Lobby.tsx`**

```tsx
import { useState } from "react";

export function Lobby({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <div>
      <h2>Lobi</h2>
      <button onClick={onCreate}>Yeni Oda Kur</button>
      <hr />
      <label>
        Oda kodu:{" "}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={12}
        />
      </label>
      <button disabled={code.trim().length === 0} onClick={() => onJoin(code.trim())}>
        Katıl
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `client/src/core/Room.tsx`**

```tsx
import type { PlayerView } from "@masa/shared";

export function Room({ view, onLeave }: { view: PlayerView; onLeave: () => void }) {
  const { room } = view;
  return (
    <div>
      <h2>Oda: {room.code}</h2>
      <p>Durum: {room.status}</p>
      <p>
        Oyuncular ({room.players.length}/{room.capacity}):
      </p>
      <ul>
        {room.players.map((p) => (
          <li key={p.id}>
            {p.nickname}
            {p.id === room.ownerId ? " 👑" : ""}
            {p.id === room.you ? " (sen)" : ""}
          </li>
        ))}
      </ul>
      <button onClick={onLeave}>Odadan Ayrıl</button>
    </div>
  );
}
```

- [ ] **Step 4: Create `client/src/App.tsx`** (ties screens to the socket; handles auto-identify on reload)

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerView } from "@masa/shared";
import { GameSocket } from "./net/socket.js";
import { loadToken, saveToken } from "./token.js";
import { NicknameEntry } from "./core/NicknameEntry.js";
import { Lobby } from "./core/Lobby.js";
import { Room } from "./core/Room.js";

type Screen = "nickname" | "lobby" | "room";

export function App() {
  const [screen, setScreen] = useState<Screen>("nickname");
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nicknameRef = useRef<string>("");

  const socket = useMemo(
    () =>
      new GameSocket({
        onIdentified: ({ token }) => {
          saveToken(token);
          setScreen((s) => (s === "nickname" ? "lobby" : s));
        },
        onRoomState: (v) => {
          setView(v);
          setScreen("room");
        },
        onError: (e) => setError(`${e.code}: ${e.message}`),
      }),
    [],
  );

  // Auto-identify on reload if we already have a token + remembered nickname.
  useEffect(() => {
    const token = loadToken();
    const nickname = localStorage.getItem("masa.nickname");
    if (token && nickname) {
      nicknameRef.current = nickname;
      socket.identify({ token, nickname });
    }
  }, [socket]);

  const handleNickname = (nickname: string) => {
    nicknameRef.current = nickname;
    localStorage.setItem("masa.nickname", nickname);
    socket.identify({ token: loadToken(), nickname });
  };

  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {screen === "nickname" && <NicknameEntry onSubmit={handleNickname} />}
      {screen === "lobby" && (
        <Lobby onCreate={() => socket.createRoom()} onJoin={(code) => socket.joinRoom({ code })} />
      )}
      {screen === "room" && view && (
        <Room
          view={view}
          onLeave={() => {
            socket.leaveRoom();
            setView(null);
            setScreen("lobby");
          }}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 5: Verify the client builds**

Run: `pnpm --filter @masa/client build`
Expected: PASS — `tsc -b` clean, Vite produces `client/dist`.

- [ ] **Step 6: Commit**

```bash
git add client/src/App.tsx client/src/core
git commit -m "feat(client): add nickname/lobby/room screens wired to socket"
```

---

## Task 14: Full-stack smoke verification + root typecheck

**Files:**
- Modify: `CLAUDE.md` (fill in the "Çalıştırma / build / test komutları" section)

No new code; this task proves the slice works end-to-end and records the commands.

- [ ] **Step 1: Root typecheck across all packages**

Run: `pnpm typecheck`
Expected: PASS — `tsc -b shared server client` clean.

- [ ] **Step 2: Full unit suite**

Run: `pnpm test`
Expected: PASS — every Vitest test from Tasks 4–10 green.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS (or only style warnings). Fix any errors before continuing.

> If ESLint is not yet configured to find a flat config, create `eslint.config.js` at the root:
> ```js
> import tseslint from "@typescript-eslint/eslint-plugin";
> import parser from "@typescript-eslint/parser";
>
> export default [
>   {
>     files: ["**/*.ts", "**/*.tsx"],
>     ignores: ["**/dist/**", "**/node_modules/**"],
>     languageOptions: { parser, parserOptions: { sourceType: "module" } },
>     plugins: { "@typescript-eslint": tseslint },
>     rules: {},
>   },
> ];
> ```
> Then add a Prettier config `/.prettierrc.json`:
> ```json
> { "semi": true, "singleQuote": false, "printWidth": 100 }
> ```
> Commit these if created:
> ```bash
> git add eslint.config.js .prettierrc.json
> git commit -m "chore: add ESLint flat config and Prettier config"
> ```

- [ ] **Step 4: Manual two-client smoke test**

Run: `pnpm dev`

Then:
1. Open `http://localhost:5173` in browser tab A. Enter nickname "Ada". You land in the lobby.
2. Click "Yeni Oda Kur". You see the Room screen with a 4-char code and yourself listed with 👑 and "(sen)".
3. Open `http://localhost:5173` in a second browser/profile (tab B, separate localStorage). Enter nickname "Grace".
4. Enter Ada's room code, click "Katıl". Both A and B now show both players in the list; Ada has 👑.
5. **Reconnect check:** In tab B, reload the page. It auto-identifies via stored token and lands back showing... the lobby (B's `session.roomCode` is server-side per-socket and reset on a brand-new socket). Note this as expected for this slice — full room reattachment after reconnect is part of the Okey slice (server keeps room membership keyed by token). Document the observed behavior.

Expected: Steps 1–4 work exactly as described. Step 5 confirms token-based auto-identify works; full seat-reattach-on-reload is explicitly deferred.

- [ ] **Step 5: Fill in `CLAUDE.md` commands section**

Replace the "TBD" block under "## Çalıştırma / build / test komutları" with:

```markdown
## Çalıştırma / build / test komutları

- `pnpm install` — bağımlılıkları kur.
- `pnpm dev` — server (`:3001`) + client (`:5173`) eşzamanlı.
- `pnpm typecheck` — tüm paketlerde tip kontrolü (project references).
- `pnpm test` — Vitest birim testleri (server core).
- `pnpm lint` — ESLint. `pnpm format` — Prettier.
- `pnpm build` — shared → server + client derleme.

> Playwright E2E (`pnpm test:e2e`) henüz kurulmadı; Okey/UI dilimiyle gelecek.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record build/run/test commands after scaffold slice"
```

---

## Self-Review notes (already applied)

- **Spec coverage:** monorepo + project references (T1–T2), shared types + Zod contracts (T2–T3), custom errors (T4), injectable RNG (T5), config from env (T6), PlayerRegistry token identity (T7), RoomRepository behind interface + RoomService (T8), pure toPlayerView (T9), ConnectionManager reconnect grace + TurnTimer (T10), thin Socket.IO transport delegating to services (T11), React client with token in localStorage + 3 screens (T12–T13), Vitest tests for all pure logic incl. reconnect with fake timers (T5,T7–T10), DoD smoke + commands (T14). All spec sections map to tasks.
- **Type consistency:** `RoomService` exposes `getRoom`; `ConnectionManager` exposes `socketForPlayer`/`isConnected`/`attach`/`handleDisconnect`; `toPlayerView(room, you)`; `PlayerView.room.you` used consistently in server and client. RNG method `nextInt(maxExclusive)` used identically in RoomService/PlayerRegistry/tests. Clock `setTimeout/clearTimeout/advance` consistent across ConnectionManager/TurnTimer/FakeClock.
- **Reconnect scope honesty:** Task 14 Step 4.5 explicitly documents that full seat-reattach-on-page-reload is deferred to the Okey slice (membership keyed by token), while token auto-identify is proven now. This matches the brainstorm decision to keep this slice light.
