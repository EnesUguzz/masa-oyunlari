# Okey 101 İstemci Masası (2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build a functional React okey table that consumes the 2a socket contract so 4 players can play a full match in the browser.

**Architecture:** Client-mirrored okey types + a pure `move-builder` (TDD via a new minimal client vitest) + a `GameSocket` okey extension + presentational components under `client/src/games/okey/`. Components verified by typecheck/build (full-flow E2E is 2c). Minimal inline-style, matching the existing client.

**Tech Stack:** React 18 + Vite + TypeScript (strict), socket.io-client, Vitest (client, pure logic only).

**Spec:** `docs/superpowers/specs/2026-06-16-okey-client-table-design.md`

---

## Conventions
- Client imports ONLY `@masa/shared` + local files (never the server package). Okey wire types are mirrored locally.
- Inline styles only (`style={{...}}`), match `core/Room.tsx`.
- Strict TS: NO `any`, NO `console`, explicit return types on exported functions/components. `pnpm lint` (eslint .) and `pnpm typecheck` (`tsc -b shared server client`) cover the client.
- Verify: `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm --filter @masa/client test --run` (move-builder).

---

## Task 1: Client okey types + move-builder + client test setup

**Files:** Create `client/src/games/okey/types.ts`, `client/src/games/okey/move-builder.ts`, `client/src/games/okey/move-builder.test.ts`, `client/vitest.config.ts`; modify `client/package.json`, root `package.json`.

- [ ] **Step 1: Add the client test runner.**
In `client/package.json`, add `"test": "vitest"` to scripts and `"vitest": "^2.1.0"` to devDependencies. Create `client/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```
In the root `package.json`, change the `test` script to also run client tests:
```json
    "test": "pnpm --filter @masa/server test --run && pnpm --filter @masa/client test --run",
```
Run `pnpm install` to install vitest for the client.

- [ ] **Step 2: Create the mirrored types `client/src/games/okey/types.ts`:**
```ts
// Mirror of the server okey wire shapes (games/okey). Kept structural; the wire is JSON.
export type OkeyColor = "red" | "yellow" | "black" | "blue";
export interface NumberedTile { kind: "numbered"; color: OkeyColor; value: number; }
export interface FakeJoker { kind: "fakeJoker"; }
export type OkeyTile = NumberedTile | FakeJoker;

export type PairingMode = "essiz" | "esli";
export type EscalationMode = "katlamasiz" | "katlamali";
export type PenaltyMode = "cezasiz" | "cezali";
export type PartnerEscalation = "ese-katlamali" | "ese-katlamasiz";
export type TargetHands = 7 | 11 | 21;

export interface OkeyConfig {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  partnerEscalation: PartnerEscalation;
  targetHands: TargetHands;
  openThreshold: number;
  minPairs: number;
}

export interface TableMeld { id: string; owner: number; kind: "run" | "set" | "pair"; tiles: OkeyTile[]; }
export interface FinishType { elden: boolean; okey: boolean; pairs: boolean; }
export interface HandOutcome {
  finisherSeat: number | null;
  finishType: FinishType | null;
  leftovers: { seat: number; tiles: OkeyTile[] }[];
  feedingEvents: { feederSeat: number; takerSeat: number; tileValue: number; takerMode: "melds" | "pairs" }[];
  deckExhausted: boolean;
}

export interface PublicPlayer {
  seat: number;
  playerId: string;
  team: 0 | 1 | null;
  opened: boolean;
  openMode: "melds" | "pairs" | null;
  pairCount: number;
  handCount: number;
  lastDiscard: OkeyTile | null;
}

export interface OkeyPlayerView {
  config: OkeyConfig;
  indicator: NumberedTile;
  okey: NumberedTile;
  you: number;
  yourHand: OkeyTile[];
  turn: number;
  phase: "draw" | "act";
  drawPileCount: number;
  players: PublicPlayer[];
  tableMelds: TableMeld[];
  status: "playing" | "finished";
  outcome: HandOutcome | null;
}

export type MatchWinner = { kind: "seat"; seat: number } | { kind: "team"; team: 0 | 1 } | null;
export interface MatchStanding {
  seatTotals: number[];
  teamTotals: [number, number] | null;
  handsPlayed: number;
  targetHands: number;
  status: "playing" | "finished";
  winner: MatchWinner;
}
export interface SeatInfo { seat: number; playerId: string; nickname: string; }
export interface OkeyTableView {
  view: OkeyPlayerView;
  match: MatchStanding;
  handNumber: number;
  seating: SeatInfo[];
}

export type Move =
  | { kind: "drawFromPile" }
  | { kind: "drawFromDiscard" }
  | { kind: "openMelds"; melds: OkeyTile[][] }
  | { kind: "openPairs"; pairs: OkeyTile[][] }
  | { kind: "openNewMeld"; tiles: OkeyTile[] }
  | { kind: "processToMeld"; meldId: string; tiles: OkeyTile[] }
  | { kind: "discard"; tile: OkeyTile };

export interface StartGameConfig {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  partnerEscalation?: PartnerEscalation;
  targetHands: TargetHands;
}
```

- [ ] **Step 3: Write the failing test `client/src/games/okey/move-builder.test.ts`:**
```ts
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
```

- [ ] **Step 4: Run — expect FAIL** (`pnpm --filter @masa/client test --run`).

- [ ] **Step 5: Implement `client/src/games/okey/move-builder.ts`:**
```ts
import type { Move, OkeyTile } from "./types.js";

export function tilesEqual(a: OkeyTile, b: OkeyTile): boolean {
  if (a.kind === "fakeJoker" && b.kind === "fakeJoker") return true;
  if (a.kind === "numbered" && b.kind === "numbered") return a.color === b.color && a.value === b.value;
  return false;
}

export function buildOpenMelds(groups: OkeyTile[][]): Move {
  return { kind: "openMelds", melds: groups };
}
export function buildOpenPairs(pairs: OkeyTile[][]): Move {
  return { kind: "openPairs", pairs };
}
export function buildProcess(meldId: string, tiles: OkeyTile[]): Move {
  return { kind: "processToMeld", meldId, tiles };
}
export function buildOpenNewMeld(tiles: OkeyTile[]): Move {
  return { kind: "openNewMeld", tiles };
}
export function buildDiscard(tile: OkeyTile): Move {
  return { kind: "discard", tile };
}
export function canDiscard(selected: OkeyTile[]): boolean {
  return selected.length === 1;
}
```

- [ ] **Step 6: Run test (3 pass), `pnpm typecheck`, `pnpm lint`.**

- [ ] **Step 7: Commit**
```bash
git add client/src/games/okey/types.ts client/src/games/okey/move-builder.ts client/src/games/okey/move-builder.test.ts client/vitest.config.ts client/package.json package.json pnpm-lock.yaml
git commit -m "feat(okey-client): add mirrored types, move-builder, client vitest"
```

---

## Task 2: Socket extension + App table screen

**Files:** Modify `client/src/net/socket.ts`, `client/src/App.tsx`.

- [ ] **Step 1: Extend `client/src/net/socket.ts`** — add okey listeners + methods (keep existing lobby behavior). Add to imports:
```ts
import type { OkeyTableView, Move, StartGameConfig } from "../games/okey/types.js";
```
Add to `ServerListeners`:
```ts
  onOkeyState: (tv: OkeyTableView) => void;
  onOkeyEnded: (tv: OkeyTableView) => void;
```
In the constructor, after the existing `.on(...)` lines:
```ts
    this.socket.on("okey:state", listeners.onOkeyState);
    this.socket.on("okey:ended", listeners.onOkeyEnded);
```
Add methods:
```ts
  startGame(config: StartGameConfig): void {
    this.socket.emit("okey:startGame", config);
  }
  sendMove(move: Move): void {
    this.socket.emit("okey:move", { move });
  }
```

- [ ] **Step 2: Update `client/src/App.tsx`** — add a `"table"` screen and route on okey events.
Add import:
```ts
import type { OkeyTableView } from "./games/okey/types.js";
import { OkeyTable } from "./games/okey/OkeyTable.js";
```
Add `"table"` to the `Screen` type. Add state:
```ts
  const [table, setTable] = useState<OkeyTableView | null>(null);
```
Add the two listeners to the `GameSocket` config:
```ts
        onOkeyState: (tv) => { setError(null); setTable(tv); setScreen("table"); },
        onOkeyEnded: (tv) => { setError(null); setTable(tv); setScreen("table"); },
```
Pass `socket` into `Room` (for the start-game panel) — change the room render:
```ts
      {screen === "room" && view && (
        <Room
          view={view}
          socket={socket}
          onLeave={() => { socket.leaveRoom(); setView(null); setScreen("lobby"); }}
        />
      )}
      {screen === "table" && table && (
        <OkeyTable table={table} onMove={(m) => socket.sendMove(m)} />
      )}
```

> `Room`'s new `socket` prop and `OkeyTable` are implemented in Tasks 4/5. After this task, typecheck will fail until those exist — that is expected; this task's commit happens AFTER Task 5 if executing strictly. To keep tasks independently green, implement Tasks 3-5 then run the full verification. **Execution note:** commit Task 2's socket.ts change now; defer the App.tsx wiring commit to Task 5 (where OkeyTable + Room props exist). Concretely: in THIS task, only modify `socket.ts` and commit it; do the App.tsx edits in Task 5.

- [ ] **Step 3 (this task's actual change): only `socket.ts`.** Run `pnpm typecheck` (clean — socket.ts compiles against the Task 1 types), `pnpm lint`.

- [ ] **Step 4: Commit**
```bash
git add client/src/net/socket.ts
git commit -m "feat(okey-client): extend GameSocket with okey events"
```

---

## Task 3: Tile, Hand, Scoreboard components

**Files:** Create `client/src/games/okey/Tile.tsx`, `client/src/games/okey/Hand.tsx`, `client/src/games/okey/Scoreboard.tsx`.

- [ ] **Step 1: `Tile.tsx`:**
```tsx
import type { OkeyTile } from "./types.js";

const COLOR_HEX: Record<string, string> = { red: "#d33", yellow: "#ca0", black: "#222", blue: "#36c" };

export function Tile({ tile, selected, onClick }: { tile: OkeyTile; selected?: boolean; onClick?: () => void }): JSX.Element {
  const label = tile.kind === "fakeJoker" ? "🃏" : String(tile.value);
  const color = tile.kind === "fakeJoker" ? "#666" : COLOR_HEX[tile.color] ?? "#222";
  return (
    <button
      onClick={onClick}
      style={{
        minWidth: 34, height: 46, margin: 2, fontSize: 18, fontWeight: 700,
        color, background: selected ? "#cdeffd" : "#fff",
        border: `2px solid ${selected ? "#08a" : "#bbb"}`, borderRadius: 6, cursor: onClick ? "pointer" : "default",
      }}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: `Hand.tsx`** — renders your tiles with toggle selection:
```tsx
import type { OkeyTile } from "./types.js";
import { Tile } from "./Tile.js";
import { tilesEqual } from "./move-builder.js";

export function Hand({ tiles, selected, onToggle }: { tiles: OkeyTile[]; selected: OkeyTile[]; onToggle: (index: number) => void }): JSX.Element {
  const isSel = (t: OkeyTile): boolean => selected.some((s) => tilesEqual(s, t));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", padding: 8, background: "#f3f3f3", borderRadius: 8 }}>
      {tiles.map((t, i) => (
        <Tile key={i} tile={t} selected={isSel(t)} onClick={() => onToggle(i)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `Scoreboard.tsx`:**
```tsx
import type { MatchStanding, SeatInfo } from "./types.js";

export function Scoreboard({ match, seating }: { match: MatchStanding; seating: SeatInfo[] }): JSX.Element {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 8, minWidth: 160 }}>
      <strong>Skor</strong>
      <p style={{ margin: "4px 0" }}>El {match.handsPlayed}/{match.targetHands}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {seating.map((s) => (
          <li key={s.seat}>{s.nickname}: {match.seatTotals[s.seat] ?? 0}</li>
        ))}
      </ul>
      {match.teamTotals && (
        <p style={{ margin: "4px 0" }}>Takım: {match.teamTotals[0]} / {match.teamTotals[1]}</p>
      )}
      {match.status === "finished" && match.winner && (
        <p style={{ color: "green", fontWeight: 700 }}>
          Kazanan: {match.winner.kind === "seat" ? seating[match.winner.seat]?.nickname : `Takım ${match.winner.team}`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `pnpm typecheck` (clean), `pnpm lint` (clean).** (No unit tests for presentational components; verified by typecheck/build.)

- [ ] **Step 5: Commit**
```bash
git add client/src/games/okey/Tile.tsx client/src/games/okey/Hand.tsx client/src/games/okey/Scoreboard.tsx
git commit -m "feat(okey-client): add Tile, Hand, Scoreboard components"
```

---

## Task 4: Controls + StartGamePanel

**Files:** Create `client/src/games/okey/Controls.tsx`, `client/src/games/okey/StartGamePanel.tsx`.

- [ ] **Step 1: `Controls.tsx`** — move interactions for the current player:
```tsx
import { useState } from "react";
import type { Move, OkeyTile, OkeyPlayerView } from "./types.js";
import { buildOpenMelds, buildOpenPairs, buildProcess, buildOpenNewMeld, buildDiscard, canDiscard } from "./move-builder.js";

export function Controls({ view, selected, onClearSelection, onMove }: {
  view: OkeyPlayerView;
  selected: OkeyTile[];
  onClearSelection: () => void;
  onMove: (move: Move) => void;
}): JSX.Element {
  const [staged, setStaged] = useState<OkeyTile[][]>([]);
  const [meldId, setMeldId] = useState<string>("");
  const yourTurn = view.turn === view.you;

  if (!yourTurn) return <p>Sıra başka oyuncuda…</p>;

  const send = (m: Move): void => { onMove(m); setStaged([]); onClearSelection(); };
  const stage = (): void => { if (selected.length > 0) { setStaged((g) => [...g, selected]); onClearSelection(); } };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {view.phase === "draw" && (
        <>
          <button onClick={() => send({ kind: "drawFromPile" })}>Desteden çek ({view.drawPileCount})</button>
          <button onClick={() => send({ kind: "drawFromDiscard" })}>Yerden al</button>
        </>
      )}
      {view.phase === "act" && (
        <>
          <button disabled={selected.length === 0} onClick={stage}>Gruba ekle ({staged.length} hazır)</button>
          <button disabled={staged.length === 0} onClick={() => send(buildOpenMelds(staged))}>Perlerle Aç</button>
          <button disabled={staged.length === 0} onClick={() => send(buildOpenPairs(staged))}>Çiftlerle Aç</button>
          <button disabled={selected.length === 0} onClick={() => send(buildOpenNewMeld(selected))}>Yeni Per</button>
          <select value={meldId} onChange={(e) => setMeldId(e.target.value)}>
            <option value="">Per seç…</option>
            {view.tableMelds.map((m) => (
              <option key={m.id} value={m.id}>{m.kind} #{m.id}</option>
            ))}
          </select>
          <button disabled={!meldId || selected.length === 0} onClick={() => send(buildProcess(meldId, selected))}>İşle</button>
          <button disabled={!canDiscard(selected)} onClick={() => send(buildDiscard(selected[0]!))}>At</button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `StartGamePanel.tsx`** — owner config + start:
```tsx
import { useState } from "react";
import type { StartGameConfig, PairingMode, EscalationMode, PenaltyMode, PartnerEscalation, TargetHands } from "./types.js";

export function StartGamePanel({ onStart }: { onStart: (config: StartGameConfig) => void }): JSX.Element {
  const [pairing, setPairing] = useState<PairingMode>("essiz");
  const [escalation, setEscalation] = useState<EscalationMode>("katlamasiz");
  const [penalty, setPenalty] = useState<PenaltyMode>("cezasiz");
  const [partnerEscalation, setPartnerEscalation] = useState<PartnerEscalation>("ese-katlamali");
  const [targetHands, setTargetHands] = useState<TargetHands>(11);
  const showPartner = pairing === "esli" && escalation === "katlamali";

  const start = (): void => {
    const config: StartGameConfig = { pairing, escalation, penalty, targetHands };
    if (showPartner) config.partnerEscalation = partnerEscalation;
    onStart(config);
  };

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginTop: 12 }}>
      <strong>Oyunu başlat</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        <label>Eş: <select value={pairing} onChange={(e) => setPairing(e.target.value as PairingMode)}><option value="essiz">Eşsiz</option><option value="esli">Eşli</option></select></label>
        <label>Katlama: <select value={escalation} onChange={(e) => setEscalation(e.target.value as EscalationMode)}><option value="katlamasiz">Katlamasız</option><option value="katlamali">Katlamalı</option></select></label>
        <label>Ceza: <select value={penalty} onChange={(e) => setPenalty(e.target.value as PenaltyMode)}><option value="cezasiz">Cezasız</option><option value="cezali">Cezalı</option></select></label>
        {showPartner && (
          <label>Eşe: <select value={partnerEscalation} onChange={(e) => setPartnerEscalation(e.target.value as PartnerEscalation)}><option value="ese-katlamali">Eşe-katlamalı</option><option value="ese-katlamasiz">Eşe-katlamasız</option></select></label>
        )}
        <label>El: <select value={targetHands} onChange={(e) => setTargetHands(Number(e.target.value) as TargetHands)}><option value={7}>7</option><option value={11}>11</option><option value={21}>21</option></select></label>
      </div>
      <button style={{ marginTop: 8 }} onClick={start}>Oyunu Başlat</button>
    </div>
  );
}
```

- [ ] **Step 3: `pnpm typecheck` (clean), `pnpm lint` (clean).**

- [ ] **Step 4: Commit**
```bash
git add client/src/games/okey/Controls.tsx client/src/games/okey/StartGamePanel.tsx
git commit -m "feat(okey-client): add Controls and StartGamePanel"
```

---

## Task 5: OkeyTable assembly + Room/App wiring + full verification

**Files:** Create `client/src/games/okey/OkeyTable.tsx`; modify `client/src/core/Room.tsx`, `client/src/App.tsx`.

- [ ] **Step 1: `OkeyTable.tsx`** — assembles the board and owns selection state:
```tsx
import { useState } from "react";
import type { Move, OkeyTile, OkeyTableView } from "./types.js";
import { tilesEqual } from "./move-builder.js";
import { Hand } from "./Hand.js";
import { Tile } from "./Tile.js";
import { Controls } from "./Controls.js";
import { Scoreboard } from "./Scoreboard.js";

export function OkeyTable({ table, onMove }: { table: OkeyTableView; onMove: (move: Move) => void }): JSX.Element {
  const { view, seating } = table;
  const [selected, setSelected] = useState<OkeyTile[]>([]);

  const toggle = (index: number): void => {
    const tile = view.yourHand[index];
    if (!tile) return;
    setSelected((cur) => (cur.some((s) => tilesEqual(s, tile)) ? cur.filter((s) => !tilesEqual(s, tile)) : [...cur, tile]));
  };
  const nick = (seat: number): string => seating.find((s) => s.seat === seat)?.nickname ?? `#${seat}`;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 360 }}>
        <p>
          Gösterge: <Tile tile={table.view.indicator} /> Okey: <Tile tile={table.view.okey} /> · Deste: {view.drawPileCount} · El {table.handNumber}
        </p>
        <p>Sıra: <strong>{nick(view.turn)}</strong> ({view.phase === "draw" ? "çekiyor" : "oynuyor"})</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
          {view.players.filter((p) => p.seat !== view.you).map((p) => (
            <div key={p.seat} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 6, minWidth: 120 }}>
              <strong>{nick(p.seat)}</strong>{view.turn === p.seat ? " ▶" : ""}
              <div>taş: {p.handCount}{p.opened ? ` · açtı (${p.openMode})` : ""}</div>
              <div>son atılan: {p.lastDiscard ? <Tile tile={p.lastDiscard} /> : "—"}</div>
            </div>
          ))}
        </div>

        <p style={{ marginBottom: 4 }}>Masadaki perler:</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 52 }}>
          {view.tableMelds.length === 0 ? <em>henüz yok</em> : view.tableMelds.map((m) => (
            <div key={m.id} style={{ border: "1px dashed #bbb", borderRadius: 6, padding: 4 }}>
              <small>{m.kind} #{m.id} ({nick(m.owner)})</small>
              <div style={{ display: "flex" }}>{m.tiles.map((t, i) => <Tile key={i} tile={t} />)}</div>
            </div>
          ))}
        </div>

        <p style={{ margin: "12px 0 4px" }}>Senin elin ({view.yourHand.length}):</p>
        <Hand tiles={view.yourHand} selected={selected} onToggle={toggle} />
        <div style={{ marginTop: 8 }}>
          <Controls view={view} selected={selected} onClearSelection={() => setSelected([])} onMove={onMove} />
        </div>
      </div>
      <Scoreboard match={table.match} seating={seating} />
    </div>
  );
}
```

- [ ] **Step 2: Wire `Room.tsx`** — add the start-game panel for the owner. Replace `client/src/core/Room.tsx`:
```tsx
import type { PlayerView } from "@masa/shared";
import type { GameSocket } from "../net/socket.js";
import { StartGamePanel } from "../games/okey/StartGamePanel.js";

export function Room({ view, socket, onLeave }: { view: PlayerView; socket: GameSocket; onLeave: () => void }): JSX.Element {
  const { room } = view;
  const isOwner = room.you === room.ownerId;
  const canStart = isOwner && room.status === "waiting" && room.players.length === room.capacity;
  return (
    <div>
      <h2>Oda: {room.code}</h2>
      <p>Durum: {room.status}</p>
      <p>Oyuncular ({room.players.length}/{room.capacity}):</p>
      <ul>
        {room.players.map((p) => (
          <li key={p.id}>
            {p.nickname}
            {p.id === room.ownerId ? " 👑" : ""}
            {p.id === room.you ? " (sen)" : ""}
          </li>
        ))}
      </ul>
      {canStart && <StartGamePanel onStart={(config) => socket.startGame(config)} />}
      {isOwner && room.status === "waiting" && room.players.length < room.capacity && (
        <p><em>Başlatmak için {room.capacity} oyuncu gerekli.</em></p>
      )}
      <button onClick={onLeave}>Odadan Ayrıl</button>
    </div>
  );
}
```

- [ ] **Step 3: Wire `App.tsx`** — apply the changes described in Task 2 Step 2 (add `"table"` screen, `table` state, `onOkeyState`/`onOkeyEnded` listeners, pass `socket` to `Room`, render `OkeyTable`). The `Screen` type becomes `"nickname" | "lobby" | "room" | "table"`. Imports: `import type { OkeyTableView } from "./games/okey/types.js";` and `import { OkeyTable } from "./games/okey/OkeyTable.js";`.

- [ ] **Step 4: Full verification** — run each and confirm clean:
- `pnpm typecheck` → clean.
- `pnpm lint` → exit 0.
- `pnpm build` → success.
- `pnpm --filter @masa/client test --run` → move-builder green.
Fix any issue (unused import, JSX type, prop mismatch) before committing.

- [ ] **Step 5: Commit**
```bash
git add client/src/games/okey/OkeyTable.tsx client/src/core/Room.tsx client/src/App.tsx
git commit -m "feat(okey-client): assemble OkeyTable and wire room start + app routing"
```

---

## Notes for the implementer
- **JSX return type:** use `JSX.Element` (React 18 + the project's tsconfig). If the tsconfig needs `import type { JSX } from "react"`, add it.
- **Server authority:** the UI never decides validity — disabled buttons are UX hints only; the server validates every move and returns `errorEvent` (shown by the existing App error banner).
- **No client component unit tests** in this slice; correctness of the full flow is the E2E slice (2c). Only `move-builder` is unit-tested.
- **Out of scope:** drag/drop, tile sorting, animations, dealer-rotation UI, sound.

## Self-review (author)
- **Spec coverage:** types+move-builder+client-vitest (T1), socket extension (T2), Tile/Hand/Scoreboard (T3), Controls/StartGamePanel (T4), OkeyTable+Room+App wiring+verify (T5). All spec sections mapped.
- **Type consistency:** mirrored `OkeyTableView`/`OkeyPlayerView`/`Move`/`StartGameConfig` used identically across socket, components, and App; `GameSocket.startGame/sendMove` signatures match.
- **Ordering caveat noted:** App.tsx depends on OkeyTable + Room's new `socket` prop; T2 commits only socket.ts and the App.tsx wiring is done in T5 after those exist.
- **No placeholders:** complete code or exact commands in every step.
