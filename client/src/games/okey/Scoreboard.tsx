import type { JSX } from "react";
import type { MatchStanding, SeatInfo } from "./types.js";

export function Scoreboard({ match, seating }: { match: MatchStanding; seating: SeatInfo[] }): JSX.Element {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 8, minWidth: 160 }}>
      <strong>Skor</strong>
      <p style={{ margin: "4px 0" }}>El {match.handsPlayed}/{match.targetHands}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {seating.map((s) => (
          <li key={s.seat}>{s.nickname}: {match.seatTotals[s.seat] ?? 0}</li>
        ))}
      </ul>
      {match.teamTotals && (
        <p style={{ margin: "4px 0" }}>Takım: {match.teamTotals[0]} / {match.teamTotals[1]}</p>
      )}
      {match.status === "finished" && match.winner && (
        <p style={{ color: "green", fontWeight: 700 }}>
          Kazanan: {match.winner.kind === "seat" ? seating[match.winner.seat]?.nickname : `Takım ${match.winner.team}`}
        </p>
      )}
    </div>
  );
}
