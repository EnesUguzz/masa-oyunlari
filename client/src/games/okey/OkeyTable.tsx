import type { CSSProperties, JSX } from "react";
import { useMemo, useState } from "react";
import type { Move, OkeyTile, OkeyTableView } from "./types.js";
import { Hand } from "./Hand.js";
import { Tile } from "./Tile.js";
import { Scoreboard } from "./Scoreboard.js";
import { useRackOrder, tileSig } from "./rack-order.js";
import { classifyGroup, meldPoints } from "./meld-check.js";
import { buildDiscard, buildProcess } from "./move-builder.js";

const FELT: CSSProperties = {
  background: "radial-gradient(ellipse at 50% 45%, #2c6e49, #1d5236 62%, #173f2b)",
  borderRadius: 12, padding: 16, position: "relative",
  boxShadow: "inset 0 0 0 3px #5a4128, 0 10px 28px rgba(0,0,0,.4)",
};
const LABEL: CSSProperties = { color: "#e7e0cf", font: "13px Georgia, serif" };

function multiset(tiles: readonly OkeyTile[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tiles) m.set(tileSig(t), (m.get(tileSig(t)) ?? 0) + 1);
  return m;
}

export function OkeyTable({ table, onMove, onLeave }: { table: OkeyTableView; onMove: (move: Move) => void; onLeave?: () => void }): JSX.Element {
  const { view, seating } = table;
  const me = view.players.find((p) => p.seat === view.you);
  const opened = me?.opened ?? false;
  const openMode = me?.openMode ?? null;
  const yourTurn = view.turn === view.you;
  const canAct = yourTurn && view.phase === "act";

  // Tiles dragged into staging bins leave the rack (tracked by tile object identity-free signatures).
  const [bins, setBins] = useState<OkeyTile[][]>([]);
  const [drag, setDrag] = useState<{ pos: number; tile: OkeyTile } | null>(null);
  const [sel, setSel] = useState<number | null>(null); // selected rack slot index (into unstaged), for the At button

  // Rack = hand minus tiles currently staged in bins (by multiset).
  const unstaged = useMemo(() => {
    const staged = multiset(bins.flat());
    const out: OkeyTile[] = [];
    for (const t of view.yourHand) {
      const k = tileSig(t);
      const c = staged.get(k) ?? 0;
      if (c > 0) staged.set(k, c - 1);
      else out.push(t);
    }
    return out;
  }, [view.yourHand, bins]);

  const { slots, move } = useRackOrder(unstaged);

  const nick = (seat: number): string => seating.find((s) => s.seat === seat)?.nickname ?? `#${seat}`;
  const clearDrag = (): void => setDrag(null);
  const resetBins = (): void => setBins([]);

  const addToBin = (binIdx: number, tile: OkeyTile): void => {
    setBins((bs) => bs.map((b, i) => (i === binIdx ? [...b, tile] : b)));
  };
  const dropToNewBin = (tile: OkeyTile): void => setBins((bs) => [...bs, [tile]]);
  const returnBin = (binIdx: number): void => setBins((bs) => bs.filter((_, i) => i !== binIdx));

  const dropToDiscard = (): void => {
    if (drag && canAct) onMove(buildDiscard(drag.tile));
    clearDrag();
  };
  const dropToMeld = (meldId: string): void => {
    if (drag && canAct && opened) onMove(buildProcess(meldId, [drag.tile]));
    clearDrag();
  };

  // --- staging-driven moves -------------------------------------------------
  const filled = bins.filter((b) => b.length > 0);
  const allMelds = filled.length > 0 && filled.every((b) => classifyGroup(b, view.okey, "melds") !== "invalid");
  const allPairs = filled.length > 0 && filled.every((b) => classifyGroup(b, view.okey, "pairs") === "pair");
  const stagedPoints = filled.reduce((s, b) => s + meldPoints(b, view.okey), 0);

  const openWithMelds = (): void => { onMove({ kind: "openMelds", melds: filled }); resetBins(); };
  const openWithPairs = (): void => { onMove({ kind: "openPairs", pairs: filled }); resetBins(); };
  const layStagedMelds = (): void => { for (const b of filled) onMove({ kind: "openNewMeld", tiles: b }); resetBins(); };
  const autoOpen = (): void => { onMove({ kind: "autoOpen" }); resetBins(); };

  const seatBox = (seat: number): JSX.Element | null => {
    const p = view.players.find((x) => x.seat === seat);
    if (!p) return null;
    const active = view.turn === seat;
    return (
      <div style={{ textAlign: "center", color: "#e7e0cf", minWidth: 92 }}>
        <div style={{
          width: 40, height: 40, margin: "0 auto 3px", borderRadius: "50%",
          background: "linear-gradient(#b9924f,#7c5e30)", color: "#1d1d1d",
          display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px Georgia,serif",
          boxShadow: active ? "0 0 0 3px #f2c14e, 0 0 12px #f2c14e" : "0 2px 5px rgba(0,0,0,.4)",
        }}>{nick(seat).slice(0, 3)}</div>
        <div style={{ font: "12px Georgia,serif" }}>{nick(seat)}{active ? " ▶" : ""}</div>
        <div style={{ font: "11px Georgia,serif", opacity: 0.85 }}>
          {p.handCount} taş{p.opened ? ` · açtı (${p.openMode === "pairs" ? "çift" : "per"})` : ""}
        </div>
        <div style={{ marginTop: 2 }}>son: {p.lastDiscard ? <Tile tile={p.lastDiscard} size="sm" /> : "—"}</div>
      </div>
    );
  };

  const opponents = view.players.filter((p) => p.seat !== view.you).map((p) => p.seat);

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: "Georgia, serif" }}>
      <div style={{ flex: 1, minWidth: 420, maxWidth: 760 }}>
        <div style={FELT}>
          {/* opponents */}
          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 10 }}>
            {opponents.map((s) => <div key={s}>{seatBox(s)}</div>)}
          </div>

          {/* center: deste + gösterge */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, margin: "6px 0 12px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                position: "relative", width: 38, height: 54, borderRadius: 6, margin: "0 auto",
                background: "#f4ecd8", boxShadow: "2px 2px 0 #e0d8c2, 4px 4px 0 #d2c9b0, 6px 7px 12px rgba(0,0,0,.4)",
              }}>
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", font: "800 18px Georgia,serif", color: "rgba(40,40,40,.4)" }}>{view.drawPileCount}</span>
              </div>
              <div style={LABEL}>deste</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <Tile tile={view.indicator} />
              <div style={LABEL}>gösterge · okey {view.okey.kind === "numbered" ? `${view.okey.value}` : ""}</div>
            </div>
          </div>

          {/* table melds */}
          <div style={{ minHeight: 64, background: "rgba(0,0,0,.16)", borderRadius: 8, padding: 8 }}>
            <div style={{ ...LABEL, marginBottom: 4, opacity: 0.8 }}>Masadaki perler {opened ? "· taş sürükleyip işle" : ""}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {view.tableMelds.length === 0
                ? <em style={{ color: "#9fbfa9" }}>henüz yok</em>
                : view.tableMelds.map((m) => {
                  const target = m.kind !== "pair" && canAct && opened;
                  return (
                    <div key={m.id}
                      onDragOver={(e) => { if (target) e.preventDefault(); }}
                      onDrop={(e) => { e.preventDefault(); dropToMeld(m.id); }}
                      style={{
                        border: `1px dashed ${target && drag ? "#5fd08a" : "rgba(255,255,255,.25)"}`, borderRadius: 6, padding: 4,
                        background: target && drag ? "rgba(95,208,138,.15)" : "transparent",
                      }}>
                      <div style={{ color: "#bfe0cd", font: "10px Georgia,serif" }}>{m.kind === "pair" ? "çift" : m.kind} · {nick(m.owner)}</div>
                      <div style={{ display: "flex" }}>{m.tiles.map((t, i) => <Tile key={i} tile={t} size="sm" />)}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* turn status */}
        <p style={{ margin: "10px 0 6px" }}>
          Sıra: <strong>{nick(view.turn)}</strong> {yourTurn ? "(sende)" : ""} · {view.phase === "draw" ? "çekme" : "oynama"}
          {table.match.status === "finished" && onLeave && <> · <button onClick={onLeave}>Lobiye Dön</button></>}
        </p>

        {/* draw controls */}
        {view.phase === "draw" && yourTurn && (
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => onMove({ kind: "drawFromPile" })}>Desteden çek ({view.drawPileCount})</button>
            <button onClick={() => onMove({ kind: "drawFromDiscard" })}>Yerden al</button>
          </div>
        )}

        {/* meld staging */}
        {canAct && (
          <div style={{ border: "1px solid #d8cdb0", borderRadius: 8, padding: 10, margin: "8px 0", background: "#faf6ec" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <strong style={{ font: "14px Georgia,serif" }}>Per kur (taşları sürükle)</strong>
              <span style={{ font: "12px Georgia,serif", color: "#666" }}>
                {opened ? `açtın (${openMode === "pairs" ? "çift" : "per"})` : `açış puanı: ${stagedPoints} / 101`}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {bins.map((b, i) => {
                const kind = classifyGroup(b, view.okey, allPairs && !allMelds ? "pairs" : "melds");
                const ok = kind !== "invalid";
                const pts = meldPoints(b, view.okey);
                return (
                  <div key={i}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (drag) { addToBin(i, drag.tile); clearDrag(); } }}
                    style={{
                      border: `2px dashed ${b.length === 0 ? "#bbb" : ok ? "#2a9d4a" : "#c44"}`,
                      borderRadius: 8, padding: 6, minWidth: 90, background: "#fff",
                    }}>
                    <div style={{ font: "10px Georgia,serif", color: ok ? "#2a7d32" : "#b33", marginBottom: 2 }}>
                      {b.length === 0 ? "boş — taş bırak" : ok ? `✓ ${kind === "pair" ? "çift" : kind === "run" ? "seri" : "grup"}${pts ? ` ${pts}p` : ""}` : "✗ geçersiz"}
                    </div>
                    <div style={{ display: "flex", minHeight: 44 }}>{b.map((t, j) => <Tile key={j} tile={t} size="sm" />)}</div>
                    <button style={{ marginTop: 4, font: "11px Georgia,serif" }} onClick={() => returnBin(i)}>↩ geri</button>
                  </div>
                );
              })}
              <button
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (drag) { dropToNewBin(drag.tile); clearDrag(); } }}
                onClick={() => setBins((bs) => [...bs, []])}
                style={{ minWidth: 90, minHeight: 80, border: "2px dashed #aaa", borderRadius: 8, background: "#f4f4f4", cursor: "pointer" }}>
                + yeni grup<br />(buraya sürükle)
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {!opened && <button disabled={!allMelds || stagedPoints < 101} onClick={openWithMelds}>Perlerle Aç ({stagedPoints}/101)</button>}
              {!opened && <button disabled={!allPairs || filled.length < 5} onClick={openWithPairs}>Çiftlerle Aç ({filled.length}/5)</button>}
              {opened && openMode === "melds" && <button disabled={!allMelds} onClick={layStagedMelds}>Perleri Diz</button>}
              {opened && openMode === "pairs" && <button disabled={!allPairs} onClick={layStagedMelds}>Çiftleri Diz</button>}
              <button onClick={autoOpen} title="Elindeki tüm geçerli perleri otomatik açar/dizer">Otomatik {opened ? "Diz" : "Aç"}</button>
              {bins.length > 0 && <button onClick={resetBins}>Temizle</button>}
            </div>
          </div>
        )}

        {/* my rack */}
        <div style={{ background: "linear-gradient(#b58a52,#8a6532)", borderRadius: 12, padding: 10, border: "3px solid #f2c14e", boxShadow: "inset 0 2px 4px rgba(255,255,255,.25)" }}>
          <div style={{ ...LABEL, marginBottom: 4 }}>Senin elin ({view.yourHand.length}) — {unstaged.length} rafta, {bins.flat().length} kuruluyor</div>
          <Hand
            slots={slots}
            selected={sel !== null ? new Set([sel]) : new Set()}
            onToggle={(i) => setSel((p) => (p === i ? null : i))}
            dragPos={drag ? drag.pos : null}
            onDragStartTile={(pos, tile) => setDrag({ pos, tile })}
            onReorder={(from, to) => { move(from, to); clearDrag(); }}
            onDragEnd={clearDrag}
          />
        </div>

        {/* discard: tap a tile then "At", or drag a tile onto the zone */}
        {canAct && (
          <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginTop: 8 }}>
            <button
              disabled={sel === null}
              onClick={() => { if (sel !== null && unstaged[sel]) { onMove(buildDiscard(unstaged[sel]!)); setSel(null); } }}
              style={{ fontWeight: 700 }}>
              At (seçili)
            </button>
            <div
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); dropToDiscard(); }}
              style={{
                flex: 1, padding: "10px", borderRadius: 8, textAlign: "center",
                border: `2px dashed ${drag ? "#c33" : "#ccc"}`,
                background: drag ? "#fdecec" : "#fafafa", color: "#a00", fontWeight: 700,
              }}>
              🗑 ya da taşı buraya sürükle
            </div>
          </div>
        )}
      </div>
      <Scoreboard match={table.match} seating={seating} />
    </div>
  );
}
