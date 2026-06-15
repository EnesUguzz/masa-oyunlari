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
