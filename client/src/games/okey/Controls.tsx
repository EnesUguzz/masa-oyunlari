import type { JSX } from "react";
import { useState } from "react";
import type { Move, OkeyTile, OkeyPlayerView } from "./types.js";
import { buildOpenMelds, buildOpenPairs, buildProcess, buildOpenNewMeld, buildDiscard, canDiscard } from "./move-builder.js";

export function Controls({ view, selected, onClearSelection, onMove }: {
  view: OkeyPlayerView;
  selected: OkeyTile[];
  onClearSelection: () => void;
  onMove: (move: Move) => void;
}): JSX.Element {
  const [staged, setStaged] = useState<OkeyTile[][]>([]);
  const [meldId, setMeldId] = useState<string>("");
  const yourTurn = view.turn === view.you;

  if (!yourTurn) return <p>Sıra başka oyuncuda…</p>;

  const send = (m: Move): void => { onMove(m); setStaged([]); onClearSelection(); };
  const stage = (): void => { if (selected.length > 0) { setStaged((g) => [...g, selected]); onClearSelection(); } };

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
          <button disabled={selected.length === 0} onClick={stage}>Gruba ekle ({staged.length} hazır)</button>
          <button disabled={staged.length === 0} onClick={() => send(buildOpenMelds(staged))}>Perlerle Aç</button>
          <button disabled={staged.length === 0} onClick={() => send(buildOpenPairs(staged))}>Çiftlerle Aç</button>
          <button disabled={selected.length === 0} onClick={() => send(buildOpenNewMeld(selected))}>Yeni Per</button>
          <select value={meldId} onChange={(e) => setMeldId(e.target.value)}>
            <option value="">Per seç…</option>
            {view.tableMelds.map((m) => (
              <option key={m.id} value={m.id}>{m.kind} #{m.id}</option>
            ))}
          </select>
          <button disabled={!meldId || selected.length === 0} onClick={() => send(buildProcess(meldId, selected))}>İşle</button>
          <button disabled={!canDiscard(selected)} onClick={() => send(buildDiscard(selected[0]!))}>At</button>
        </>
      )}
    </div>
  );
}
