import type { JSX } from "react";
import type { OkeyTile } from "./types.js";
import { Tile } from "./Tile.js";
import { tilesEqual } from "./move-builder.js";

export function Hand({ tiles, selected, onToggle }: { tiles: OkeyTile[]; selected: OkeyTile[]; onToggle: (index: number) => void }): JSX.Element {
  const isSel = (t: OkeyTile): boolean => selected.some((s) => tilesEqual(s, t));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", padding: 8, background: "#f3f3f3", borderRadius: 8 }}>
      {tiles.map((t, i) => (
        <Tile key={i} tile={t} selected={isSel(t)} onClick={() => onToggle(i)} />
      ))}
    </div>
  );
}
