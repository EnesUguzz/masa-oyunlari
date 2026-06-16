import type { PlayerId } from "@masa/shared";
import type { OkeyPlayerView } from "./view.js";
import type { MatchWinner } from "./match.js";

export interface MatchStanding {
  seatTotals: number[];
  teamTotals: [number, number] | null;
  handsPlayed: number;
  targetHands: number;
  status: "playing" | "finished";
  winner: MatchWinner;
}

export interface SeatInfo {
  seat: number;
  playerId: PlayerId;
  nickname: string;
}

export interface OkeyTableView {
  view: OkeyPlayerView;
  match: MatchStanding;
  handNumber: number;
  seating: SeatInfo[];
}
