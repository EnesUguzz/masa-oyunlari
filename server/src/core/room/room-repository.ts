import type { PlayerId, Room, RoomCode } from "@masa/shared";

/** Storage seam for rooms. In-memory now; Redis later behind the same interface. */
export interface RoomRepository {
  create(room: Room): void;
  get(code: RoomCode): Room | undefined;
  update(room: Room): void;
  delete(code: RoomCode): void;
  has(code: RoomCode): boolean;
  /** The room a player currently sits in, if any (used for reconnect). */
  findByPlayer(playerId: PlayerId): Room | undefined;
}

export class InMemoryRoomRepository implements RoomRepository {
  private rooms = new Map<RoomCode, Room>();

  create(room: Room): void {
    this.rooms.set(room.code, room);
  }
  get(code: RoomCode): Room | undefined {
    return this.rooms.get(code);
  }
  update(room: Room): void {
    this.rooms.set(room.code, room);
  }
  delete(code: RoomCode): void {
    this.rooms.delete(code);
  }
  has(code: RoomCode): boolean {
    return this.rooms.has(code);
  }
  findByPlayer(playerId: PlayerId): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === playerId)) return room;
    }
    return undefined;
  }
}
