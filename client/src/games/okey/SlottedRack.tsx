import type { CSSProperties, JSX } from "react";
import type { AssistMode, NumberedTile, OkeyTile } from "./types.js";
import { RACK_COLS, RACK_ROWS, sigToTile } from "./rack-slots.js";
import { isWildcard, type GroupKind } from "./meld-check.js";
import { Tile } from "./Tile.js";

const EMPTY_BORDER = "rgba(255,255,255,.22)";
const KIND_COLOR: Record<GroupKind | "single", string> = {
  run: "#2a9d4a", set: "#2a9d4a", pair: "#2a9d4a", invalid: "#d4533f", single: EMPTY_BORDER,
};

/**
 * The player's rack: a fixed grid of slots. Filled slots hold draggable tiles;
 * empty slots are gaps (and drop targets) that separate groups. The slot border
 * is tinted by the contiguous group's classification so the player gets live
 * meld feedback while arranging tiles.
 */
export function SlottedRack({
  slots, okey, assist, selected, dragFrom, slotKind, floorSig,
  onSelect, onDragStartSlot, onDropToSlot, onDragEnd,
}: {
  slots: (string | null)[];
  okey: NumberedTile;
  assist: AssistMode;
  selected: number | null;
  dragFrom: number | null;
  slotKind: (slotIndex: number) => GroupKind | "single";
  // Signature of the tile just taken from the floor (to highlight it), if any.
  floorSig: string | null;
  onSelect: (slotIndex: number) => void;
  onDragStartSlot: (slotIndex: number, tile: OkeyTile) => void;
  onDropToSlot: (slotIndex: number) => void;
  onDragEnd: () => void;
}): JSX.Element {
  const cellBase: CSSProperties = {
    width: 40, height: 56, display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 7, boxSizing: "border-box",
  };

  const rows: JSX.Element[] = [];
  for (let r = 0; r < RACK_ROWS; r++) {
    const cells: JSX.Element[] = [];
    for (let c = 0; c < RACK_COLS; c++) {
      const idx = r * RACK_COLS + c;
      const sig = slots[idx] ?? null;
      const kind = slotKind(idx);
      const border = sig === null ? EMPTY_BORDER : KIND_COLOR[kind];
      if (sig === null) {
        cells.push(
          <div
            key={idx}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) onDropToSlot(idx); }}
            style={{ ...cellBase, border: `2px dashed ${border}`, background: "rgba(0,0,0,.12)" }}
          />,
        );
      } else {
        const tile = sigToTile(sig);
        const faceDown = assist === "destekli" && isWildcard(tile, okey);
        const isFloor = floorSig !== null && sig === floorSig;
        cells.push(
          <div
            key={idx}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) onDropToSlot(idx); }}
            style={{
              ...cellBase, border: `2px solid ${border}`, background: "rgba(255,255,255,.06)",
              boxShadow: isFloor ? "0 0 0 3px #f2c14e, 0 0 10px #f2c14e" : undefined,
            }}
          >
            <Tile
              tile={tile}
              size="md"
              faceDown={faceDown}
              selected={selected === idx}
              dragging={dragFrom === idx}
              draggable
              onClick={() => onSelect(idx)}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); onDragStartSlot(idx, tile); }}
            />
          </div>,
        );
      }
    }
    rows.push(
      <div key={r} style={{ display: "flex", gap: 4, marginBottom: r === 0 ? 6 : 0 }}>{cells}</div>,
    );
  }

  return (
    <div data-testid="hand" onDragEnd={onDragEnd} style={{ display: "inline-block" }}>
      {rows}
    </div>
  );
}
