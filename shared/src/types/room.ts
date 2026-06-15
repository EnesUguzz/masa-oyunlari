import type { Player, PlayerId } from "./player.js";

export type RoomCode = string;

export type RoomStatus = "waiting" | "playing" | "finished";

/** Full server-side room. Never sent to clients as-is; see PlayerView. */
export interface Room {
  code: RoomCode;
  ownerId: PlayerId;
  status: RoomStatus;
  players: Player[];
  capacity: number;
}
