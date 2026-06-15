import type { Room, RoomCode } from "@masa/shared";

/** Storage seam for rooms. In-memory now; Redis later behind the same interface. */
export interface RoomRepository {
  create(room: Room): void;
  get(code: RoomCode): Room | undefined;
  update(room: Room): void;
  delete(code: RoomCode): void;
  has(code: RoomCode): boolean;
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
}
