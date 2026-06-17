import type { JSX } from "react";
import { useState } from "react";
import type { Move, OkeyTile, OkeyTableView } from "./types.js";
import { Hand } from "./Hand.js";
import { Tile } from "./Tile.js";
import { Controls } from "./Controls.js";
import { Scoreboard } from "./Scoreboard.js";
import { useRackOrder } from "./rack-order.js";
import { buildDiscard, buildProcess } from "./move-builder.js";

export function OkeyTable({ table, onMove, onLeave }: { table: OkeyTableView; onMove: (move: Move) => void; onLeave?: () => void }): JSX.Element {
  const { view, seating } = table;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<{ pos: number; tile: OkeyTile } | null>(null);
  const { slots, move } = useRackOrder(view.yourHand);

  const yourTurn = view.turn === view.you;
  const me = view.players.find((p) => p.seat === view.you);
  const opened = me?.opened ?? false;
  const canAct = yourTurn && view.phase === "act";

  const toggle = (handIndex: number): void => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(handIndex)) next.delete(handIndex); else next.add(handIndex);
      return next;
    });
  };
  const clearSelection = (): void => setSelected(new Set());

  const selectedTiles: OkeyTile[] = [...selected]
    .sort((a, b) => a - b)
    .map((i) => view.yourHand[i])
    .filter((t): t is OkeyTile => t !== undefined);

  const nick = (seat: number): string => seating.find((s) => s.seat === seat)?.nickname ?? `#${seat}`;

  // Dropping a dragged tile onto the discard zone discards it (server validates).
  const dropToDiscard = (): void => {
    if (drag && canAct) { onMove(buildDiscard(drag.tile)); clearSelection(); }
    setDrag(null);
  };
  // Dropping a dragged tile onto a table meld processes it onto that meld.
  const dropToMeld = (meldId: string): void => {
    if (drag && canAct && opened) { onMove(buildProcess(meldId, [drag.tile])); clearSelection(); }
    setDrag(null);
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 360 }}>
        <p>
          Gösterge: <Tile tile={view.indicator} /> Okey: <Tile tile={view.okey} /> · Deste: {view.drawPileCount} · El {table.handNumber}
        </p>
        <p>Sıra: <strong>{nick(view.turn)}</strong> ({view.phase === "draw" ? "çekiyor" : "oynuyor"})</p>

        {table.match.status === "finished" && onLeave && (
          <p><button onClick={onLeave}>Lobiye Dön</button></p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
          {view.players.filter((p) => p.seat !== view.you).map((p) => (
            <div key={p.seat} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 6, minWidth: 120 }}>
              <strong>{nick(p.seat)}</strong>{view.turn === p.seat ? " ▶" : ""}
              <div>taş: {p.handCount}{p.opened ? ` · açtı (${p.openMode})` : ""}</div>
              <div>son atılan: {p.lastDiscard ? <Tile tile={p.lastDiscard} /> : "—"}</div>
            </div>
          ))}
        </div>

        <p style={{ marginBottom: 4 }}>Masadaki perler {opened ? "(taş sürükleyip pere bırakabilirsin)" : ""}:</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 52 }}>
          {view.tableMelds.length === 0 ? <em>henüz yok</em> : view.tableMelds.map((m) => {
            const isProcessTarget = m.kind !== "pair" && canAct && opened;
            return (
              <div
                key={m.id}
                onDragOver={(e) => { if (isProcessTarget) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); dropToMeld(m.id); }}
                style={{
                  border: `1px dashed ${isProcessTarget && drag ? "#2a7" : "#bbb"}`, borderRadius: 6, padding: 4,
                  background: isProcessTarget && drag ? "#eafaf0" : "transparent",
                }}
              >
                <small>{m.kind} #{m.id} ({nick(m.owner)})</small>
                <div style={{ display: "flex" }}>{m.tiles.map((t, i) => <Tile key={i} tile={t} />)}</div>
              </div>
            );
          })}
        </div>

        <p style={{ margin: "12px 0 4px" }}>Senin elin ({view.yourHand.length}):</p>
        <Hand
          slots={slots}
          selected={selected}
          onToggle={toggle}
          dragPos={drag ? drag.pos : null}
          onDragStartTile={(pos, tile) => setDrag({ pos, tile })}
          onReorder={(from, to) => { move(from, to); setDrag(null); }}
          onDragEnd={() => setDrag(null)}
        />

        <div
          onDragOver={(e) => { if (canAct) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); dropToDiscard(); }}
          style={{
            marginTop: 8, padding: "10px 12px", borderRadius: 8, textAlign: "center",
            border: `2px dashed ${canAct && drag ? "#c33" : "#ccc"}`,
            background: canAct && drag ? "#fdecec" : "#fafafa", color: "#a00", fontWeight: 600,
          }}
        >
          🗑 Atmak için taşı buraya sürükle
        </div>

        <div style={{ marginTop: 8 }}>
          <Controls view={view} selected={selectedTiles} onClearSelection={clearSelection} onMove={onMove} />
        </div>
      </div>
      <Scoreboard match={table.match} seating={seating} />
    </div>
  );
}
