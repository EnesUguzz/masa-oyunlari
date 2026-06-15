import type { Player, PlayerId } from "./player.js";
import type { RoomCode, RoomStatus } from "./room.js";

/** The lobby slice a single player is allowed to see. No hidden info here yet. */
export interface PlayerView {
  room: {
    code: RoomCode;
    status: RoomStatus;
    capacity: number;
    ownerId: PlayerId;
    players: Player[];
    you: PlayerId;
  };
}
