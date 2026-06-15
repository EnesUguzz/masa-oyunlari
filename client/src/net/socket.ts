import { io, type Socket } from "socket.io-client";
import {
  ClientEvents,
  ServerEvents,
  type PlayerView,
  type IdentifiedPayload,
  type ErrorEventPayload,
  type JoinRoomPayload,
  type IdentifyPayload,
} from "@masa/shared";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

export interface ServerListeners {
  onIdentified: (p: IdentifiedPayload) => void;
  onRoomState: (v: PlayerView) => void;
  onError: (e: ErrorEventPayload) => void;
}

/** Thin typed wrapper around socket.io-client. */
export class GameSocket {
  private socket: Socket;

  constructor(listeners: ServerListeners) {
    this.socket = io(SERVER_URL, { autoConnect: true });
    this.socket.on(ServerEvents.identified, listeners.onIdentified);
    this.socket.on(ServerEvents.roomState, listeners.onRoomState);
    this.socket.on(ServerEvents.errorEvent, listeners.onError);
  }

  identify(payload: IdentifyPayload): void {
    this.socket.emit(ClientEvents.identify, payload);
  }
  createRoom(): void {
    this.socket.emit(ClientEvents.createRoom, {});
  }
  joinRoom(payload: JoinRoomPayload): void {
    this.socket.emit(ClientEvents.joinRoom, payload);
  }
  leaveRoom(): void {
    this.socket.emit(ClientEvents.leaveRoom, {});
  }
}
