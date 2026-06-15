import type { Rng } from "../../core/rng.js";
import type { OkeyTile } from "./tile.js";
import { OKEY_COLORS, MIN_VALUE, MAX_VALUE, fakeJoker, numbered } from "./tile.js";

export function buildDeck(): OkeyTile[] {
  const deck: OkeyTile[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const color of OKEY_COLORS) {
      for (let value = MIN_VALUE; value <= MAX_VALUE; value++) {
        deck.push(numbered(color, value));
      }
    }
  }
  deck.push(fakeJoker(), fakeJoker());
  return deck; // 2 * (4 * 13) + 2 = 106
}

/** Fisher-Yates using the injected RNG. Pure: returns a new array. */
export function shuffle(deck: readonly OkeyTile[], rng: Rng): OkeyTile[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
