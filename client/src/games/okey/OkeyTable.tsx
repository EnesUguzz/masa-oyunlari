import type { JSX } from "react";
import { useState } from "react";
import type { Move, OkeyTile, OkeyTableView } from "./types.js";
import { tilesEqual } from "./move-builder.js";
import { Hand } from "./Hand.js";
import { Tile } from "./Tile.js";
import { Controls } from "./Controls.js";
import { Scoreboard } from "./Scoreboard.js";

export function OkeyTable({ table, onMove }: { table: OkeyTableView; onMove: (move: Move) => void }): JSX.Element {
  const { view, seating } = table;
  const [selected, setSelected] = useState<OkeyTile[]>([]);

  const toggle = (index: number): void => {
    const tile = view.yourHand[index];
    if (!tile) return;
    setSelected((cur) => (cur.some((s) => tilesEqual(s, tile)) ? cur.filter((s) => !tilesEqual(s, tile)) : [...cur, tile]));
  };
  const nick = (seat: number): string => seating.find((s) => s.seat === seat)?.nickname ?? `#${seat}`;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 360 }}>
        <p>
          Gösterge: <Tile tile={view.indicator} /> Okey: <Tile tile={view.okey} /> · Deste: {view.drawPileCount} · El {table.handNumber}
        </p>
        <p>Sıra: <strong>{nick(view.turn)}</strong> ({view.phase === "draw" ? "çekiyor" : "oynuyor"})</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
          {view.players.filter((p) => p.seat !== view.you).map((p) => (
            <div key={p.seat} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 6, minWidth: 120 }}>
              <strong>{nick(p.seat)}</strong>{view.turn === p.seat ? " ▶" : ""}
              <div>taş: {p.handCount}{p.opened ? ` · açtı (${p.openMode})` : ""}</div>
              <div>son atılan: {p.lastDiscard ? <Tile tile={p.lastDiscard} /> : "—"}</div>
            </div>
          ))}
        </div>

        <p style={{ marginBottom: 4 }}>Masadaki perler:</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 52 }}>
          {view.tableMelds.length === 0 ? <em>henüz yok</em> : view.tableMelds.map((m) => (
            <div key={m.id} style={{ border: "1px dashed #bbb", borderRadius: 6, padding: 4 }}>
              <small>{m.kind} #{m.id} ({nick(m.owner)})</small>
              <div style={{ display: "flex" }}>{m.tiles.map((t, i) => <Tile key={i} tile={t} />)}</div>
            </div>
          ))}
        </div>

        <p style={{ margin: "12px 0 4px" }}>Senin elin ({view.yourHand.length}):</p>
        <Hand tiles={view.yourHand} selected={selected} onToggle={toggle} />
        <div style={{ marginTop: 8 }}>
          <Controls view={view} selected={selected} onClearSelection={() => setSelected([])} onMove={onMove} />
        </div>
      </div>
      <Scoreboard match={table.match} seating={seating} />
    </div>
  );
}
