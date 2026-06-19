import type { CSSProperties, JSX } from "react";
import { useMemo, useState } from "react";
import type { Move, OkeyTile, OkeyTableView } from "./types.js";
import { SlottedRack } from "./SlottedRack.js";
import { Tile } from "./Tile.js";
import { Scoreboard } from "./Scoreboard.js";
import { useRackSlots, allGroups, sigToTile, RACK_ROWS, RACK_COLS } from "./rack-slots.js";
import { tileSig } from "./rack-order.js";
import { classifyOrdered, meldPoints, naturalValue, orderMeldForDisplay, type GroupKind } from "./meld-check.js";
import { arrangeMelds, arrangePairs } from "./arrange.js";
import { buildDiscard, buildProcess, buildOpenNewMeld } from "./move-builder.js";

const FELT: CSSProperties = {
  background: "radial-gradient(ellipse at 50% 45%, #2c6e49, #1d5236 62%, #173f2b)",
  borderRadius: 12, padding: 16, position: "relative",
  boxShadow: "inset 0 0 0 3px #5a4128, 0 10px 28px rgba(0,0,0,.4)",
};
const LABEL: CSSProperties = { color: "#e7e0cf", font: "13px Georgia, serif" };

export function OkeyTable({ table, onMove, onLeave }: { table: OkeyTableView; onMove: (move: Move) => void; onLeave?: () => void }): JSX.Element {
  const { view, seating } = table;
  const me = view.players.find((p) => p.seat === view.you);
  const opened = me?.opened ?? false;
  const openMode = me?.openMode ?? null;
  const yourTurn = view.turn === view.you;
  const canAct = yourTurn && view.phase === "act";
  const assist = view.config.assist;
  const okey = view.okey;
  const openThreshold = view.config.openThreshold;
  const minPairs = view.config.minPairs;

  const { slots, move, setSlots } = useRackSlots(view.yourHand);
  const [sel, setSel] = useState<number | null>(null); // selected rack slot
  const [drag, setDrag] = useState<{ from: number; tile: OkeyTile } | null>(null);
  const clearDrag = (): void => setDrag(null);

  // Contiguous rack groups → live meld/pair classification.
  const groups = useMemo(() => allGroups(slots, RACK_ROWS, RACK_COLS), [slots]);
  const classed = useMemo(
    () => groups.map((g) => ({ g, kind: (g.tiles.length === 1 ? "single" : classifyOrdered(g.tiles, okey)) as GroupKind | "single" })),
    [groups, okey],
  );
  const slotKindMap = useMemo(() => {
    const m = new Map<number, GroupKind | "single">();
    for (const { g, kind } of classed) for (const idx of g.slotIndices) m.set(idx, kind);
    return m;
  }, [classed]);
  const slotKind = (i: number): GroupKind | "single" => slotKindMap.get(i) ?? "single";

  const validMeldGroups = classed.filter((x) => x.kind === "run" || x.kind === "set").map((x) => x.g.tiles);
  const validPairGroups = classed.filter((x) => x.kind === "pair").map((x) => x.g.tiles);
  const meldTotal = validMeldGroups.reduce((s, tiles) => s + meldPoints(tiles, okey), 0);
  // Points still sitting in hand (penalty risk after opening): face value of each
  // tile; a held okey/wildcard adds a flat 101 instead of its face value.
  const heldPoints = useMemo(() => {
    let sum = 0;
    let wild = false;
    for (const t of view.yourHand) {
      const nat = naturalValue(t, okey);
      if (nat === null) wild = true;
      else sum += nat.value;
    }
    return { sum, wild };
  }, [view.yourHand, okey]);

  const nick = (seat: number): string => seating.find((s) => s.seat === seat)?.nickname ?? `#${seat}`;

  const floorSig = view.pendingFloorTile ? tileSig(view.pendingFloorTile) : null;
  const prevSeat = (view.you + 3) % 4; // the seat I draw from / return a floor tile to
  const myLastDiscard = me?.lastDiscard ?? null;
  const canReturn = canAct && view.pendingFloorTile !== null;
  const pairsOpenerExists = view.players.some((p) => p.opened && p.openMode === "pairs");

  // --- rack interactions ----------------------------------------------------
  const dropToSlot = (to: number): void => { if (drag) move(drag.from, to); clearDrag(); };
  const dropToDiscard = (): void => { if (drag && canAct) onMove(buildDiscard(drag.tile)); clearDrag(); };
  const returnFloor = (): void => { onMove({ kind: "returnFloorTile" }); clearDrag(); setSel(null); };
  const dropToMeld = (meldId: string): void => { if (drag && canAct && opened) onMove(buildProcess(meldId, [drag.tile])); clearDrag(); };

  // --- opening / laying moves -----------------------------------------------
  const openWithMelds = (): void => { onMove({ kind: "openMelds", melds: validMeldGroups }); setSel(null); };
  const openWithPairs = (): void => { onMove({ kind: "openPairs", pairs: validPairGroups }); setSel(null); };
  const layMelds = (): void => { for (const tiles of validMeldGroups) onMove(buildOpenNewMeld(tiles)); setSel(null); };
  const layPairs = (): void => { for (const tiles of validPairGroups) onMove(buildOpenNewMeld(tiles)); setSel(null); };
  // "Seri Diz" / "Çift Diz": rearrange the rack (no opening), highest score first.
  // When there is nothing to form, leave the rack untouched.
  const arrangeSeri = (): void => { const next = arrangeMelds(view.yourHand, okey, RACK_ROWS, RACK_COLS); if (next) setSlots(next); setSel(null); };
  const arrangeCift = (): void => { const next = arrangePairs(view.yourHand, okey, RACK_ROWS, RACK_COLS); if (next) setSlots(next); setSel(null); };

  const seatBox = (seat: number): JSX.Element | null => {
    const p = view.players.find((x) => x.seat === seat);
    if (!p) return null;
    const active = view.turn === seat;
    const returnHere = canReturn && seat === prevSeat; // drop the floor tile back here
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
        <div
          onDragOver={returnHere ? (e) => e.preventDefault() : undefined}
          onDrop={returnHere ? (e) => { e.preventDefault(); returnFloor(); } : undefined}
          style={{
            marginTop: 2, borderRadius: 6, padding: "2px 4px",
            border: returnHere ? `2px dashed ${drag ? "#f2c14e" : "rgba(242,193,78,.5)"}` : "2px solid transparent",
            background: returnHere && drag ? "rgba(242,193,78,.18)" : "transparent",
          }}>
          son: {p.lastDiscard ? <Tile tile={p.lastDiscard} size="sm" /> : "—"}
          {returnHere && <div style={{ font: "9px Georgia,serif", color: "#f2c14e" }}>↩ buraya geri koy</div>}
        </div>
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
              <div style={LABEL}>gösterge · okey {okey.kind === "numbered" ? `${okey.value}` : ""}</div>
            </div>
            {/* my discard pile — drag a tile here to discard */}
            <div style={{ textAlign: "center" }}>
              <div
                data-testid="my-discard"
                onDragOver={canAct ? (e) => e.preventDefault() : undefined}
                onDrop={canAct ? (e) => { e.preventDefault(); dropToDiscard(); } : undefined}
                style={{
                  width: 40, height: 56, borderRadius: 6, margin: "0 auto",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px dashed ${canAct && drag ? "#f0d27a" : "rgba(255,255,255,.3)"}`,
                  background: canAct && drag ? "rgba(240,210,122,.2)" : "rgba(0,0,0,.18)",
                }}>
                {myLastDiscard ? <Tile tile={myLastDiscard} size="sm" /> : <span style={{ color: "#9fbfa9", font: "10px Georgia,serif" }}>at</span>}
              </div>
              <div style={LABEL}>attıkların{canAct ? " · buraya at" : ""}</div>
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
                      <div style={{ display: "flex" }}>{orderMeldForDisplay(m.tiles, okey).map((t, i) => <Tile key={i} tile={t} size="sm" />)}</div>
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

        {/* my rack */}
        <div style={{ background: "linear-gradient(#b58a52,#8a6532)", borderRadius: 12, padding: 10, border: "3px solid #f2c14e", boxShadow: "inset 0 2px 4px rgba(255,255,255,.25)", marginTop: 8 }}>
          <div style={{ ...LABEL, marginBottom: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Senin elin ({view.yourHand.length}) — taşları boşluklarla grupla; yan yana 3+ seri/grup, 2 çift</span>
            {!opened ? (
              <span style={{
                font: "700 13px Georgia,serif", padding: "2px 8px", borderRadius: 6,
                background: meldTotal >= openThreshold ? "#1f7a3a" : "#3a2a12", color: "#ffe9b8",
              }}>
                Perler: {meldTotal} puan · açış {openThreshold}
              </span>
            ) : (
              <span style={{ font: "700 13px Georgia,serif", padding: "2px 8px", borderRadius: 6, background: "#3a2a12", color: "#ffe9b8" }}>
                Elde kalan: {heldPoints.sum} puan{heldPoints.wild ? " (+101 okey)" : ""}
              </span>
            )}
          </div>
          <SlottedRack
            slots={slots}
            okey={okey}
            assist={assist}
            selected={sel}
            dragFrom={drag ? drag.from : null}
            slotKind={slotKind}
            floorSig={floorSig}
            onSelect={(i) => setSel((p) => (p === i ? null : i))}
            onDragStartSlot={(from, tile) => setDrag({ from, tile })}
            onDropToSlot={dropToSlot}
            onDragEnd={clearDrag}
          />
        </div>

        {/* floor tile taken: use it in a meld, or put it back and draw from the deck */}
        {canAct && view.pendingFloorTile && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10,
            border: "2px solid #f2c14e", borderRadius: 8, padding: 10, background: "#fff8e6",
          }}>
            <span style={{ font: "13px Georgia,serif", color: "#7a5c10" }}>
              Yerden bir taş aldın (sarı çerçeveli). Bir perde kullan, ya da geri koy.
              <br />Not: kullanmadan el açarsan <strong>+101 ceza</strong>.
            </span>
            <span style={{ flex: 1 }} />
            <button onClick={returnFloor} style={{ fontWeight: 700 }}>↩ Geri koy + desteden çek</button>
            <div
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); returnFloor(); }}
              style={{
                minWidth: 150, padding: "8px 12px", borderRadius: 8, textAlign: "center",
                border: `2px dashed ${drag ? "#caa42a" : "#d8c184"}`,
                background: drag ? "#fbefc4" : "#fffdf4", color: "#7a5c10", fontWeight: 700,
              }}>
              ↩ taşı buraya sürükle (geri koy)
            </div>
          </div>
        )}

        {/* action bar */}
        {canAct && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
            {!opened && (
              <button disabled={meldTotal < openThreshold} onClick={openWithMelds} title="Rafta kurduğun serileri/grupları aç">
                Aç ({meldTotal}/{openThreshold})
              </button>
            )}
            {!opened && (
              <button disabled={validPairGroups.length < minPairs} onClick={openWithPairs} title="Rafta kurduğun çiftleri aç">
                Çiftlerle Aç ({validPairGroups.length}/{minPairs})
              </button>
            )}
            {opened && openMode === "melds" && (
              <button disabled={validMeldGroups.length === 0} onClick={layMelds}>Perleri Diz ({validMeldGroups.length})</button>
            )}
            {opened && openMode === "melds" && pairsOpenerExists && (
              <button disabled={validPairGroups.length === 0} onClick={layPairs} title="Çift açan oyuncu olduğu için kalan çiftlerini eritebilirsin">
                Çiftleri Erit ({validPairGroups.length})
              </button>
            )}
            {opened && openMode === "pairs" && (
              <button disabled={validPairGroups.length === 0} onClick={layPairs}>Çiftleri Diz ({validPairGroups.length})</button>
            )}

            {/* assist-only helpers: rearrange the rack (do not open) */}
            {assist === "destekli" && (
              <button onClick={arrangeSeri} title="Istakadaki taşları en yüksek puanlı serilere/gruplara dizer">
                Seri Diz
              </button>
            )}
            {assist === "destekli" && !opened && (
              <button onClick={arrangeCift} title="Istakadaki taşları en iyi çiftlere dizer">
                Çift Diz
              </button>
            )}

            <span style={{ flex: 1 }} />

            {/* discard: select a tile then "At", or drag onto the zone */}
            <button
              disabled={sel === null || slots[sel] == null}
              onClick={() => { if (sel !== null && slots[sel] != null) { onMove(buildDiscard(sigToTile(slots[sel]!))); setSel(null); } }}
              style={{ fontWeight: 700 }}>
              At (seçili)
            </button>
            <div
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); dropToDiscard(); }}
              style={{
                minWidth: 160, padding: "8px 12px", borderRadius: 8, textAlign: "center",
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
