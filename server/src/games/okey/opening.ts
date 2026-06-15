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
