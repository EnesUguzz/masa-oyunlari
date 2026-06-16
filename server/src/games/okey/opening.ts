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
  removeTilesFromHand(me, tiles);
  consumeFloorIfLaid(s, tiles);
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
