import type { NumberedTile, OkeyTile } from "./tile.js";
import { MAX_VALUE, MIN_VALUE, isNumbered } from "./tile.js";

export function determineOkey(indicator: NumberedTile): NumberedTile {
  const value = indicator.value === MAX_VALUE ? MIN_VALUE : indicator.value + 1;
  return { kind: "numbered", color: indicator.color, value };
}

export function isOkeyTile(tile: OkeyTile, okey: NumberedTile): boolean {
  return isNumbered(tile) && tile.color === okey.color && tile.value === okey.value;
}

/**
 * The wildcard ("okey") is ONLY the real okey-value tile (e.g. red 13 when the
 * indicator is red 12). It can stand in for any tile in a meld/pair.
 *
 * The fake joker (sahte okey) is NOT a wildcard: it is a concrete stand-in for
 * the okey-value tile itself (it can only be played as "red 13"), see
 * {@link naturalValue}.
 */
export function isWildcard(tile: OkeyTile, okey: NumberedTile): boolean {
  return isOkeyTile(tile, okey);
}

/**
 * The concrete numbered tile a tile contributes to a meld/pair, or `null` if it
 * is a wildcard (the real okey tile). A fake joker contributes the okey-value
 * tile (red 13 in the example) — it is a fixed tile, not a joker.
 */
export function naturalValue(tile: OkeyTile, okey: NumberedTile): NumberedTile | null {
  if (isOkeyTile(tile, okey)) return null; // wildcard
  if (tile.kind === "fakeJoker") return { kind: "numbered", color: okey.color, value: okey.value };
  return tile; // plain numbered tile
}
