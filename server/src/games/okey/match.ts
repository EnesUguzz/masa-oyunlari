import { InvalidMoveError } from "../../core/errors/index.js";
import type { PlayerId } from "@masa/shared";
import type { OkeyGameConfig } from "./game-config.js";
import type { HandScore } from "./scoring.js";

export type MatchWinner = { kind: "seat"; seat: number } | { kind: "team"; team: 0 | 1 } | null;

export interface MatchState {
  config: OkeyGameConfig;
  players: PlayerId[];
  seatTotals: number[];
  teamTotals: [number, number] | null;
  handsPlayed: number;
  status: "playing" | "finished";
  winner: MatchWinner;
}

export function createMatch(config: OkeyGameConfig, players: readonly PlayerId[]): MatchState {
  if (players.length !== 4) throw new InvalidMoveError("okey requires exactly 4 players");
  return {
    config,
    players: [...players],
    seatTotals: [0, 0, 0, 0],
    teamTotals: config.pairing === "esli" ? [0, 0] : null,
    handsPlayed: 0,
    status: "playing",
    winner: null,
  };
}

export function applyHandScore(match: MatchState, score: HandScore): MatchState {
  if (match.status === "finished") throw new InvalidMoveError("match is already finished");

  const seatTotals = match.seatTotals.map((t, i) => t + (score.perSeat[i] ?? 0));
  let teamTotals: [number, number] | null = null;
  if (match.teamTotals !== null) {
    const st = score.perTeam ?? [0, 0];
    teamTotals = [match.teamTotals[0] + st[0], match.teamTotals[1] + st[1]];
  }
  const handsPlayed = match.handsPlayed + 1;

  let status: "playing" | "finished" = "playing";
  let winner: MatchWinner = null;
  if (handsPlayed === match.config.targetHands) {
    status = "finished";
    if (teamTotals !== null) {
      winner = { kind: "team", team: teamTotals[0] <= teamTotals[1] ? 0 : 1 };
    } else {
      let best = 0;
      for (let i = 1; i < seatTotals.length; i++) {
        if ((seatTotals[i] ?? 0) < (seatTotals[best] ?? 0)) best = i;
      }
      winner = { kind: "seat", seat: best };
    }
  }

  return { ...match, seatTotals, teamTotals, handsPlayed, status, winner };
}
