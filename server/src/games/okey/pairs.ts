import type { NumberedTile, OkeyTile } from "./tile.js";
import { isNumbered, tilesEqual } from "./tile.js";
import { isWildcard } from "./okey.js";

export function isPair(a: OkeyTile, b: OkeyTile, okey: NumberedTile): boolean {
  if (isWildcard(a, okey) || isWildcard(b, okey)) return true;
  return tilesEqual(a, b);
}

/** Can the whole tile bag be split into valid pairs (wildcards fill singletons)? */
export function isAllPairs(tiles: readonly OkeyTile[], okey: NumberedTile): boolean {
  if (tiles.length === 0 || tiles.length % 2 !== 0) return false;

  const counts = new Map<string, number>();
  let wild = 0;
  for (const t of tiles) {
    if (isWildcard(t, okey)) {
      wild++;
      continue;
    }
    if (isNumbered(t)) {
      const key = `${t.color}:${t.value}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let singles = 0;
  for (const c of counts.values()) singles += c % 2;

  // Each leftover natural needs a wildcard; remaining wildcards must pair up.
  return wild >= singles && (wild - singles) % 2 === 0;
}

export function canOpenWithPairs(
  pairs: readonly (readonly OkeyTile[])[],
  okey: NumberedTile,
  minPairs = 5,
): boolean {
  if (pairs.length < minPairs) return false;
  return pairs.every((p) => p.length === 2 && isPair(p[0]!, p[1]!, okey));
}
