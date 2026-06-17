import type { CSSProperties, DragEvent, JSX } from "react";
import type { OkeyTile } from "./types.js";

const COLOR_HEX: Record<string, string> = { red: "#c1121f", yellow: "#cf8a00", black: "#1d1d1d", blue: "#0d5bbf" };

export function Tile({
  tile, selected, dragging, onClick, draggable, onDragStart, onDragOver, onDrop, size = "md",
}: {
  tile: OkeyTile;
  selected?: boolean;
  dragging?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  size?: "sm" | "md";
}): JSX.Element {
  const isJoker = tile.kind === "fakeJoker";
  const label = isJoker ? "★" : String(tile.value);
  const color = isJoker ? "#7a5c32" : COLOR_HEX[tile.color] ?? "#1d1d1d";
  const dims = size === "sm" ? { w: 30, h: 42, f: 17 } : { w: 38, h: 54, f: 22 };

  const style: CSSProperties = {
    width: dims.w, height: dims.h, margin: 2, fontSize: dims.f, fontWeight: 800,
    fontFamily: "Georgia, serif", color,
    background: selected ? "#fbe6b2" : "#f4ecd8",
    border: `1px solid ${selected ? "#d4a017" : "#d8cdb0"}`,
    borderRadius: 6,
    boxShadow: selected
      ? "0 0 0 2px #d4a017, inset 0 1px 2px rgba(255,255,255,.7)"
      : "inset 0 1px 2px rgba(255,255,255,.7), 0 2px 3px rgba(0,0,0,.3)",
    cursor: draggable ? "grab" : onClick ? "pointer" : "default",
    opacity: dragging ? 0.35 : 1,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    lineHeight: 1, userSelect: "none",
  };

  return (
    <button onClick={onClick} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} style={style}>
      {label}
    </button>
  );
}
