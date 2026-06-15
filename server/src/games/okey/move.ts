import type { OkeyTile } from "./tile.js";

export type Move =
  | { kind: "drawFromPile" }
  | { kind: "drawFromDiscard" }
  | { kind: "openMelds"; melds: OkeyTile[][] }
  | { kind: "openPairs"; pairs: OkeyTile[][] }
  | { kind: "openNewMeld"; tiles: OkeyTile[] }
  | { kind: "processToMeld"; meldId: string; tiles: OkeyTile[] }
  | { kind: "discard"; tile: OkeyTile };
