import type { Server, Socket } from "socket.io";
import type { Player } from "@masa/shared";
import { ServerEvents } from "@masa/shared";
import { AppError, ValidationError } from "../../core/errors/index.js";
import type { Rng } from "../../core/rng.js";
import type { Clock } from "../../core/clock.js";
import { TurnTimer } from "../../core/turn/turn-timer.js";
import type { ConnectionManager } from "../../core/connection/connection-manager.js";
import type { RoomService } from "../../core/room/room-service.js";
import type { Logger } from "../../core/logger.js";
import { makeConfig } from "./game-config.js";
import { OkeySession } from "./session.js";
import { OkeyClientEvents, OkeyServerEvents, startGameSchema, okeyMoveSchema } from "./contract.js";

export class OkeySessionStore {
  private sessions = new Map<string, OkeySession>();
  private timers = new Map<string, TurnTimer>();

  get(code: string): OkeySession | undefined {
    return this.sessions.get(code);
  }
  set(code: string, session: OkeySession): void {
    this.sessions.set(code, session);
  }
  timer(code: string, clock: Clock): TurnTimer {
    let t = this.timers.get(code);
    if (!t) {
      t = new TurnTimer(clock);
      this.timers.set(code, t);
    }
    return t;
  }
  end(code: string): void {
    this.timers.get(code)?.clear();
    this.timers.delete(code);
    this.sessions.delete(code);
  }
}

export interface OkeyDeps {
  io: Server;
  rooms: RoomService;
  connections: ConnectionManager;
  store: OkeySessionStore;
  rng: Rng;
  clock: Clock;
  turnTimeoutMs: number;
  logger: Logger;
}

export function registerOkeyHandlers(
  socket: Socket,
  getPlayer: () => Player | undefined,
  getRoomCode: () => string | undefined,
  deps: OkeyDeps,
): void {
  const { io, rooms, connections, store, rng, clock, turnTimeoutMs, logger } = deps;

  const fail = (err: unknown): void => {
    if (err instanceof AppError) {
      socket.emit(ServerEvents.errorEvent, { code: err.code, message: err.message });
    } else {
      logger.error({ err }, "okey handler error");
      socket.emit(ServerEvents.errorEvent, { code: "INTERNAL", message: "Unexpected server error" });
    }
  };

  const broadcast = (code: string, ev: string): void => {
    const session = store.get(code);
    if (!session) return;
    for (const s of session.seatList()) {
      const sid = connections.socketForPlayer(s.playerId);
      if (sid) io.to(sid).emit(ev, session.tableViewFor(s.seat));
    }
  };

  const driveBots = (code: string): void => {
    const session = store.get(code);
    if (!session) return;
    let guard = 0;
    while (!session.isOver && session.isBotSeat(session.currentSeat) && guard++ < 10000) {
      session.autoPlayTurn(session.currentSeat);
    }
  };

  const advance = (code: string): void => {
    driveBots(code);
    const session = store.get(code);
    if (!session) return;
    if (session.isOver) {
      broadcast(code, OkeyServerEvents.ended);
      rooms.setStatus(code, "finished");
      store.end(code);
    } else {
      broadcast(code, OkeyServerEvents.state);
      armTimer(code);
    }
  };

  function armTimer(code: string): void {
    const session = store.get(code);
    if (!session || session.isOver) return;
    const seat = session.currentSeat;
    store.timer(code, clock).start(turnTimeoutMs, () => {
      try {
        // Re-fetch from the store: a concurrent move may have ended the game and
        // removed the session before this timer fired.
        const live = store.get(code);
        if (!live || live.isOver) return;
        live.autoPlayTurn(seat);
        advance(code);
      } catch (err) {
        logger.error({ err }, "okey turn-timeout failed");
      }
    });
  }

  socket.on(OkeyClientEvents.startGame, (raw: unknown) => {
    try {
      const payload = startGameSchema.parse(raw);
      const player = requirePlayer(getPlayer());
      const code = getRoomCode();
      const room = code ? rooms.getRoom(code) : undefined;
      if (!room || !code) throw new ValidationError("Not in a room");
      if (room.ownerId !== player.id) throw new ValidationError("Only the owner can start the game");
      if (room.status !== "waiting") throw new ValidationError("Game already started");
      if (room.players.length !== 4) throw new ValidationError("Need exactly 4 players to start");
      const session = new OkeySession(makeConfig(payload), room.players, rng);
      store.set(code, session);
      rooms.setStatus(code, "playing");
      advance(code);
    } catch (err) {
      fail(err);
    }
  });

  socket.on(OkeyClientEvents.move, (raw: unknown) => {
    try {
      const { move } = okeyMoveSchema.parse(raw);
      const player = requirePlayer(getPlayer());
      const code = getRoomCode();
      const session = code ? store.get(code) : undefined;
      if (!code || !session) throw new ValidationError("No active game");
      const seat = session.seatOf(player.id);
      if (seat === null) throw new ValidationError("You are not seated in this game");
      session.apply(seat, move);
      store.timer(code, clock).clear();
      advance(code);
    } catch (err) {
      fail(err);
    }
  });
}

function requirePlayer(player: Player | undefined): Player {
  if (!player) throw new ValidationError("Not identified");
  return player;
}
