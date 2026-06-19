import type { OkeyTile } from "./tile.js";

export type Move =
  | { kind: "drawFromPile" }
  | { kind: "drawFromDiscard" }
  | { kind: "returnFloorTile" }
  | { kind: "openMelds"; melds: OkeyTile[][] }
  | { kind: "autoOpen" }
  | { kind: "openPairs"; pairs: OkeyTile[][] }
  | { kind: "openNewMeld"; tiles: OkeyTile[] }
  | { kind: "processToMeld"; meldId: string; tiles: OkeyTile[] }
  | { kind: "swapOkey"; meldId: string; tile: OkeyTile }
  | { kind: "discard"; tile: OkeyTile };
