import type { CSSProperties, DragEvent, JSX } from "react";
import type { OkeyTile } from "./types.js";

const COLOR_HEX: Record<string, string> = { red: "#c1121f", yellow: "#cf8a00", black: "#222", blue: "#0d5bbf" };

export function Tile({
  tile, selected, dragging, onClick, draggable, onDragStart, onDragOver, onDrop,
  size = "md", faceDown = false, fill = false,
}: {
  tile: OkeyTile;
  selected?: boolean;
  dragging?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  // sm/md render at a fixed pixel size (melds, discards, indicator); fill stretches
  // to the parent box and inherits its font-size (used by the rack, sized in cqw).
  size?: "sm" | "md";
  // Render as a plain face-down back (no number/mark). Used in assisted mode to
  // show the okey/wildcard tiles closed — the player still drags/selects them.
  faceDown?: boolean;
  fill?: boolean;
}): JSX.Element {
  const isJoker = tile.kind === "fakeJoker";
  const label = isJoker ? "★" : tile.kind === "numbered" ? String(tile.value) : "";
  const color = isJoker ? "#7a5c32" : tile.kind === "numbered" ? COLOR_HEX[tile.color] ?? "#222" : "#222";
  const dims = size === "sm" ? { w: 30, h: 41, f: 19 } : { w: 40, h: 55, f: 26 };

  const box: CSSProperties = fill
    ? { width: "100%", height: "100%", fontSize: "inherit" }
    : { width: dims.w, height: dims.h, fontSize: dims.f };

  const style: CSSProperties = {
    ...box, position: "relative", boxSizing: "border-box",
    fontFamily: '"Rubik", system-ui, sans-serif', fontWeight: 800, lineHeight: 1, color,
    background: faceDown
      ? "linear-gradient(180deg,#6b4f2a,#4a3517)"
      : "linear-gradient(180deg,#fdfaf1 0%,#f4ecda 70%,#ece1c9 100%)",
    border: `1px solid ${faceDown ? "#3a2912" : "#ddd1b6"}`,
    borderRadius: "14%",
    boxShadow: selected
      ? "0 0 0 2px #d4a017, inset 0 1.5px 1.5px rgba(255,255,255,.9)"
      : "inset 0 1.5px 1.5px rgba(255,255,255,.95), inset 0 -1.5px 2px rgba(120,96,52,.14), 0 3px 5px rgba(0,0,0,.35)",
    cursor: draggable ? "grab" : onClick ? "pointer" : "default",
    opacity: dragging ? 0.35 : 1,
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    paddingTop: "13%", userSelect: "none",
  };

  // number sits in the upper-centre; round finger-hollow in the lower-centre
  return (
    <button onClick={onClick} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} style={style}>
      {!faceDown && <span>{label}</span>}
      {!faceDown && (
        <span style={{
          position: "absolute", left: "50%", bottom: "10%", transform: "translateX(-50%)",
          width: "25%", aspectRatio: "1", borderRadius: "50%",
          background: "radial-gradient(circle at 50% 40%, rgba(86,66,38,.20), rgba(86,66,38,.06) 60%, transparent 74%)",
          boxShadow: "inset 0 1px 1px rgba(0,0,0,.2), inset 0 -1px 1px rgba(255,255,255,.8)",
        }} />
      )}
    </button>
  );
}
