import type { OkeyTile, NumberedTile } from "./tile.js";
import { isNumbered, tilesEqual } from "./tile.js";
import { isValidMeld } from "./meld.js";
import type { OkeyGameState, PlayerHandState, HandOutcome, TableMeld } from "./game-state.js";
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
