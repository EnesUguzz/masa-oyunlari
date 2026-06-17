import type { Move, OkeyTile } from "./types.js";

export function tilesEqual(a: OkeyTile, b: OkeyTile): boolean {
  if (a.kind === "fakeJoker" && b.kind === "fakeJoker") return true;
  if (a.kind === "numbered" && b.kind === "numbered") return a.color === b.color && a.value === b.value;
  return false;
}
export function buildOpenMelds(groups: OkeyTile[][]): Move {
  return { kind: "openMelds", melds: groups };
}
export function buildAutoOpen(): Move {
  return { kind: "autoOpen" };
}
/** Split a flat selection into consecutive pairs of two for openPairs. */
export function buildOpenPairsFromSelection(selected: OkeyTile[]): Move {
  const pairs: OkeyTile[][] = [];
  for (let i = 0; i + 1 < selected.length; i += 2) pairs.push([selected[i]!, selected[i + 1]!]);
  return { kind: "openPairs", pairs };
}
export function buildOpenPairs(pairs: OkeyTile[][]): Move {
  return { kind: "openPairs", pairs };
}
export function buildProcess(meldId: string, tiles: OkeyTile[]): Move {
  return { kind: "processToMeld", meldId, tiles };
}
export function buildOpenNewMeld(tiles: OkeyTile[]): Move {
  return { kind: "openNewMeld", tiles };
}
export function buildDiscard(tile: OkeyTile): Move {
  return { kind: "discard", tile };
}
export function canDiscard(selected: OkeyTile[]): boolean {
  return selected.length === 1;
}
