import type { DragEvent, JSX } from "react";
import type { OkeyTile } from "./types.js";

const COLOR_HEX: Record<string, string> = { red: "#d33", yellow: "#ca0", black: "#222", blue: "#36c" };

export function Tile({
  tile, selected, dragging, onClick, draggable, onDragStart, onDragOver, onDrop,
}: {
  tile: OkeyTile;
  selected?: boolean;
  dragging?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}): JSX.Element {
  const label = tile.kind === "fakeJoker" ? "🃏" : String(tile.value);
  const color = tile.kind === "fakeJoker" ? "#666" : COLOR_HEX[tile.color] ?? "#222";
  return (
    <button
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        minWidth: 34, height: 46, margin: 2, fontSize: 18, fontWeight: 700,
        color, background: selected ? "#cdeffd" : "#fff",
        border: `2px solid ${selected ? "#08a" : "#bbb"}`, borderRadius: 6,
        cursor: draggable ? "grab" : onClick ? "pointer" : "default",
        opacity: dragging ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}
