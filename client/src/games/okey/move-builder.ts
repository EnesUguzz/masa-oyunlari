import type { Move, OkeyTile } from "./types.js";

export function tilesEqual(a: OkeyTile, b: OkeyTile): boolean {
  if (a.kind === "fakeJoker" && b.kind === "fakeJoker") return true;
  if (a.kind === "numbered" && b.kind === "numbered") return a.color === b.color && a.value === b.value;
  return false;
}
export function buildOpenMelds(groups: OkeyTile[][]): Move {
  return { kind: "openMelds", melds: groups };
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
