import type { Server, Socket } from "socket.io";
import {
  ClientEvents,
  ServerEvents,
  identifySchema,
  createRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
} from "@masa/shared";
import type { Player } from "@masa/shared";
import { PlayerRegistry } from "../core/player/player-registry.js";
import { RoomService } from "../core/room/room-service.js";
import { ConnectionManager } from "../core/connection/connection-manager.js";
import { toPlayerView } from "../core/view/to-player-view.js";
import { AppError, ValidationError } from "../core/errors/index.js";
import type { Logger } from "../core/logger.js";

interface Deps {
  io: Server;
  registry: PlayerRegistry;
  rooms: RoomService;
  connections: ConnectionManager;
  logger: Logger;
}

interface Session {
  player?: Player;
  roomCode?: string;
}

export function registerHandlers(deps: Deps): void {
  const { io, registry, rooms, connections, logger } = deps;

  io.on("connection", (socket: Socket) => {
    const session: Session = {};

    const fail = (err: unknown) => {
      if (err instanceof AppError) {
        socket.emit(ServerEvents.errorEvent, { code: err.code, message: err.message });
      } else {
        logger.error({ err }, "unexpected handler error");
        socket.emit(ServerEvents.errorEvent, {
          code: "INTERNAL",
          message: "Unexpected server error",
        });
      }
    };

    socket.on(ClientEvents.identify, (raw: unknown) => {
      try {
        const payload = identifySchema.parse(raw);
        const { player, token } = registry.identify(payload);
        session.player = player;
        connections.attach(socket.id, player.id);
        socket.emit(ServerEvents.identified, { playerId: player.id, token });
        // If this socket session already knew a room (rare), refresh it.
        if (session.roomCode) sendRoomState(io, connections, session.roomCode, rooms);
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.createRoom, (raw: unknown) => {
      try {
        createRoomSchema.parse(raw);
        const player = requirePlayer(session);
        const room = rooms.createRoom(player);
        session.roomCode = room.code;
        sendRoomState(io, connections, room.code, rooms);
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.joinRoom, (raw: unknown) => {
      try {
        const { code } = joinRoomSchema.parse(raw);
        const player = requirePlayer(session);
        const room = rooms.joinRoom(code, player);
        session.roomCode = room.code;
        sendRoomState(io, connections, room.code, rooms);
      } catch (err) {
        fail(err);
      }
    });

    socket.on(ClientEvents.leaveRoom, (raw: unknown) => {
      try {
        leaveRoomSchema.parse(raw);
        const player = requirePlayer(session);
        if (session.roomCode) {
          const code = session.roomCode;
          rooms.leaveRoom(code, player.id);
          session.roomCode = undefined;
          sendRoomState(io, connections, code, rooms);
        }
      } catch (err) {
        fail(err);
      }
    });

    socket.on("disconnect", () => {
      connections.handleDisconnect(socket.id);
    });
  });
}

function requirePlayer(session: Session): Player {
  if (!session.player) throw new ValidationError("Not identified");
  return session.player;
}

function sendRoomState(
  io: Server,
  connections: ConnectionManager,
  code: string,
  rooms: RoomService,
): void {
  const room = rooms.getRoom(code);
  if (!room) return;
  for (const member of room.players) {
    const socketId = connections.socketForPlayer(member.id);
    if (!socketId) continue;
    io.to(socketId).emit(ServerEvents.roomState, toPlayerView(room, member.id));
  }
}
