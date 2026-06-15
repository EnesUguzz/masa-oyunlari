import type { Player, PlayerId, Room, RoomCode } from "@masa/shared";
import type { Rng } from "../rng.js";
import type { RoomRepository } from "./room-repository.js";
import { RoomFullError, RoomNotFoundError } from "../errors/index.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
const CODE_LENGTH = 4;

export class RoomService {
  constructor(
    private readonly repo: RoomRepository,
    private readonly rng: Rng,
    private readonly capacity: number,
  ) {}

  createRoom(owner: Player): Room {
    const code = this.generateUniqueCode();
    const room: Room = {
      code,
      ownerId: owner.id,
      status: "waiting",
      players: [owner],
      capacity: this.capacity,
    };
    this.repo.create(room);
    return room;
  }

  joinRoom(code: RoomCode, player: Player): Room {
    const room = this.repo.get(code);
    if (!room) throw new RoomNotFoundError(code);
    if (room.players.some((p) => p.id === player.id)) return room; // idempotent
    if (room.players.length >= room.capacity) throw new RoomFullError(code);
    room.players.push(player);
    this.repo.update(room);
    return room;
  }

  /** Returns the updated room, or undefined if the room no longer exists. */
  leaveRoom(code: RoomCode, playerId: PlayerId): Room | undefined {
    const room = this.repo.get(code);
    if (!room) return undefined;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      this.repo.delete(code);
      return undefined;
    }
    if (room.ownerId === playerId) {
      room.ownerId = room.players[0]!.id;
    }
    this.repo.update(room);
    return room;
  }

  getRoom(code: RoomCode): Room | undefined {
    return this.repo.get(code);
  }

  /** The room a player currently belongs to, if any (used to restore on reconnect). */
  findRoomByPlayer(playerId: PlayerId): Room | undefined {
    return this.repo.findByPlayer(playerId);
  }

  private generateUniqueCode(): RoomCode {
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[this.rng.nextInt(CODE_ALPHABET.length)]!;
      }
      if (!this.repo.has(code)) return code;
    }
    throw new Error("Could not generate a unique room code");
  }
}
