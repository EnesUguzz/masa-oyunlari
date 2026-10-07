import type { OkeyTile, NumberedTile } from "./tile.js";
import { isNumbered, tilesEqual } from "./tile.js";
import { isValidMeld } from "./meld.js";
import type { OkeyGameState, PlayerHandState, HandOutcome, TableMeld, TurnSnapshot } from "./game-state.js";
import { WrongPhaseError, TileNotInHandError } from "./errors.js";

/**
 * True if `tile` could be processed onto SOME existing run/set on the table —
 * i.e. appending it to a meld keeps that meld valid. Pairs are not processable.
 * Used to penalize discarding a tile the player should have laid (işlek taş).
 */
export function isProcessableDiscard(tile: OkeyTile, melds: readonly TableMeld[], okey: NumberedTile): boolean {
  return melds.some((m) => m.kind !== "pair" && isValidMeld([...m.tiles, tile], okey));
}

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
    deckExhausted: o.deckExhausted,
  };
}

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
    actCheckpoint: s.actCheckpoint ? { turnSeq: s.actCheckpoint.turnSeq, snap: cloneSnapshot(s.actCheckpoint.snap) } : null,
    status: s.status,
    outcome: s.outcome ? cloneOutcome(s.outcome) : null,
  };
}

function cloneSnapshot(snap: TurnSnapshot): TurnSnapshot {
  return {
    players: snap.players.map((p) => ({ ...p, hand: cloneTiles(p.hand) })),
    tableMelds: snap.tableMelds.map((m) => ({ ...m, tiles: cloneTiles(m.tiles) })),
    highestOpenScore: snap.highestOpenScore,
    highestOpenPairs: snap.highestOpenPairs,
    meldSeq: snap.meldSeq,
    pendingFloorTile: snap.pendingFloorTile ? cloneTile(snap.pendingFloorTile) : null,
    feedingEvents: snap.feedingEvents.map((e) => ({ ...e })),
  };
}

/**
 * Record the per-turn undo checkpoint once, before the turn's first opening or
 * processing action. Idempotent within a turn (tagged by turnSeq).
 */
export function checkpointTurn(s: OkeyGameState): void {
  if (!s.actCheckpoint || s.actCheckpoint.turnSeq !== s.turnSeq) {
    s.actCheckpoint = {
      turnSeq: s.turnSeq,
      snap: {
        players: s.players.map((p) => ({ ...p, hand: cloneTiles(p.hand) })),
        tableMelds: s.tableMelds.map((m) => ({ ...m, tiles: cloneTiles(m.tiles) })),
        highestOpenScore: s.highestOpenScore,
        highestOpenPairs: s.highestOpenPairs,
        meldSeq: s.meldSeq,
        pendingFloorTile: s.pendingFloorTile ? cloneTile(s.pendingFloorTile) : null,
        feedingEvents: s.feedingEvents.map((e) => ({ ...e })),
      },
    };
  }
}

/** Restore this turn's checkpoint (undo opens/processes). Returns false if none. */
export function restoreTurnCheckpoint(s: OkeyGameState): boolean {
  if (!s.actCheckpoint || s.actCheckpoint.turnSeq !== s.turnSeq) return false;
  const snap = cloneSnapshot(s.actCheckpoint.snap);
  s.players = snap.players;
  s.tableMelds = snap.tableMelds;
  s.highestOpenScore = snap.highestOpenScore;
  s.highestOpenPairs = snap.highestOpenPairs;
  s.meldSeq = snap.meldSeq;
  s.pendingFloorTile = snap.pendingFloorTile;
  s.feedingEvents = snap.feedingEvents;
  return true;
}

export function current(s: OkeyGameState): PlayerHandState {
  return s.players[s.turn]!;
}

export function requirePhase(s: OkeyGameState, phase: "draw" | "act"): void {
  if (s.phase !== phase) throw new WrongPhaseError(`expected ${phase}, was ${s.phase}`);
}

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

export function consumeFloorIfLaid(s: OkeyGameState, laid: readonly OkeyTile[]): boolean {
  if (s.pendingFloorTile === null) return false;
  const present = laid.some((t) => tilesEqual(t, s.pendingFloorTile!));
  if (present) { s.pendingFloorTile = null; return true; }
  return false;
}

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

function partnerSeat(s: OkeyGameState, seat: number): number | null {
  if (s.config.pairing !== "esli") return null;
  const team = s.players[seat]!.team;
  for (const p of s.players) if (p.seat !== seat && p.team === team) return p.seat;
  return null;
}

export function meldThreshold(s: OkeyGameState, seat: number = s.turn): number {
  if (s.config.escalation === "katlamasiz") return s.config.openThreshold;
  const me = seat;
  const excludePartner = s.config.pairing === "esli" && s.config.partnerEscalation === "ese-katlamasiz";
  const partner = excludePartner ? partnerSeat(s, me) : null;
  let best: number | null = null;
  for (const p of s.players) {
    if (p.seat === me || p.seat === partner) continue;
    if (p.opened && p.openMode === "melds") best = best === null ? p.openScore : Math.max(best, p.openScore);
  }
  return best === null ? s.config.openThreshold : best + 1;
}

export function pairThreshold(s: OkeyGameState, seat: number = s.turn): number {
  if (s.config.escalation === "katlamasiz") return s.config.minPairs;
  const me = seat;
  const excludePartner = s.config.pairing === "esli" && s.config.partnerEscalation === "ese-katlamasiz";
  const partner = excludePartner ? partnerSeat(s, me) : null;
  let best: number | null = null;
  for (const p of s.players) {
    if (p.seat === me || p.seat === partner) continue;
    if (p.opened && p.openMode === "pairs") best = best === null ? p.pairCount : Math.max(best, p.pairCount);
  }
  return best === null ? s.config.minPairs : best + 1;
}
