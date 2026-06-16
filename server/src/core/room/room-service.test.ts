import { describe, it, expect } from "vitest";
import { InMemoryRoomRepository } from "./room-repository.js";
import { RoomService } from "./room-service.js";
import { SeededRng } from "../rng.js";
import { RoomFullError, RoomNotFoundError } from "../errors/index.js";
import type { Player, PlayerId } from "@masa/shared";

function player(id: string, nickname: string): Player {
  return { id: id as PlayerId, nickname };
}

function makeService(capacity = 4) {
  const repo = new InMemoryRoomRepository();
  const service = new RoomService(repo, new SeededRng(1), capacity);
  return { repo, service };
}

describe("RoomService", () => {
  it("creates a room owned by the creator who is seated", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    expect(room.code).toBeTruthy();
    expect(room.ownerId).toBe("p1");
    expect(room.status).toBe("waiting");
    expect(room.players.map((p) => p.id)).toEqual(["p1"]);
  });

  it("lets a second player join by code", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    const joined = service.joinRoom(room.code, player("p2", "Grace"));
    expect(joined.players.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("throws RoomNotFoundError for an unknown code", () => {
    const { service } = makeService();
    expect(() => service.joinRoom("NOPE", player("p2", "Grace"))).toThrow(
      RoomNotFoundError,
    );
  });

  it("throws RoomFullError when capacity is exceeded", () => {
    const { service } = makeService(2);
    const room = service.createRoom(player("p1", "Ada"));
    service.joinRoom(room.code, player("p2", "Grace"));
    expect(() => service.joinRoom(room.code, player("p3", "Lin"))).toThrow(
      RoomFullError,
    );
  });

  it("is idempotent if the same player joins twice", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    service.joinRoom(room.code, player("p2", "Grace"));
    const again = service.joinRoom(room.code, player("p2", "Grace"));
    expect(again.players.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("removes a player on leave and deletes the room when empty", () => {
    const { service, repo } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    service.leaveRoom(room.code, "p1" as PlayerId);
    expect(repo.get(room.code)).toBeUndefined();
  });

  it("reassigns ownership when the owner leaves a non-empty room", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    service.joinRoom(room.code, player("p2", "Grace"));
    const after = service.leaveRoom(room.code, "p1" as PlayerId);
    expect(after?.ownerId).toBe("p2");
  });

  it("finds the room a player currently belongs to (for reconnect)", () => {
    const { service } = makeService();
    const room = service.createRoom(player("p1", "Ada"));
    service.joinRoom(room.code, player("p2", "Grace"));
    expect(service.findRoomByPlayer("p2" as PlayerId)?.code).toBe(room.code);
  });

  it("returns undefined when the player is in no room", () => {
    const { service } = makeService();
    service.createRoom(player("p1", "Ada"));
    expect(service.findRoomByPlayer("ghost" as PlayerId)).toBeUndefined();
  });

  it("addBots fills up to capacity with isBot flag and unique ids", () => {
    const rooms = new RoomService(new InMemoryRoomRepository(), new SeededRng(1), 4);
    const owner = { id: "p0" as PlayerId, nickname: "N0" };
    const room = rooms.createRoom(owner);
    const after = rooms.addBots(room.code, 3)!;
    expect(after.players.length).toBe(4);
    const bots = after.players.filter((p) => p.isBot);
    expect(bots.length).toBe(3);
    expect(new Set(bots.map((b) => b.id)).size).toBe(3);
    expect(bots.map((b) => b.nickname)).toEqual(["Bot 1", "Bot 2", "Bot 3"]);
  });

  it("addBots never exceeds capacity", () => {
    const rooms = new RoomService(new InMemoryRoomRepository(), new SeededRng(1), 4);
    const room = rooms.createRoom({ id: "p0" as PlayerId, nickname: "N0" });
    rooms.addBots(room.code, 10);
    expect(rooms.getRoom(room.code)!.players.length).toBe(4);
  });
});
