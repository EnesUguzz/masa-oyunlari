import { describe, expect, it, vi } from "vitest";
import type { Player, PlayerId } from "@masa/shared";
import { FakeClock } from "../../core/clock.js";
import { SeededRng } from "../../core/rng.js";
import { InMemoryRoomRepository } from "../../core/room/room-repository.js";
import { RoomService } from "../../core/room/room-service.js";
import { ConnectionManager } from "../../core/connection/connection-manager.js";
import { OkeySessionStore, registerOkeyHandlers } from "./handlers.js";
import { OkeyClientEvents, OkeyServerEvents } from "./contract.js";

type Handler = (raw: unknown) => void;
function makeSocket() {
  const handlers = new Map<string, Handler>();
  return {
    on: (ev: string, fn: Handler) => handlers.set(ev, fn),
    emit: vi.fn(),
    fire: (ev: string, raw: unknown) => handlers.get(ev)?.(raw),
  };
}
const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as Parameters<typeof registerOkeyHandlers>[3]["logger"];

function setup() {
  const rooms = new RoomService(new InMemoryRoomRepository(), new SeededRng(1), 4);
  const clock = new FakeClock();
  const connections = new ConnectionManager(clock, 30000, () => {});
  const store = new OkeySessionStore();
  const emits: { sid: string; ev: string; payload: unknown }[] = [];
  const io = { to: (sid: string) => ({ emit: (ev: string, payload: unknown) => emits.push({ sid, ev, payload }) }) } as unknown as Parameters<typeof registerOkeyHandlers>[3]["io"];
  const players: Player[] = [0, 1, 2, 3].map((i) => ({ id: `p${i}` as PlayerId, nickname: `N${i}` }));
  const owner = players[0]!;
  const room = rooms.createRoom(owner);
  for (const p of players.slice(1)) rooms.joinRoom(room.code, p);
  for (const p of players) connections.attach(`s_${p.id}`, p.id);
  const deps = { io, rooms, connections, store, rng: new SeededRng(9), clock, turnTimeoutMs: 1000, logger };
  const socket = makeSocket();
  registerOkeyHandlers(socket as unknown as Parameters<typeof registerOkeyHandlers>[0], () => owner, () => room.code, deps);
  return { rooms, room, clock, store, emits, socket, players, deps };
}

describe("okey handlers", () => {
  it("startGame: owner starts, room becomes playing, each seat gets only its own hand", () => {
    const { socket, emits, room, rooms } = setup();
    socket.fire(OkeyClientEvents.startGame, { pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 7 });
    expect(rooms.getRoom(room.code)!.status).toBe("playing");
    const states = emits.filter((e) => e.ev === OkeyServerEvents.state);
    expect(states.length).toBe(4);
    for (const s of states) {
      const tv = s.payload as { view: { you: number; yourHand: unknown[]; players: { handCount: number }[] } };
      expect(tv.view.yourHand.length).toBe(tv.view.players[tv.view.you]!.handCount);
    }
  });

  it("rejects startGame from a non-owner", () => {
    const { deps, room } = setup();
    const sock = makeSocket();
    const nonOwner = { id: "p1" as PlayerId, nickname: "N1" };
    registerOkeyHandlers(sock as unknown as Parameters<typeof registerOkeyHandlers>[0], () => nonOwner, () => room.code, deps);
    sock.fire(OkeyClientEvents.startGame, { pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 7 });
    expect(sock.emit).toHaveBeenCalled(); // errorEvent emitted on the socket
  });

  it("a timeout auto-plays the current seat and re-broadcasts", () => {
    const { socket, emits, clock } = setup();
    socket.fire(OkeyClientEvents.startGame, { pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 7 });
    const before = emits.length;
    clock.advance(1000);
    expect(emits.length).toBeGreaterThan(before);
  });
});
