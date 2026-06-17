import type { JSX } from "react";
import type { OkeyTile } from "./types.js";
import type { RackSlot } from "./rack-order.js";
import { Tile } from "./Tile.js";

export function Hand({
  slots, selected, onToggle, dragPos, onDragStartTile, onReorder, onDragEnd,
}: {
  slots: RackSlot[];
  selected: Set<number>;
  onToggle: (handIndex: number) => void;
  dragPos: number | null;
  onDragStartTile: (pos: number, tile: OkeyTile) => void;
  onReorder: (from: number, to: number) => void;
  onDragEnd: () => void;
}): JSX.Element {
  return (
    <div
      data-testid="hand"
      onDragEnd={onDragEnd}
      style={{ display: "flex", flexWrap: "wrap", padding: 8, background: "#f3f3f3", borderRadius: 8, minHeight: 56 }}
    >
      {slots.map((slot, pos) => (
        <span
          key={slot.handIndex}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (dragPos !== null) onReorder(dragPos, pos); }}
        >
          <Tile
            tile={slot.tile}
            selected={selected.has(slot.handIndex)}
            dragging={dragPos === pos}
            draggable
            onClick={() => onToggle(slot.handIndex)}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStartTile(pos, slot.tile); }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (dragPos !== null) onReorder(dragPos, pos); }}
          />
        </span>
      ))}
    </div>
  );
}
