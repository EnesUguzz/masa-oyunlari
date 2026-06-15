import type { Player, PlayerId } from "@masa/shared";
import type { Rng } from "../rng.js";

export interface IdentifyInput {
  token?: string;
  nickname: string;
}

export interface IdentifyResult {
  player: Player;
  token: string;
}

/** Maps persistent tokens to player identities. socket.id is never the identity. */
export class PlayerRegistry {
  private byToken = new Map<string, Player>();

  constructor(private readonly rng: Rng) {}

  /**
   * Resolve or create a player from a (optional) persistent token.
   *
   * CONTRACT: re-identifying a known token with a different nickname is an
   * intentional in-place rename. The returned `Player` is the SAME object the
   * registry stores, so any holder of that reference (e.g. a Room's player
   * list) sees the new nickname immediately. Callers must therefore (1) have
   * already validated `nickname` at the transport boundary (Zod), and (2)
   * re-broadcast the affected PlayerView(s) after calling identify on reconnect.
   * An unknown/absent token always mints a fresh player + token (guest UX:
   * never hard-fail a stale localStorage token).
   */
  identify(input: IdentifyInput): IdentifyResult {
    if (input.token) {
      const existing = this.byToken.get(input.token);
      if (existing) {
        existing.nickname = input.nickname;
        return { player: existing, token: input.token };
      }
    }
    const token = this.generateId("tok");
    const player: Player = {
      id: this.generateId("ply") as PlayerId,
      nickname: input.nickname,
    };
    this.byToken.set(token, player);
    return { player, token };
  }

  private generateId(prefix: string): string {
    // 12 random alphanumeric-ish chars from injected RNG.
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 12; i++) {
      const idx = this.rng.nextInt(alphabet.length);
      // idx is always in [0, alphabet.length) per Rng.nextInt's contract.
      s += alphabet[idx]!;
    }
    return `${prefix}_${s}`;
  }
}
