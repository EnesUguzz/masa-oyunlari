import type { NumberedTile, OkeyTile } from "./tile.js";
import { MAX_VALUE, MIN_VALUE } from "./tile.js";
import { naturalValue } from "./okey.js";

function partition(
  tiles: readonly OkeyTile[],
  okey: NumberedTile,
): { naturals: NumberedTile[]; wild: number } {
  const naturals: NumberedTile[] = [];
  let wild = 0;
  for (const t of tiles) {
    // Only the real okey tile is a wildcard; the fake joker resolves to the
    // concrete okey-value tile (a natural), see naturalValue.
    const nat = naturalValue(t, okey);
    if (nat === null) wild++;
    else naturals.push(nat);
  }
  return { naturals, wild };
}

/** Represented values if `tiles` form a valid run, else null. */
function runValues(tiles: readonly OkeyTile[], okey: NumberedTile): number[] | null {
  const total = tiles.length;
  if (total < 3) return null;
  const { naturals } = partition(tiles, okey);
  if (naturals.length === 0) return null; // need at least one natural tile

  const color = naturals[0]!.color;
  if (!naturals.every((t) => t.color === color)) return null;

  const values = naturals.map((t) => t.value);
  if (new Set(values).size !== values.length) return null; // no duplicates

  const minNat = Math.min(...values);
  const maxNat = Math.max(...values);
  if (maxNat - minNat + 1 > total) return null; // naturals span wider than the run length

  // A run is a consecutive window [start, start+total-1] within [1,13] that
  // contains every natural value. Choose the highest feasible window so wildcards
  // represent the highest tiles (max sum).
  const startLow = Math.max(MIN_VALUE, maxNat - total + 1);
  const startHigh = Math.min(minNat, MAX_VALUE - total + 1);
  if (startLow > startHigh) return null;

  const start = startHigh;
  const result: number[] = [];
  for (let v = start; v < start + total; v++) result.push(v);
  return result;
}

/** Represented values if `tiles` form a valid set, else null. */
function setValues(tiles: readonly OkeyTile[], okey: NumberedTile): number[] | null {
  const total = tiles.length;
  if (total < 3 || total > 4) return null;
  const { naturals, wild } = partition(tiles, okey);
  if (naturals.length === 0) return null;

  const value = naturals[0]!.value;
  if (!naturals.every((t) => t.value === value)) return null;

  const colors = new Set(naturals.map((t) => t.color));
  if (colors.size !== naturals.length) return null; // distinct colors among naturals
  if (naturals.length + wild > 4) return null; // at most 4 colors

  return Array.from({ length: total }, () => value);
}

export function meldRepresentedValues(
  tiles: readonly OkeyTile[],
  okey: NumberedTile,
): number[] | null {
  return runValues(tiles, okey) ?? setValues(tiles, okey);
}

export function isValidRun(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  return runValues(tiles, okey) !== null;
}

export function isValidSet(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  return setValues(tiles, okey) !== null;
}

export function isValidMeld(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  return isValidRun(tiles, okey) || isValidSet(tiles, okey);
}
