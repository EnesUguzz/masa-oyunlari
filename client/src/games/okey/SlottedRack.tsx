import type { CSSProperties, DragEvent, JSX } from "react";
import type { AssistMode, NumberedTile, OkeyTile } from "./types.js";
import { RACK_COLS, sigToTile } from "./rack-slots.js";
import { isWildcard } from "./meld-check.js";
import { Tile } from "./Tile.js";

// The empty-rack render (walnut ıstaka on transparent bg, two equalized channels).
const RACK_SRC = "/okey-rack.png";
// Where each row's tiles rest, measured from the render: the shelf rails sit at
// ~47% and ~90% from the top, so the rows are anchored that far up from the bottom.
const TIER_BOTTOM = ["53.3%", "9.6%"];
// Tile size + gap expressed in cqw (% of the rack width) so 16 fit per row and the
// whole rack scales with its container.
const SLOT: CSSProperties = { width: "5.3cqw", height: "7.3cqw", flex: "0 0 auto", boxSizing: "border-box" };

/**
 * The player's rack (ıstaka). A walnut two-shelf render is the background; the two
 * rows of slots are positioned over its channels. Filled slots hold draggable tiles;
 * empty slots are transparent gaps (and drop targets) that show the wood and separate
 * groups — that is how the player forms melds/pairs directly on the rack.
 */
export function SlottedRack({
  slots, okey, assist, selected, dragFrom, dragActive,
  onSelect, onDragStartSlot, onDropToSlot, onDragEnd,
}: {
  slots: (string | null)[];
  okey: NumberedTile;
  assist: AssistMode;
  selected: number | null;
  dragFrom: number | null;
  dragActive: boolean;
  onSelect: (slotIndex: number) => void;
  onDragStartSlot: (slotIndex: number, tile: OkeyTile) => void;
  onDropToSlot: (slotIndex: number) => void;
  onDragEnd: () => void;
}): JSX.Element {
  const cell = (idx: number): JSX.Element => {
    const sig = slots[idx] ?? null;
    const onDrop = (e: DragEvent): void => { e.preventDefault(); if (dragActive) onDropToSlot(idx); };
    if (sig === null) {
      return (
        <div
          key={idx}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          style={{ ...SLOT, borderRadius: "14%", background: "transparent" }}
        />
      );
    }
    const tile = sigToTile(sig);
    const faceDown = assist === "destekli" && isWildcard(tile, okey);
    return (
      <div
        key={idx}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{ ...SLOT, position: "relative", fontSize: "3.1cqw", borderRadius: "14%" }}
      >
        <Tile
          tile={tile}
          fill
          faceDown={faceDown}
          selected={selected === idx}
          dragging={dragFrom === idx}
          draggable
          onClick={() => onSelect(idx)}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); onDragStartSlot(idx, tile); }}
        />
      </div>
    );
  };

  const tiers: JSX.Element[] = [];
  for (let r = 0; r < 2; r++) {
    const cells: JSX.Element[] = [];
    for (let c = 0; c < RACK_COLS; c++) cells.push(cell(r * RACK_COLS + c));
    tiers.push(
      <div key={r} style={{
        position: "absolute", left: "5.5%", right: "5.5%", bottom: TIER_BOTTOM[r],
        display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 0,
      }}>{cells}</div>,
    );
  }

  return (
    <div
      data-testid="hand"
      onDragEnd={onDragEnd}
      style={{
        position: "relative", width: "100%", maxWidth: 1000, margin: "0 auto",
        aspectRatio: "946 / 167", containerType: "inline-size",
        backgroundImage: `url(${RACK_SRC})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        filter: "drop-shadow(0 12px 18px rgba(0,0,0,.5))",
      }}
    >
      {tiers}
    </div>
  );
}
