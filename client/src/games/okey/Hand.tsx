import type { JSX } from "react";
import type { OkeyTile } from "./types.js";
import { Tile } from "./Tile.js";

export function Hand({ tiles, selectedIndices, onToggle }: { tiles: OkeyTile[]; selectedIndices: Set<number>; onToggle: (index: number) => void }): JSX.Element {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", padding: 8, background: "#f3f3f3", borderRadius: 8 }}>
      {tiles.map((t, i) => (
        <Tile key={i} tile={t} selected={selectedIndices.has(i)} onClick={() => onToggle(i)} />
      ))}
    </div>
  );
}
