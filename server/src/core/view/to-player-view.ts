import type { PlayerId, PlayerView, Room } from "@masa/shared";

/**
 * Pure projection of full server state into the slice a single player may see.
 * In this lobby slice there is no hidden info, but the boundary is established
 * here: callers must send toPlayerView(room, id) per player, never the raw Room.
 */
export function toPlayerView(room: Room, you: PlayerId): PlayerView {
  return {
    room: {
      code: room.code,
      status: room.status,
      capacity: room.capacity,
      ownerId: room.ownerId,
      players: room.players.map((p) => ({ id: p.id, nickname: p.nickname })),
      you,
    },
  };
}
