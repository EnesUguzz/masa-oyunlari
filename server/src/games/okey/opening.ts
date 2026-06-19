import type { OkeyTile } from "./tile.js";
import { isNumbered } from "./tile.js";
import type { NumberedTile } from "./tile.js";
import { isValidMeld, isValidRun } from "./meld.js";
import { isPair } from "./pairs.js";
import { meldsTotal } from "./points.js";
import { InvalidMoveError } from "../../core/errors/index.js";
import type { OkeyGameState } from "./game-state.js";
import { AlreadyOpenedError, OpeningThresholdNotMetError, NotOpenedError, ModeLockedError } from "./errors.js";
import {
  current, requirePhase, removeTilesFromHand, consumeFloorIfLaid, recordFeeding, meldThreshold, pairThreshold,
} from "./helpers.js";
import { decompose } from "./decompose.js";

function meldKind(tiles: readonly OkeyTile[], okey: OkeyGameState["okey"]): "run" | "set" {
  return isValidRun(tiles, okey) ? "run" : "set";
}

/** True if any seat has opened in pairs (çift) mode. */
function pairsOpenerExists(s: OkeyGameState): boolean {
  return s.players.some((p) => p.opened && p.openMode === "pairs");
}

const PAIRS_PROCESS_PER_TURN = 2;

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
  // Opening while still holding an unused floor tile is allowed, but costs a flat
  // 101 penalty at scoring; clear the pending flag so the player can play on.
  if (s.pendingFloorTile !== null) { me.floorPenalty = true; s.pendingFloorTile = null; }

  for (const m of melds) {
    s.tableMelds.push({ id: String(s.meldSeq++), owner: me.seat, kind: meldKind(m, s.okey), tiles: m });
  }
  me.opened = true;
  me.openMode = "melds";
  me.openScore = total;
  me.openedOnTurn = s.turnSeq;
  s.highestOpenScore = s.highestOpenScore === null ? total : Math.max(s.highestOpenScore, total);
}

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
  if (s.pendingFloorTile !== null) { me.floorPenalty = true; s.pendingFloorTile = null; }

  for (const p of pairs) {
    s.tableMelds.push({ id: String(s.meldSeq++), owner: me.seat, kind: "pair", tiles: p });
  }
  me.opened = true;
  me.openMode = "pairs";
  me.pairCount = n;
  me.openedOnTurn = s.turnSeq;
  s.highestOpenPairs = s.highestOpenPairs === null ? n : Math.max(s.highestOpenPairs, n);
}

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
  // A pairs (çift) opener cannot lay series, but may add at most 2 tiles onto an
  // existing series per turn.
  if (me.openMode === "pairs") {
    const already = me.processTurnSeq === s.turnSeq ? (me.processedThisTurn ?? 0) : 0;
    if (already + tiles.length > PAIRS_PROCESS_PER_TURN) {
      throw new ModeLockedError(`çift açan oyuncu bir turda en fazla ${PAIRS_PROCESS_PER_TURN} taş işleyebilir`);
    }
    me.processTurnSeq = s.turnSeq;
    me.processedThisTurn = already + tiles.length;
  }
  removeTilesFromHand(me, tiles);
  consumeFloorIfLaid(s, tiles);
  meld.tiles = candidate;
  meld.kind = meldKind(candidate, s.okey);
}

/**
 * "Aç" — compute the best valid opening from the current seat's hand server-side
 * and lay it down. If not yet opened, opens the highest-value meld decomposition
 * (must meet the threshold). If already opened in melds mode, lays down every
 * further meld it can find, always keeping at least one tile to discard with.
 * Pure game logic stays on the server; the client only sends the intent.
 */
export function applyAutoOpen(s: OkeyGameState): void {
  requirePhase(s, "act");
  const me = current(s);

  if (!me.opened) {
    const d = decompose(me.hand, s.okey, "maxValue");
    if (d.groups.length === 0 || d.value < meldThreshold(s)) {
      throw new OpeningThresholdNotMetError(`best opening ${d.value}, need ${meldThreshold(s)}`);
    }
    applyOpenMelds(s, d.groups.map((g) => [...g]));
  }

  // At this point the seat is opened (either just now, or previously). autoOpen
  // only manages melds; a pairs opener must lay further pairs manually.
  if (me.openMode !== "melds") {
    throw new ModeLockedError("autoOpen only lays melds; pairs mode is manual");
  }

  // Lay down every additional meld we can, keeping >=1 tile to discard.
  let more = true;
  while (more) {
    more = false;
    const d = decompose(me.hand, s.okey, "maxTilesUsed");
    for (const g of d.groups) {
      if (me.hand.length - g.length >= 1) {
        applyOpenNewMeld(s, [...g]);
        more = true;
        break;
      }
    }
  }
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
    // A melds (per) opener may also melt a leftover pair onto the table, but only
    // once another player has opened in pairs (çift) mode.
    if (tiles.length === 2 && isPair(tiles[0]!, tiles[1]!, s.okey) && pairsOpenerExists(s)) {
      removeTilesFromHand(me, tiles);
      consumeFloorIfLaid(s, tiles);
      s.tableMelds.push({ id: String(s.meldSeq++), owner: me.seat, kind: "pair", tiles });
      return;
    }
    throw new InvalidMoveError("tiles are not a valid run or set");
  }
  removeTilesFromHand(me, tiles);
  consumeFloorIfLaid(s, tiles);
  s.tableMelds.push({ id: String(s.meldSeq++), owner: me.seat, kind: meldKind(tiles, s.okey), tiles });
}
