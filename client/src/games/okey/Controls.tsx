import type { JSX } from "react";
import { useState } from "react";
import type { Move, OkeyTile, OkeyPlayerView } from "./types.js";
import {
  buildAutoOpen, buildOpenPairsFromSelection, buildProcess, buildOpenNewMeld, buildDiscard, canDiscard,
} from "./move-builder.js";

export function Controls({ view, selected, onClearSelection, onMove }: {
  view: OkeyPlayerView;
  selected: OkeyTile[];
  onClearSelection: () => void;
  onMove: (move: Move) => void;
}): JSX.Element {
  const [meldId, setMeldId] = useState<string>("");
  const yourTurn = view.turn === view.you;
  const me = view.players.find((p) => p.seat === view.you);
  const opened = me?.opened ?? false;

  if (!yourTurn) return <p style={{ color: "#777" }}>Sıra başka oyuncuda…</p>;

  const send = (m: Move): void => { onMove(m); onClearSelection(); };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {view.phase === "draw" && (
        <>
          <button onClick={() => send({ kind: "drawFromPile" })}>Desteden çek ({view.drawPileCount})</button>
          <button onClick={() => send({ kind: "drawFromDiscard" })}>Yerden al</button>
        </>
      )}
      {view.phase === "act" && (
        <>
          <button onClick={() => send(buildAutoOpen())} title="Elindeki tüm geçerli perleri otomatik açar/dizer">
            {opened ? "Kalan perleri diz" : "Aç (perleri diz)"}
          </button>
          {!opened && (
            <button
              disabled={selected.length < 2 || selected.length % 2 !== 0}
              onClick={() => send(buildOpenPairsFromSelection(selected))}
            >
              Çiftlerle Aç
            </button>
          )}
          {opened && (
            <>
              <button disabled={selected.length < 2} onClick={() => send(buildOpenNewMeld(selected))}>Yeni Per (seçili)</button>
              <select value={meldId} onChange={(e) => setMeldId(e.target.value)}>
                <option value="">Per seç…</option>
                {view.tableMelds.filter((m) => m.kind !== "pair").map((m) => (
                  <option key={m.id} value={m.id}>{m.kind} #{m.id}</option>
                ))}
              </select>
              <button disabled={!meldId || selected.length === 0} onClick={() => send(buildProcess(meldId, selected))}>İşle</button>
            </>
          )}
          <button disabled={!canDiscard(selected)} onClick={() => send(buildDiscard(selected[0]!))}>At (seçili)</button>
          <span style={{ color: "#2a7", fontSize: 13 }}>· taşı sürükle → masaya/pere bırak</span>
        </>
      )}
    </div>
  );
}
