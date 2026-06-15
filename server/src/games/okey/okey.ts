import type { NumberedTile, OkeyTile } from "./tile.js";
import { MAX_VALUE, MIN_VALUE, isNumbered } from "./tile.js";

export function determineOkey(indicator: NumberedTile): NumberedTile {
  const value = indicator.value === MAX_VALUE ? MIN_VALUE : indicator.value + 1;
  return { kind: "numbered", color: indicator.color, value };
}

export function isOkeyTile(tile: OkeyTile, okey: NumberedTile): boolean {
  return isNumbered(tile) && tile.color === okey.color && tile.value === okey.value;
}

export function isWildcard(tile: OkeyTile, okey: NumberedTile): boolean {
  return tile.kind === "fakeJoker" || isOkeyTile(tile, okey);
}
