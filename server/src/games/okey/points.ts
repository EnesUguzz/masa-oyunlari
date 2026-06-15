import type { NumberedTile, OkeyTile } from "./tile.js";
import { InvalidMoveError } from "../../core/errors/index.js";
import { isValidMeld, meldRepresentedValues } from "./meld.js";

export function tileValue(tile: NumberedTile): number {
  return tile.value;
}

/** Sum of the represented values of a valid meld. Throws on an invalid meld. */
export function meldValue(meld: readonly OkeyTile[], okey: NumberedTile): number {
  const values = meldRepresentedValues(meld, okey);
  if (values === null) {
    throw new InvalidMoveError("meld is not a valid run or set");
  }
  return values.reduce((sum, v) => sum + v, 0);
}

export function meldsTotal(melds: readonly (readonly OkeyTile[])[], okey: NumberedTile): number {
  return melds.reduce((sum, m) => sum + meldValue(m, okey), 0);
}

/**
 * Whether a set of melds is a legal opening: every meld valid AND the total
 * meets the threshold. minPoints defaults to 101 (katlamasız); 1b passes a
 * higher value for katlamalı escalation.
 */
export function canOpenWithMelds(
  melds: readonly (readonly OkeyTile[])[],
  okey: NumberedTile,
  minPoints = 101,
): boolean {
  if (!melds.every((m) => isValidMeld(m, okey))) return false;
  return meldsTotal(melds, okey) >= minPoints;
}
