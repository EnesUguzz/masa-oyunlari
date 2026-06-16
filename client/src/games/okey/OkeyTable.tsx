import type { JSX } from "react";
import { useState } from "react";
import type { Move, OkeyTile, OkeyTableView } from "./types.js";
import { Hand } from "./Hand.js";
import { Tile } from "./Tile.js";
import { Controls } from "./Controls.js";
import { Scoreboard } from "./Scoreboard.js";

export function OkeyTable({ table, onMove, onLeave }: { table: OkeyTableView; onMove: (move: Move) => void; onLeave?: () => void }): JSX.Element {
  const { view, seating } = table;
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (index: number): void => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const selectedTiles: OkeyTile[] = [...selected]
    .sort((a, b) => a - b)
    .map((i) => view.yourHand[i])
    .filter((t): t is OkeyTile => t !== undefined);

  const nick = (seat: number): string => seating.find((s) => s.seat === seat)?.nickname ?? `#${seat}`;

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
        <Hand tiles={view.yourHand} selectedIndices={selected} onToggle={toggle} />
        <div style={{ marginTop: 8 }}>
          <Controls view={view} selected={selectedTiles} onClearSelection={() => setSelected(new Set())} onMove={onMove} />
        </div>
      </div>
      <Scoreboard match={table.match} seating={seating} />
    </div>
  );
}
