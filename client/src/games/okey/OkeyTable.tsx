import type { CSSProperties, DragEvent, JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Move, OkeyTile, OkeyTableView } from "./types.js";
import { SlottedRack } from "./SlottedRack.js";
import { Tile } from "./Tile.js";
import { useRackSlots, allGroups, RACK_ROWS, RACK_COLS } from "./rack-slots.js";
import { classifyOrdered, meldPoints, naturalValue, orderMeldForDisplay, okeySwapTile, type GroupKind } from "./meld-check.js";
import { arrangeMelds, arrangePairs } from "./arrange.js";
import { buildDiscard, buildProcess, buildOpenNewMeld } from "./move-builder.js";

// ---- Modern Kıraathane theme tokens (mirrors design-mockup.html) -------------------
const T = {
  felt1: "#15433a", felt2: "#0e2a25", feltEdge: "#0a201c",
  brass: "#d9a441", brassSoft: "#e8c578",
  onFelt: "#eae3d1", muted: "#9fb6ac",
  panel: "#142420", panelBorder: "#2c4138",
  btn: "#1e342d", btnBorder: "#334d43",
};
const PAGE_BG = "radial-gradient(120% 90% at 50% -10%, #20302b 0%, #0c1714 60%, #070f0d 100%)";

const FELT: CSSProperties = {
  position: "relative", borderRadius: 22, padding: 18,
  background: `radial-gradient(130% 100% at 50% 40%, ${T.felt1}, ${T.felt2} 70%, ${T.feltEdge} 100%)`,
  boxShadow: "inset 0 0 0 10px rgba(0,0,0,.18), inset 0 0 70px rgba(0,0,0,.45), 0 24px 60px rgba(0,0,0,.5)",
  border: "1px solid rgba(255,255,255,.05)",
};
const CHIP = (on: boolean): CSSProperties => ({
  font: "600 11px Inter,system-ui,sans-serif", letterSpacing: 0.3,
  color: on ? "#fff" : T.onFelt, background: "rgba(0,0,0,.26)",
  border: `1px solid ${on ? T.brass : "rgba(217,164,65,.4)"}`, padding: "4px 11px", borderRadius: 999,
});
const PANEL: CSSProperties = {
  background: T.panel, border: `1px solid ${T.panelBorder}`, borderRadius: 16, padding: 12,
  boxShadow: "0 14px 30px rgba(0,0,0,.35)",
};
const HBTN: CSSProperties = {
  font: "600 12.5px Inter,system-ui,sans-serif", color: T.onFelt, cursor: "pointer",
  background: T.btn, border: `1px solid ${T.btnBorder}`, borderRadius: 12, padding: "10px 8px",
  writingMode: "vertical-rl", transform: "rotate(180deg)", boxShadow: "0 2px 6px rgba(0,0,0,.25)",
};
const abtn = (variant: "primary" | "plain", disabled: boolean): CSSProperties => ({
  font: "600 14px Inter,system-ui,sans-serif", textAlign: "left", cursor: disabled ? "default" : "pointer",
  display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderRadius: 12, width: "100%",
  color: variant === "primary" ? "#1c1c1c" : T.onFelt,
  background: variant === "primary" ? `linear-gradient(160deg,${T.brassSoft},${T.brass})` : T.btn,
  border: variant === "primary" ? "1px solid transparent" : `1px solid ${T.btnBorder}`,
  boxShadow: variant === "primary" ? "0 4px 12px rgba(217,164,65,.3)" : "none",
  opacity: disabled ? 0.5 : 1,
});
const ICO: CSSProperties = {
  width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", font: "13px Inter",
  background: "rgba(0,0,0,.16)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)",
};

type Drag =
  | { kind: "slot"; from: number; tile: OkeyTile }
  | { kind: "deck" }
  | { kind: "floor"; tile: OkeyTile };

export function OkeyTable({ table, onMove, onLeave }: { table: OkeyTableView; onMove: (move: Move) => void; onLeave?: () => void }): JSX.Element {
  const { view, seating } = table;
  const me = view.players.find((p) => p.seat === view.you);
  const opened = me?.opened ?? false;
  const openMode = me?.openMode ?? null;
  const yourTurn = view.turn === view.you;
  const canAct = yourTurn && view.phase === "act";
  const canDraw = yourTurn && view.phase === "draw";
  const assist = view.config.assist;
  const okey = view.okey;
  const openThreshold = view.meldOpenNeed;
  const minPairs = view.pairOpenNeed;

  // full-bleed page background while at the table
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = PAGE_BG;
    return () => { document.body.style.background = prev; };
  }, []);

  const { slots, move, setSlots, setNextDrawSlot } = useRackSlots(view.yourHand);
  const [sel, setSel] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const clearDrag = (): void => setDrag(null);

  const groups = useMemo(() => allGroups(slots, RACK_ROWS, RACK_COLS), [slots]);
  const classed = useMemo(
    () => groups.map((g) => ({ g, kind: (g.tiles.length === 1 ? "single" : classifyOrdered(g.tiles, okey)) as GroupKind | "single" })),
    [groups, okey],
  );

  const validMeldGroups = classed.filter((x) => x.kind === "run" || x.kind === "set").map((x) => x.g.tiles);
  const validPairGroups = classed.filter((x) => x.kind === "pair").map((x) => x.g.tiles);
  const meldTotal = validMeldGroups.reduce((s, tiles) => s + meldPoints(tiles, okey), 0);

  const nick = (seat: number): string => seating.find((s) => s.seat === seat)?.nickname ?? `#${seat}`;
  const prevSeat = (view.you + 3) % 4;
  const myLastDiscard = me?.lastDiscard ?? null;
  const canReturn = canAct && view.pendingFloorTile !== null;
  const pairsOpenerExists = view.players.some((p) => p.opened && p.openMode === "pairs");
  const topSeat = (view.you + 2) % 4;
  const rightSeat = (view.you + 1) % 4;
  const leftSeat = prevSeat;

  // --- interactions ---------------------------------------------------------
  const drawInto = (to: number, mv: Move): void => {
    const target = slots[to] == null ? to : slots.findIndex((s) => s == null);
    if (target < 0) return;
    setNextDrawSlot(target);
    onMove(mv);
  };
  const dropToSlot = (to: number): void => {
    if (!drag) return;
    if (drag.kind === "slot") move(drag.from, to);
    else if (drag.kind === "deck" && canDraw) drawInto(to, { kind: "drawFromPile" });
    else if (drag.kind === "floor" && canDraw && view.pendingFloorTile === null) drawInto(to, { kind: "drawFromDiscard" });
    clearDrag();
  };
  const dropToDiscard = (): void => { if (drag?.kind === "slot" && canAct) onMove(buildDiscard(drag.tile)); clearDrag(); };
  const returnFloor = (): void => { onMove({ kind: "returnFloorTile" }); clearDrag(); setSel(null); };
  const dropToMeld = (meldId: string): void => { if (drag?.kind === "slot" && canAct && opened) onMove(buildProcess(meldId, [drag.tile])); clearDrag(); };

  const openWithMelds = (): void => { onMove({ kind: "openMelds", melds: validMeldGroups }); setSel(null); };
  const openWithPairs = (): void => { onMove({ kind: "openPairs", pairs: validPairGroups }); setSel(null); };
  const layMelds = (): void => { for (const tiles of validMeldGroups) onMove(buildOpenNewMeld(tiles)); setSel(null); };
  const layPairs = (): void => { for (const tiles of validPairGroups) onMove(buildOpenNewMeld(tiles)); setSel(null); };
  const arrangeSeri = (): void => { const next = arrangeMelds(view.yourHand, okey, RACK_ROWS, RACK_COLS); if (next) setSlots(next); setSel(null); };
  const arrangeCift = (): void => { const next = arrangePairs(view.yourHand, okey, RACK_ROWS, RACK_COLS); if (next) setSlots(next); setSel(null); };
  const autoProcess = (): void => { onMove({ kind: "autoProcess" }); setSel(null); };
  const undoTurn = (): void => { onMove({ kind: "undoTurn" }); setSel(null); };

  // "Seri Aç": opens with melds before opening, else lays further melds.
  const seriAc = (): void => (opened ? layMelds() : openWithMelds());
  const ciftAc = (): void => (opened ? layPairs() : openWithPairs());
  const canSeri = canAct && (!opened ? meldTotal >= openThreshold : openMode === "melds" && validMeldGroups.length > 0);
  const canCift = canAct && (!opened
    ? validPairGroups.length >= minPairs
    : (openMode === "pairs" || pairsOpenerExists) && validPairGroups.length > 0);

  // --- mini renderers -------------------------------------------------------
  const miniDigits = (nVal: number): JSX.Element[] => String(nVal).split("").map((d, i) => (
    <span key={i} style={{
      width: 12, height: 16, borderRadius: 2, display: "grid", placeItems: "center",
      font: '800 10px "Rubik",system-ui,sans-serif', color: "#c1121f",
      background: "linear-gradient(180deg,#fdfaf1,#ece1c9)", border: "1px solid #ddd1b6",
      boxShadow: "inset 0 1px 1px rgba(255,255,255,.7), 0 1px 2px rgba(0,0,0,.35)",
    }}>{d}</span>
  ));
  const openNeed = (value: number, dir: "left" | "right"): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title="El açmak için gereken">
      <span style={{ font: "800 14px Inter,sans-serif", color: T.brass, lineHeight: 1 }}>{dir === "right" ? "→" : "←"}</span>
      <div style={{ display: "flex", gap: 1 }}>{miniDigits(value)}</div>
    </div>
  );

  const seatChip = (seat: number): JSX.Element => {
    const p = view.players.find((x) => x.seat === seat);
    const active = view.turn === seat;
    return (
      <div style={{ textAlign: "center", color: T.onFelt, minWidth: 52 }}>
        <div style={{
          width: 40, height: 40, margin: "0 auto 3px", borderRadius: "50%",
          background: "linear-gradient(#d6ab63,#9a7338)", color: "#231a0c",
          display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px Inter,sans-serif",
          boxShadow: active ? `0 0 0 3px ${T.brass}, 0 0 14px ${T.brass}` : "0 2px 6px rgba(0,0,0,.45)",
        }}>{nick(seat).slice(0, 2).toUpperCase()}</div>
        <div style={{ font: "600 12px Inter,sans-serif" }}>{nick(seat)}{active ? " ▶" : ""}</div>
        {p?.opened && (
          <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 3 }}
            title={p.openMode === "pairs" ? "Bu kadar çiftle açtı" : "Bu puanla açtı"}>
            {miniDigits(p.openMode === "pairs" ? p.pairCount : p.openScore)}
          </div>
        )}
      </div>
    );
  };

  // A discard pile pinned at a table corner. Each player discards toward the next
  // player, so: topSeat→top-left, rightSeat→top-right, leftSeat→bottom-left (the
  // floor I draw from), mine→bottom-right. `seat === null` is my own pile.
  const discardCorner = (pos: CSSProperties, seat: number | null): JSX.Element => {
    const mine = seat === null;
    const isFloor = seat === leftSeat; // I draw from / return to the left player's pile
    const p = seat !== null ? view.players.find((x) => x.seat === seat) : null;
    const tile = mine ? myLastDiscard : (p?.lastDiscard ?? null);
    const dropDiscard = mine && canAct;
    const takeHere = isFloor && canDraw && tile !== null && view.pendingFloorTile === null;
    const returnHere = isFloor && canReturn;
    return (
      <div
        {...(mine ? { "data-testid": "my-discard" } : {})}
        onDragOver={dropDiscard || returnHere ? (e) => e.preventDefault() : undefined}
        onDrop={dropDiscard ? (e) => { e.preventDefault(); dropToDiscard(); }
          : returnHere ? (e) => { e.preventDefault(); returnFloor(); } : undefined}
        style={{
          position: "absolute", ...pos, zIndex: 5, padding: 2, borderRadius: 8,
          width: 44, height: 59, boxSizing: "border-box",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,.18)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)",
        }}>
        {takeHere && tile
          ? <span onDragEnd={clearDrag} style={{ display: "inline-block" }}>
              <Tile tile={tile} size="md" draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "copy"; setDrag({ kind: "floor", tile }); }} />
            </span>
          : tile ? <Tile tile={tile} size="md" />
          : null}
      </div>
    );
  };

  // --- value-aligned meld boards (fixed 13-row grids, like the mockup) -------
  // The series board is two value-halves of 13 columns (26 total): melds align to
  // their value column 1-13 in the left half; when the 13 rows fill up they spill
  // into the right half, separated by a white striped divider.
  const SROWS = 13, SHALF = 13, SCOLS = SHALF * 2, PCOLS = 6, CW = 21, CH = 28;
  const gridBg: CSSProperties = {
    background:
      "linear-gradient(rgba(0,0,0,.10),rgba(0,0,0,.10))," +
      `repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px ${CW}px),` +
      `repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px ${CH}px)`,
    borderRadius: 8, padding: 4, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)",
  };
  const boardTile = (t: OkeyTile, r: number, c: number, key: string): JSX.Element => (
    <div key={key} style={{ gridRow: r, gridColumn: c, width: CW, height: CH, fontSize: 13 }}>
      <Tile tile={t} fill />
    </div>
  );
  // Value-aligned start column within one 13-wide half (1..13).
  const meldStartCol = (kind: "run" | "set" | "pair", ordered: OkeyTile[]): number => {
    let raw = 1;
    if (kind === "run") {
      for (let i = 0; i < ordered.length; i++) { const nv = naturalValue(ordered[i]!, okey); if (nv) { raw = nv.value - i; break; } }
    } else {
      const nv = ordered.map((t) => naturalValue(t, okey)).find((x) => x !== null);
      raw = nv ? nv.value : 1;
    }
    return Math.max(1, Math.min(raw, SHALF - ordered.length + 1));
  };

  const runs = view.tableMelds.filter((m) => m.kind !== "pair");
  const pairs = view.tableMelds.filter((m) => m.kind === "pair");

  // Runs/pairs grouped by their owner, with a blank row between owners so you can
  // see at a glance which melds each player put down.
  const seriesBoard = (): JSX.Element => {
    const cells: JSX.Element[] = [];
    const strips: JSX.Element[] = [];
    const ordered = [...runs].sort((a, b) => a.owner - b.owner);
    let row = 0;
    let prevOwner: number | null = null;
    for (const m of ordered) {
      if (prevOwner !== null && m.owner !== prevOwner) row++; // blank gap row between owners
      if (row >= SROWS * 2) break;
      const half = row < SROWS ? 0 : 1; // first half fills up, then overflow right
      const gridRow = (row % SROWS) + 1;
      const tiles = orderMeldForDisplay(m.tiles, okey);
      const start = meldStartCol(m.kind, tiles) + half * SHALF;
      const target = canAct && opened;
      strips.push(
        <div key={`s${m.id}`}
          onDragOver={(e) => { if (target) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); dropToMeld(m.id); }}
          style={{ gridRow, gridColumn: half === 0 ? `1 / ${SHALF + 1}` : `${SHALF + 1} / -1` }} />,
      );
      tiles.forEach((t, i) => cells.push(boardTile(t, gridRow, start + i, `${m.id}-${i}`)));
      const swap = target ? okeySwapTile(m.tiles, m.kind, view.yourHand, okey) : null;
      if (swap) cells.push(
        <button key={`sw${m.id}`} onClick={() => onMove({ kind: "swapOkey", meldId: m.id, tile: swap })}
          title="Okeyi al" style={{ gridRow, gridColumn: Math.min(SCOLS, start + tiles.length), font: "10px Inter", cursor: "pointer", borderRadius: 5 }}>↔</button>,
      );
      prevOwner = m.owner;
      row++;
    }
    return (
      <div style={{ ...gridBg, position: "relative", display: "grid", gridTemplateColumns: `repeat(${SCOLS}, ${CW}px)`, gridTemplateRows: `repeat(${SROWS}, ${CH}px)` }}>
        {strips}{cells}
        {/* white striped divider between the two value-halves */}
        <div style={{
          position: "absolute", top: 4, bottom: 4, left: 4 + SHALF * CW - 1, width: 3, borderRadius: 2, pointerEvents: "none",
          background: "repeating-linear-gradient(45deg, rgba(255,255,255,.6) 0 2px, transparent 2px 5px)",
        }} />
      </div>
    );
  };

  const pairsBoard = (): JSX.Element => {
    const cells: JSX.Element[] = [];
    const ordered = [...pairs].sort((a, b) => a.owner - b.owner);
    let row = 0, col = 0;
    let prevOwner: number | null = null;
    for (const m of ordered) {
      if (prevOwner !== null && m.owner !== prevOwner) { row += col > 0 ? 2 : 1; col = 0; } // gap + fresh row per owner
      else if (col >= 3) { row++; col = 0; }
      if (row >= SROWS) break;
      const c = col * 2 + 1;
      orderMeldForDisplay(m.tiles, okey).forEach((t, i) => cells.push(boardTile(t, row + 1, c + i, `${m.id}-${i}`)));
      col++;
      prevOwner = m.owner;
    }
    return (
      <div style={{ ...gridBg, display: "grid", gridTemplateColumns: `repeat(${PCOLS}, ${CW}px)`, gridTemplateRows: `repeat(${SROWS}, ${CH}px)` }}>
        {cells}
      </div>
    );
  };

  return (
    <div className="okey-stage" style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 230px", gap: 16, alignItems: "start", color: T.onFelt, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`@media (max-width: 1180px){ .okey-stage{ grid-template-columns: 1fr !important; } }`}</style>

      {/* ---------------- left: table + rack ---------------- */}
      <div style={{ minWidth: 0 }}>
        <div style={FELT}>
          {/* faint felt weave */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 22, opacity: 0.06, pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 4px),repeating-linear-gradient(-45deg,#fff 0 1px,transparent 1px 4px)",
          }} />

          {/* discards pinned at the 4 corners (each player throws toward the next) */}
          {discardCorner({ top: 14, left: 16 }, topSeat)}
          {discardCorner({ top: 14, right: 16 }, rightSeat)}
          {discardCorner({ bottom: 14, left: 16 }, leftSeat)}
          {discardCorner({ bottom: 14, right: 16 }, null)}

          {/* tile I just took from the left player's pile — shown above it with a
              "Geri koy" caption; click (or drag onto a slot) to put it back */}
          {canReturn && view.pendingFloorTile && (
            <div style={{
              position: "absolute", bottom: 80, left: 12, zIndex: 6,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "rgba(0,0,0,.4)", borderRadius: 9, padding: 5, border: `1px solid ${T.brass}`,
            }}>
              <Tile tile={view.pendingFloorTile} size="sm" />
              <button onClick={returnFloor} style={{
                font: "700 11px Inter,sans-serif", cursor: "pointer", color: "#1c1c1c",
                background: `linear-gradient(160deg,${T.brassSoft},${T.brass})`, border: "none", borderRadius: 6, padding: "3px 9px",
              }}>Geri koy</button>
            </div>
          )}

          {/* top player */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>{seatChip(topSeat)}</div>

          {/* left seat | series · centre(gösterge/deste/mode) · pairs | right seat */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
            {seatChip(leftSeat)}

            <div style={{
              display: "grid", gridTemplateColumns: "auto auto auto auto auto", gap: 8, alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,.16)", borderRadius: 14, padding: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                {openNeed(view.meldOpenNeed, "right")}
                <span style={{ font: "9px Inter,sans-serif", color: T.muted }}>seri</span>
              </div>
              {seriesBoard()}
              {/* centre: gösterge / deste / oyun türleri */}
              <div style={{ display: "flex", flexDirection: "column", gap: 9, alignItems: "center" }}>
                <Tile tile={view.indicator} />
                <div
                  data-testid="draw-pile"
                  draggable={canDraw && view.drawPileCount > 0}
                  onDragStart={canDraw && view.drawPileCount > 0
                    ? (e) => { e.dataTransfer.effectAllowed = "copy"; setDrag({ kind: "deck" }); }
                    : undefined}
                  onDragEnd={clearDrag}
                  style={{
                    position: "relative", width: 40, height: 55, borderRadius: 7,
                    background: "linear-gradient(180deg,#fdfaf1,#ece1c9)",
                    boxShadow: "2px 2px 0 rgba(0,0,0,.18), 4px 4px 0 rgba(0,0,0,.12), 6px 8px 14px rgba(0,0,0,.45)",
                    cursor: canDraw && view.drawPileCount > 0 ? "grab" : "default",
                    outline: canDraw && view.drawPileCount > 0 ? `2px solid ${T.brass}` : "none",
                    display: "grid", placeItems: "center", font: '800 17px "Rubik",sans-serif', color: "rgba(40,40,40,.5)",
                  }}>{view.drawPileCount}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
                  <span style={CHIP(view.config.pairing === "esli")}>{view.config.pairing === "esli" ? "Eşli" : "Eşsiz"}</span>
                  <span style={CHIP(view.config.escalation === "katlamali")}>{view.config.escalation === "katlamali" ? "Katlamalı" : "Düz"}</span>
                  {assist === "destekli" && <span style={CHIP(false)}>Destekli</span>}
                </div>
              </div>
              {pairsBoard()}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                {openNeed(view.pairOpenNeed, "left")}
                <span style={{ font: "9px Inter,sans-serif", color: T.muted }}>çift</span>
              </div>
            </div>

            {seatChip(rightSeat)}
          </div>
        </div>

        {table.match.status === "finished" && onLeave && (
          <p style={{ margin: "10px 0 6px" }}><button onClick={onLeave}>Lobiye Dön</button></p>
        )}

        {/* perler toplamı badge above the rack */}
        <div style={{ display: "flex", justifyContent: "flex-end", maxWidth: 1000, margin: "10px auto 0" }}>
          <span style={{
            font: '700 21px "Rubik",sans-serif', color: "#1c1c1c",
            background: `linear-gradient(160deg,${T.brassSoft},${T.brass})`, padding: "5px 18px", borderRadius: 999,
            boxShadow: "0 3px 12px rgba(217,164,65,.45)",
          }}>{meldTotal}</span>
        </div>

        {/* rack flanked by arrange helpers */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "stretch", marginTop: 6 }}>
          {assist === "destekli" && (!opened || openMode === "pairs" || pairsOpenerExists)
            ? <button style={HBTN} onClick={arrangeCift} title="En iyi çiftlere dizer">Çift Diz</button>
            : <span />}
          <SlottedRack
            slots={slots}
            okey={okey}
            assist={assist}
            selected={sel}
            dragFrom={drag?.kind === "slot" ? drag.from : null}
            dragActive={drag !== null}
            onSelect={(i) => setSel((p) => (p === i ? null : i))}
            onDragStartSlot={(from, tile) => setDrag({ kind: "slot", from, tile })}
            onDropToSlot={dropToSlot}
            onDragEnd={clearDrag}
          />
          {assist === "destekli"
            ? <button style={HBTN} onClick={arrangeSeri} title="En yüksek puanlı serilere/gruplara dizer">Seri Diz</button>
            : <span />}
        </div>

      </div>

      {/* ---------------- right: scoreboard + action panel ---------------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={PANEL}>
          <div style={{ font: "700 13px Inter,sans-serif", letterSpacing: 1.2, textTransform: "uppercase", color: T.muted }}>Skor</div>
          <div style={{ font: "12px Inter,sans-serif", color: T.muted, marginBottom: 12 }}>El {table.match.handsPlayed}/{table.match.targetHands}</div>
          {[...seating].sort((a, b) => (table.match.seatTotals[a.seat] ?? 0) - (table.match.seatTotals[b.seat] ?? 0)).map((s) => {
            const meRow = s.seat === view.you;
            return (
              <div key={s.seat} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 10, marginTop: 2,
                background: meRow ? "linear-gradient(90deg, rgba(217,164,65,.22), transparent)" : "transparent",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                  background: `linear-gradient(145deg,${T.brassSoft},${T.brass})`, color: "#1d1d1d", font: "700 12px Inter,sans-serif",
                }}>{s.nickname.slice(0, 2).toUpperCase()}</span>
                <span style={{ flex: 1, font: "600 14px Inter,sans-serif" }}>{s.nickname}{s.seat === view.turn ? " ▶" : ""}</span>
                <span style={{ font: '700 16px "Rubik",sans-serif', color: meRow ? T.brass : T.onFelt }}>{table.match.seatTotals[s.seat] ?? 0}</span>
              </div>
            );
          })}
          {table.match.status === "finished" && table.match.winner && (
            <div style={{ marginTop: 10, font: "700 13px Inter,sans-serif", color: "#3fae6b" }}>
              Kazanan: {table.match.winner.kind === "seat" ? nick(table.match.winner.seat) : `Takım ${table.match.winner.team}`}
            </div>
          )}
        </div>

        {/* action panel — the four fixed actions */}
        <div style={{ ...PANEL, display: "flex", flexDirection: "column", gap: 9 }}>
          <button style={abtn(canSeri ? "primary" : "plain", !canSeri)} disabled={!canSeri} onClick={seriAc} title="Seri/grup aç ya da diz">
            <span style={ICO}>▦</span> Seri Aç <span style={{ marginLeft: "auto", font: '12px "Rubik"', opacity: 0.75 }}>{opened ? validMeldGroups.length : `${meldTotal}/${openThreshold}`}</span>
          </button>
          <button style={abtn("plain", !canCift)} disabled={!canCift} onClick={ciftAc} title="Çift aç ya da diz">
            <span style={ICO}>◫</span> Çift Aç <span style={{ marginLeft: "auto", font: '12px "Rubik"', opacity: 0.75 }}>{opened ? validPairGroups.length : `${validPairGroups.length}/${minPairs}`}</span>
          </button>
          <button style={abtn("plain", !view.canUndoTurn)} disabled={!view.canUndoTurn} onClick={undoTurn} title="Bu turda yaptıklarını geri al (atmadan önce)">
            <span style={ICO}>↺</span> Geri Topla
          </button>
          <button style={abtn("plain", !(canAct && opened))} disabled={!(canAct && opened)} onClick={autoProcess} title="İşlenebilen taşları masaya otomatik ekle">
            <span style={ICO}>⤵</span> Taşları İşle
          </button>
        </div>
      </div>
    </div>
  );
}
