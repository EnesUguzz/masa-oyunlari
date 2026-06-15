import type { PlayerId } from "@masa/shared";
import type { Clock, TimerHandle } from "../clock.js";

/**
 * Tracks socket.id <-> playerId and holds a player's seat for a grace period
 * after disconnect so a reconnect with the same token can reclaim it.
 */
export class ConnectionManager {
  private socketToPlayer = new Map<string, PlayerId>();
  private playerToSocket = new Map<PlayerId, string>();
  private graceTimers = new Map<PlayerId, TimerHandle>();

  constructor(
    private readonly clock: Clock,
    private readonly gracePeriodMs: number,
    private readonly onExpire: (playerId: PlayerId) => void,
  ) {}

  attach(socketId: string, playerId: PlayerId): void {
    // Reconnect within grace cancels the pending expiry.
    const pending = this.graceTimers.get(playerId);
    if (pending !== undefined) {
      this.clock.clearTimeout(pending);
      this.graceTimers.delete(playerId);
    }
    // Evict any prior socket still bound to this player. In the usual
    // disconnect->grace->reconnect flow handleDisconnect already cleared it;
    // this guards the direct-rebind case (e.g. a second tab attaching without
    // the first socket having disconnected) so the stale socket can't resolve.
    const previousSocket = this.playerToSocket.get(playerId);
    if (previousSocket) this.socketToPlayer.delete(previousSocket);

    this.socketToPlayer.set(socketId, playerId);
    this.playerToSocket.set(playerId, socketId);
  }

  handleDisconnect(socketId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return;
    this.socketToPlayer.delete(socketId);
    // Only start grace if this socket was the player's current one.
    if (this.playerToSocket.get(playerId) === socketId) {
      this.playerToSocket.delete(playerId);
      const handle = this.clock.setTimeout(() => {
        this.graceTimers.delete(playerId);
        this.onExpire(playerId);
      }, this.gracePeriodMs);
      this.graceTimers.set(playerId, handle);
    }
  }

  playerForSocket(socketId: string): PlayerId | undefined {
    return this.socketToPlayer.get(socketId);
  }

  isConnected(playerId: PlayerId): boolean {
    return this.playerToSocket.has(playerId);
  }

  socketForPlayer(playerId: PlayerId): string | undefined {
    return this.playerToSocket.get(playerId);
  }
}
