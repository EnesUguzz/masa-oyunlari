import { createServer } from "node:http";
import { Server } from "socket.io";
import { loadConfig } from "./core/config.js";
import { logger } from "./core/logger.js";
import { CryptoRng } from "./core/rng.js";
import { RealClock } from "./core/clock.js";
import { PlayerRegistry } from "./core/player/player-registry.js";
import { InMemoryRoomRepository } from "./core/room/room-repository.js";
import { RoomService } from "./core/room/room-service.js";
import { ConnectionManager } from "./core/connection/connection-manager.js";
import { registerHandlers } from "./socket/register-handlers.js";
import type { PlayerId } from "@masa/shared";

const config = loadConfig(process.env);
const rng = new CryptoRng();
const clock = new RealClock();

const registry = new PlayerRegistry(rng);
const roomRepo = new InMemoryRoomRepository();
const rooms = new RoomService(roomRepo, rng, 4);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigin },
});

const connections = new ConnectionManager(clock, config.gracePeriodMs, (playerId: PlayerId) => {
  logger.info({ playerId }, "grace period elapsed; player considered gone");
  // In this slice there is no game; nothing to clean up beyond connection maps.
  // TODO (Okey slice): on expiry this should rooms.leaveRoom(...) and rebroadcast.
  // It deliberately does NOT today, because reconnect-restore relies on the seat
  // surviving (findRoomByPlayer). Resolve both together: expire the seat AND make
  // reconnect reattach by token membership, or reload-reconnect will break.
});

registerHandlers({ io, registry, rooms, connections, logger });

httpServer.listen(config.port, () => {
  logger.info({ port: config.port }, "masa server listening");
});
